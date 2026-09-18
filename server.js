import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import { PhysicsEngine } from './public/physics.js';

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.static('public'));

// In-memory room store: roomCode -> roomData
const rooms = {};

// Generate unique 4-digit numeric code
function generateRoomCode() {
    let code;
    let attempts = 0;
    do {
        code = Math.floor(1000 + Math.random() * 9000).toString();
        attempts++;
    } while (rooms[code] && attempts < 1000);
    return code;
}

// Get ordered list of players for a room
function getRoomPlayers(roomCode) {
    if (!rooms[roomCode]) return [];
    return Object.values(rooms[roomCode].players).sort((a, b) => a.nodeId - b.nodeId);
}

// Re-index player nodeIds 1..N after changes
function reindexRoomPlayers(roomCode) {
    if (!rooms[roomCode]) return;
    const playerList = Object.values(rooms[roomCode].players).sort((a, b) => a.joinedAt - b.joinedAt);
    playerList.forEach((player, idx) => {
        player.nodeId = idx + 1;
        io.to(player.id).emit('assign-node', { 
            nodeId: player.nodeId, 
            roomCode: roomCode,
            totalPlayers: playerList.length 
        });
    });
}

// Send current authoritative physics state to a target (socket or room)
function emitPhysicsState(target, room) {
    if (!room || !room.physics) return;
    target.emit('physics-sync', {
        roomCode: room.code,
        x: room.physics.x,
        y: room.physics.y,
        angle: room.physics.angle,
        vx: room.physics.vx,
        vy: room.physics.vy,
        vRot: room.physics.vRot,
        timestamp: Date.now()
    });
}

