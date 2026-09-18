import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import { PhysicsEngine } from './public/physics.js';
import { CONFIG } from './public/config.js';

const app    = express();
const server = http.createServer(app);
const io     = new Server(server, { cors: { origin: '*' } });

app.use(express.static('public'));

// In-memory room store: roomCode -> roomData
const rooms = {};

function generateRoomCode() {
    let code, attempts = 0;
    do {
        code = Math.floor(1000 + Math.random() * 9000).toString();
        attempts++;
    } while (rooms[code] && attempts < 1000);
    return code;
}

function getRoomPlayers(roomCode) {
    if (!rooms[roomCode]) return [];
    return Object.values(rooms[roomCode].players).sort((a, b) => a.nodeId - b.nodeId);
}

function reindexRoomPlayers(roomCode) {
    if (!rooms[roomCode]) return;
    const list = Object.values(rooms[roomCode].players).sort((a, b) => a.joinedAt - b.joinedAt);
    list.forEach((player, idx) => {
        player.nodeId = idx + 1;
        io.to(player.id).emit('assign-node', {
            nodeId: player.nodeId,
            roomCode,
            totalPlayers: list.length
        });
    });
}

function emitPhysicsState(target, room) {
    if (!room || !room.physics) return;
    const stunnedIds = Object.values(room.players)
        .filter(p => p.stunned)
        .map(p => p.nodeId);

    target.emit('physics-sync', {
        roomCode:     room.code,
        x:            room.physics.x,
        y:            room.physics.y,
        angle:        room.physics.angle,
        vx:           room.physics.vx,
        vy:           room.physics.vy,
        vRot:         room.physics.vRot,
        round:        room.round,        // 1-indexed for clients
        stunCount:    room.stunCount !== undefined ? room.stunCount : 2,
        stunnedNodes: stunnedIds,
        timestamp:    Date.now()
    });
}

// Transition a room to the next round (or final victory)
function advanceRound(roomCode) {
    const room = rooms[roomCode];
    if (!room) return;

    const nextRound = room.round + 1;
    const maxRounds = CONFIG.rounds.length;

    if (nextRound > maxRounds) {
        // All rounds complete → final victory
        io.to(roomCode).emit('game-complete', { roomCode });
        return;
    }

    // Broadcast round-complete with brief transition delay
    io.to(roomCode).emit('round-complete', {
        roomCode,
        completedRound: room.round,
        nextRound
    });

    // After 3.5 seconds (client shows transition overlay) → start next round
    setTimeout(() => {
        if (!rooms[roomCode]) return;
        room.round = nextRound;
        room.roundStartedAt = Date.now();

        // Reset all player vectors and stun states
        Object.values(room.players).forEach(p => {
            p.vector  = { x: 0, y: 0 };
            p.stunned = false;
            p.stunnedUntil = 0;
            p.stunImmuneUntil = 0;
        });

        // Switch physics engine to new round (0-indexed)
        room.physics.setRound(nextRound - 1);

        io.to(roomCode).emit('round-start', {
            roomCode,
            round: nextRound
        });

        emitPhysicsState(io.to(roomCode), room);
        console.log(`[Room ${roomCode}] → Round ${nextRound} started`);
    }, 3500);
}

