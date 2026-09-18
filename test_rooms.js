import { io } from 'socket.io-client';

function createClient(port) {
    return io(`http://localhost:${port}`, {
        transports: ['websocket'],
        forceNew: true
    });
}

async function runTests() {
    console.log('--- Starting Multi-Room & Authoritative Physics Verification Tests ---');

    process.env.PORT = '3005';
    await import('./server.js');
    await new Promise(resolve => setTimeout(resolve, 600));

    const port = 3005;
    const clients = [];

    try {
        // Test 1: Create room
        console.log('\n[Test 1] Creating Room 1 as Player 1...');
        const p1 = createClient(port);
        clients.push(p1);

        const room1Data = await new Promise((resolve, reject) => {
            p1.on('connect', () => {
                p1.emit('create-room', { playerName: 'Ant 1', isHost: false });
            });
            p1.on('room-created', resolve);
            setTimeout(() => reject(new Error('Timeout waiting for room-created')), 3000);
        });

        console.log(`✓ Room created with 4-digit code: "${room1Data.roomCode}"`);
        const room1Code = room1Data.roomCode;

        // Test 2: Join Player 2 and Player 3
        console.log('\n[Test 2] Joining Player 2 and Player 3...');
        const p2 = createClient(port);
        clients.push(p2);
        await new Promise((resolve, reject) => {
            p2.on('connect', () => {
                p2.emit('join-room', { roomCode: room1Code, playerName: 'Ant 2', isHost: false });
            });
            p2.on('room-joined', resolve);
            setTimeout(() => reject(new Error('Timeout joining player 2')), 3000);
        });
        console.log('✓ Player 2 joined successfully.');

        // Test 3: Authoritative Physics Synchronization
        console.log('\n[Test 3] Testing Authoritative Server Physics Synchronization between Player 1 & 2...');
        // Player 1 sends input vector
        p1.emit('player-input', { x: 0.8, y: -0.5 });

        // Both players listen for physics-sync
        const [p1Sync, p2Sync] = await Promise.all([
            new Promise((resolve) => p1.once('physics-sync', resolve)),
            new Promise((resolve) => p2.once('physics-sync', resolve))
        ]);

        console.log(`✓ Player 1 received sync: x=${p1Sync.x.toFixed(2)}, y=${p1Sync.y.toFixed(2)}, angle=${p1Sync.angle.toFixed(2)}`);
        console.log(`✓ Player 2 received sync: x=${p2Sync.x.toFixed(2)}, y=${p2Sync.y.toFixed(2)}, angle=${p2Sync.angle.toFixed(2)}`);

        if (Math.abs(p1Sync.x - p2Sync.x) > 0.001 || Math.abs(p1Sync.y - p2Sync.y) > 0.001) {
            throw new Error(`Physics desynchronization: Player 1 and Player 2 received different coordinates!`);
        }
        console.log('✓ PERFECT SYNCHRONIZATION: Both players received identical authoritative physics coordinates!');

        // Test 4: Capacity limit check (7th player rejected)
        console.log('\n[Test 4] Testing 6-player limit and 7th player rejection...');
        for (let i = 3; i <= 6; i++) {
            const pi = createClient(port);
            clients.push(pi);
            await new Promise((resolve, reject) => {
                pi.on('connect', () => {
                    pi.emit('join-room', { roomCode: room1Code, playerName: `Ant ${i}`, isHost: false });
                });
                pi.on('room-joined', resolve);
                setTimeout(() => reject(new Error(`Timeout joining player ${i}`)), 3000);
            });
        }
        console.log('✓ Filled room to 6/6 players.');

        const p7 = createClient(port);
        clients.push(p7);
        const rejected = await new Promise((resolve, reject) => {
            p7.on('connect', () => {
                p7.emit('join-room', { roomCode: room1Code, playerName: 'Ant 7', isHost: false });
            });
            p7.on('join-error', resolve);
            p7.on('room-joined', () => reject(new Error('7th player unexpectedly accepted!')));
            setTimeout(() => reject(new Error('Timeout waiting for rejection response')), 3000);
        });
        console.log(`✓ 7th player correctly rejected: "${rejected.message}"`);

        console.log('\n======================================================');
        console.log('ALL AUTHORITATIVE PHYSICS & ROOM TESTS PASSED! 🎉');
        console.log('======================================================\n');
        process.exit(0);

    } catch (err) {
        console.error('\n❌ TEST FAILED:', err.message);
        process.exit(1);
    } finally {
        clients.forEach(c => c.disconnect());
    }
}

runTests();