io.on('connection', (socket) => {
    // 1. Create Room
    socket.on('create-room', (data = {}) => {
        const roomCode = generateRoomCode();
        const isHost = Boolean(data.isHost);
        const playerName = (data.playerName || 'Player 1').trim().slice(0, 16);

        const roomPhysics = new PhysicsEngine();

        rooms[roomCode] = {
            code: roomCode,
            createdAt: Date.now(),
            hostSocketId: isHost ? socket.id : null,
            physics: roomPhysics,
            players: {},
            spectators: new Set()
        };

        socket.join(roomCode);
        socket.roomCode = roomCode;
        socket.isHost = isHost;

        if (isHost) {
            rooms[roomCode].spectators.add(socket.id);
            socket.emit('room-created', {
                success: true,
                roomCode,
                isHost: true,
                players: []
            });
        } else {
            const playerObj = {
                id: socket.id,
                name: playerName,
                nodeId: 1,
                joinedAt: Date.now(),
                vector: { x: 0, y: 0 }
            };
            rooms[roomCode].players[socket.id] = playerObj;
            socket.nodeId = 1;

            socket.emit('room-created', {
                success: true,
                roomCode,
                isHost: false,
                nodeId: 1,
                players: [playerObj]
            });
            socket.emit('assign-node', { nodeId: 1, roomCode, totalPlayers: 1 });
        }

        io.to(roomCode).emit('state-update', {
            roomCode,
            players: getRoomPlayers(roomCode)
        });

        emitPhysicsState(socket, rooms[roomCode]);
        console.log(`[Room ${roomCode}] Created by ${socket.id} (${isHost ? 'Host Display' : 'Player'})`);
    });

    // 2. Join Room (Max 6 Players)
    socket.on('join-room', (data = {}) => {
        const rawCode = String(data.roomCode || '').trim();
        const roomCode = rawCode.padStart(4, '0');
        const isHost = Boolean(data.isHost);
        const playerName = (data.playerName || `Player`).trim().slice(0, 16);

        const room = rooms[roomCode];
        if (!room) {
            socket.emit('join-error', { message: `Room ${roomCode} not found. Check the 4-digit code.` });
            return;
        }

        const currentPlayersCount = Object.keys(room.players).length;

        if (!isHost && currentPlayersCount >= 6) {
            socket.emit('join-error', { message: `Room ${roomCode} is full (6/6 players joined).` });
            return;
        }

        socket.join(roomCode);
        socket.roomCode = roomCode;
        socket.isHost = isHost;

        if (isHost) {
            room.spectators.add(socket.id);
            socket.emit('room-joined', {
                success: true,
                roomCode,
                isHost: true,
                players: getRoomPlayers(roomCode)
            });
        } else {
            const assignedNodeId = currentPlayersCount + 1;
            const playerObj = {
                id: socket.id,
                name: playerName || `Player ${assignedNodeId}`,
                nodeId: assignedNodeId,
                joinedAt: Date.now(),
                vector: { x: 0, y: 0 }
            };

            room.players[socket.id] = playerObj;
            socket.nodeId = assignedNodeId;

            socket.emit('room-joined', {
                success: true,
                roomCode,
                isHost: false,
                nodeId: assignedNodeId,
                players: getRoomPlayers(roomCode)
            });

            reindexRoomPlayers(roomCode);
        }

        io.to(roomCode).emit('state-update', {
            roomCode,
            players: getRoomPlayers(roomCode)
        });

        // Send current authoritative physics state so newly joined client starts in sync
        emitPhysicsState(socket, room);

        console.log(`[Room ${roomCode}] ${socket.id} joined as ${isHost ? 'Host' : 'Player #' + socket.nodeId}. Total: ${Object.keys(room.players).length}/6`);
    });

    // 3. Directional Input from Joystick
    socket.on('player-input', (vector) => {
        const roomCode = socket.roomCode;
        if (!roomCode || !rooms[roomCode]) return;

        const player = rooms[roomCode].players[socket.id];
        if (player) {
            player.vector = {
                x: Math.max(-1, Math.min(1, Number(vector?.x) || 0)),
                y: Math.max(-1, Math.min(1, Number(vector?.y) || 0))
            };

            io.to(roomCode).emit('state-update', {
                roomCode,
                players: getRoomPlayers(roomCode)
            });
        }
    });

    // 4. Room Puzzle Reset
    socket.on('reset-puzzle', () => {
        const roomCode = socket.roomCode;
        const room = rooms[roomCode];
        if (!roomCode || !room) return;

        // Reset all player input vectors to 0
        Object.values(room.players).forEach(p => {
            p.vector = { x: 0, y: 0 };
        });

        // Reset authoritative physics
        room.physics.reset();

        io.to(roomCode).emit('puzzle-reset', {
            roomCode,
            players: getRoomPlayers(roomCode)
        });

        emitPhysicsState(io.to(roomCode), room);
        console.log(`[Room ${roomCode}] Authoritative puzzle reset by ${socket.id}`);
    });

    // 5. Player Disconnect / Leave
    const handleLeave = () => {
        const roomCode = socket.roomCode;
        if (!roomCode || !rooms[roomCode]) return;

        const room = rooms[roomCode];
        if (room.players[socket.id]) {
            delete room.players[socket.id];
            reindexRoomPlayers(roomCode);
        }
        room.spectators.delete(socket.id);

        const remainingPlayers = Object.keys(room.players).length;
        const remainingSpectators = room.spectators.size;

        io.to(roomCode).emit('state-update', {
            roomCode,
            players: getRoomPlayers(roomCode)
        });

        console.log(`[Room ${roomCode}] ${socket.id} left. Remaining: ${remainingPlayers} players`);

        // Clean up empty room
        if (remainingPlayers === 0 && remainingSpectators === 0) {
            delete rooms[roomCode];
            console.log(`[Room ${roomCode}] Cleaned up empty room.`);
        }
    };

    socket.on('leave-room', handleLeave);
    socket.on('disconnect', handleLeave);
});

// AUTHORITATIVE 60Hz PHYSICS TICK LOOP
// Runs physics simulation on server and broadcasts state to ensure 100% synchronization across all clients
const TICK_RATE = 60; // 60 updates per second
setInterval(() => {
    for (const roomCode of Object.keys(rooms)) {
        const room = rooms[roomCode];
        if (!room || !room.physics) continue;

        const playerList = Object.values(room.players);
        // Run authoritative physics step
        room.physics.update(playerList);

        // Broadcast authoritative position & angle to all clients in this room
        io.to(roomCode).emit('physics-sync', {
            roomCode,
            x: room.physics.x,
            y: room.physics.y,
            angle: room.physics.angle,
            vx: room.physics.vx,
            vy: room.physics.vy,
            vRot: room.physics.vRot,
            timestamp: Date.now()
        });
    }
}, 1000 / TICK_RATE);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Swarm Maze Server running on http://localhost:${PORT}`));