io.on('connection', (socket) => {
    // 1. Create Room
    socket.on('create-room', (data = {}) => {
        const roomCode   = generateRoomCode();
        const isHost     = Boolean(data.isHost);
        const playerName = (data.playerName || 'Player 1').trim().slice(0, 16);
        const roomPhysics = new PhysicsEngine();

        rooms[roomCode] = {
            code:           roomCode,
            createdAt:      Date.now(),
            roundStartedAt: Date.now(),
            hostSocketId:   isHost ? socket.id : null,
            physics:        roomPhysics,
            round:          1,
            stunCount:      2,
            players:        {},
            spectators:     new Set()
        };

        socket.join(roomCode);
        socket.roomCode = roomCode;
        socket.isHost   = isHost;

        if (isHost) {
            rooms[roomCode].spectators.add(socket.id);
            socket.emit('room-created', { success: true, roomCode, isHost: true, players: [] });
        } else {
            const playerObj = {
                id: socket.id, name: playerName, nodeId: 1,
                joinedAt: Date.now(), vector: { x: 0, y: 0 },
                stunned: false, stunnedUntil: 0
            };
            rooms[roomCode].players[socket.id] = playerObj;
            socket.nodeId = 1;
            socket.emit('room-created', { success: true, roomCode, isHost: false, nodeId: 1, players: [playerObj] });
            socket.emit('assign-node', { nodeId: 1, roomCode, totalPlayers: 1 });
        }

        io.to(roomCode).emit('state-update', { roomCode, players: getRoomPlayers(roomCode) });
        emitPhysicsState(socket, rooms[roomCode]);
        console.log(`[Room ${roomCode}] Created by ${socket.id} (${isHost ? 'Host' : 'Player'})`);
    });

    // 2. Join Room
    socket.on('join-room', (data = {}) => {
        const rawCode    = String(data.roomCode || '').trim();
        const roomCode   = rawCode.padStart(4, '0');
        const isHost     = Boolean(data.isHost);
        const playerName = (data.playerName || 'Player').trim().slice(0, 16);
        const room       = rooms[roomCode];

        if (!room) {
            socket.emit('join-error', { message: `Room ${roomCode} not found.` });
            return;
        }

        const currentCount = Object.keys(room.players).length;
        if (!isHost && currentCount >= 6) {
            socket.emit('join-error', { message: `Room ${roomCode} is full (6/6).` });
            return;
        }

        socket.join(roomCode);
        socket.roomCode = roomCode;
        socket.isHost   = isHost;

        if (isHost) {
            room.spectators.add(socket.id);
            socket.emit('room-joined', { success: true, roomCode, isHost: true, players: getRoomPlayers(roomCode) });
        } else {
            const assignedNodeId = currentCount + 1;
            const playerObj = {
                id: socket.id, name: playerName || `Player ${assignedNodeId}`,
                nodeId: assignedNodeId, joinedAt: Date.now(),
                vector: { x: 0, y: 0 }, stunned: false, stunnedUntil: 0
            };
            room.players[socket.id] = playerObj;
            socket.nodeId = assignedNodeId;
            socket.emit('room-joined', { success: true, roomCode, isHost: false, nodeId: assignedNodeId, players: getRoomPlayers(roomCode) });
            reindexRoomPlayers(roomCode);
        }

        io.to(roomCode).emit('state-update', { roomCode, players: getRoomPlayers(roomCode) });
        emitPhysicsState(socket, room);
        console.log(`[Room ${roomCode}] ${socket.id} joined as ${isHost ? 'Host' : 'Player #' + socket.nodeId}`);
    });

    // 3. Player Input
    socket.on('player-input', (vector) => {
        const roomCode = socket.roomCode;
        if (!roomCode || !rooms[roomCode]) return;
        const player = rooms[roomCode].players[socket.id];
        if (player && !player.stunned) {
            player.vector = {
                x: Math.max(-1, Math.min(1, Number(vector?.x) || 0)),
                y: Math.max(-1, Math.min(1, Number(vector?.y) || 0))
            };
            io.to(roomCode).emit('state-update', { roomCode, players: getRoomPlayers(roomCode) });
        }
    });

    // 4. Reset Puzzle (back to Round 1)
    socket.on('reset-puzzle', () => {
        const roomCode = socket.roomCode;
        const room     = rooms[roomCode];
        if (!roomCode || !room) return;

        room.round = 1;
        room.roundStartedAt = Date.now();
        Object.values(room.players).forEach(p => {
            p.vector = { x: 0, y: 0 };
            p.stunned = false;
            p.stunnedUntil = 0;
            p.stunImmuneUntil = 0;
        });
        room.physics.setRound(0);

        io.to(roomCode).emit('puzzle-reset', { roomCode, players: getRoomPlayers(roomCode) });
        emitPhysicsState(io.to(roomCode), room);
        console.log(`[Room ${roomCode}] Full reset to Round 1 by ${socket.id}`);
    });

    // 5. Disconnect / Leave
    const handleLeave = () => {
        const roomCode = socket.roomCode;
        if (!roomCode || !rooms[roomCode]) return;
        const room = rooms[roomCode];

        if (room.players[socket.id]) {
            delete room.players[socket.id];
            reindexRoomPlayers(roomCode);
        }
        room.spectators.delete(socket.id);

        const remaining = Object.keys(room.players).length;
        io.to(roomCode).emit('state-update', { roomCode, players: getRoomPlayers(roomCode) });
        console.log(`[Room ${roomCode}] ${socket.id} left. Remaining: ${remaining} players`);

        if (remaining === 0 && room.spectators.size === 0) {
            delete rooms[roomCode];
            console.log(`[Room ${roomCode}] Cleaned up empty room.`);
        }
    };

    // 6. Set Stun Count (Host Power for Round 2: 0 to 6 players)
    socket.on('set-stun-count', (data = {}) => {
        const roomCode = socket.roomCode || data.roomCode;
        if (!roomCode || !rooms[roomCode]) return;
        const count = Math.max(0, Math.min(6, parseInt(data.stunCount ?? 2, 10)));
        rooms[roomCode].stunCount = count;
        io.to(roomCode).emit('stun-count-updated', { roomCode, stunCount: count });
        console.log(`[Room ${roomCode}] Host set stun penalty to ${count} players`);
    });

    socket.on('leave-room', handleLeave);
    socket.on('disconnect', handleLeave);
});

// ─── AUTHORITATIVE 60Hz PHYSICS TICK ─────────────────────────────────────────
const TICK_RATE = 60;

setInterval(() => {
    const now = Date.now();

    for (const roomCode of Object.keys(rooms)) {
        const room = rooms[roomCode];
        if (!room || !room.physics) continue;

        const playerList = Object.values(room.players);

        // --- Expire stun timers (all rounds) ---
        let stunStateChanged = false;
        playerList.forEach(p => {
            if (p.stunned && now >= p.stunnedUntil) {
                p.stunned = false;
                p.stunnedUntil = 0;
                stunStateChanged = true;
                console.log(`[Room ${roomCode}] Node #${p.nodeId} stun expired`);
            }
        });

        // --- Physics step ---
        room.physics.update(playerList);

        // --- Wall-contact stun (with grace period after spawn & cooldown) ---
        const rc = CONFIG.rounds[room.round - 1] || CONFIG.rounds[0];
        const stunCount = room.stunCount !== undefined ? room.stunCount : 2;
        // Skip stun if host turned it off (0) or during 3s spawn grace period
        const timeSinceRoundStart = now - (room.roundStartedAt || 0);
        if (timeSinceRoundStart > 3000 && stunCount > 0 && rc.stunOnContact !== false) {
            const contact = room.physics.getFirstContactPoint(4);
            if (contact) {
                const sorted = room.physics.getContactNodeDistances(playerList, contact);
                const toStun = sorted.slice(0, stunCount);
                toStun.forEach(entry => {
                    const p = room.players[entry.playerId];
                    // Only stun if not already stunned and immunity cooldown has passed
                    if (p && !p.stunned && (!p.stunImmuneUntil || now >= p.stunImmuneUntil)) {
                        const dur = rc.stunDurationMs || 2500;
                        p.stunned         = true;
                        p.stunnedUntil    = now + dur;
                        p.stunImmuneUntil = now + dur + 1000; // 1s grace to steer away after stun
                        p.vector          = { x: 0, y: 0 };
                        stunStateChanged  = true;
                        console.log(`[Room ${roomCode}] Round ${room.round} | Node #${p.nodeId} STUNNED for ${dur}ms (penalty: ${stunCount})`);
                    }
                });
            }
        }

        if (stunStateChanged) {
            io.to(roomCode).emit('state-update', { roomCode, players: getRoomPlayers(roomCode) });
        }

        // --- Win detection ---
        const winX  = rc ? rc.winX : 700;
        // Debug log every 2s (120 ticks) to track object position
        if (!room._debugTick) room._debugTick = 0;
        room._debugTick++;
        if (room._debugTick % 120 === 0) {
            console.log(`[Room ${roomCode}] Round ${room.round} | physics.x=${room.physics.x.toFixed(1)} | winX=${winX} | transitioning=${!!room._transitioning}`);
        }
        if (room.physics.x > winX && !room._transitioning) {
            room._transitioning = true;
            console.log(`[Room ${roomCode}] Round ${room.round} complete! Object at x=${room.physics.x.toFixed(0)}`);
            advanceRound(roomCode);
            // Unlock transition flag after the delay has passed
            setTimeout(() => {
                if (rooms[roomCode]) rooms[roomCode]._transitioning = false;
            }, 4000);
        }

        // --- Broadcast physics state ---
        const stunnedIds = playerList.filter(p => p.stunned).map(p => p.nodeId);
        io.to(roomCode).emit('physics-sync', {
            roomCode,
            x:            room.physics.x,
            y:            room.physics.y,
            angle:        room.physics.angle,
            vx:           room.physics.vx,
            vy:           room.physics.vy,
            vRot:         room.physics.vRot,
            round:        room.round,
            stunCount:    room.stunCount !== undefined ? room.stunCount : 2,
            stunnedNodes: stunnedIds,
            timestamp:    now
        });
    }
}, 1000 / TICK_RATE);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Swarm Maze Server running on http://localhost:${PORT}`));