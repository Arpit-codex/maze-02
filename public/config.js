export const CONFIG = {
    // Maze & Gap Geometry (1 mm = 20 px)
    maze: {
        width: 960,
        height: 500,
        wallColor: '#44403c',
        backgroundColor: '#dcd7c9'
    },

    // Per-round configurations
    rounds: [
        {
            // Round 1 — Standard (960px screen)
            mazeWidth: 960,
            mazeHeight: 500,
            numWalls: 2,
            slitWidth: 126,
            wallSpacing: 250,
            wallThickness: 28,
            startX: 300,
            zigzag: false,           // gaps all centred
            zigzagOffsets: [],       // unused in round 1
            stunOnContact: true,
            stunDurationMs: 2500,
            winX: 700,
            headWidth: 44,
            headHeight: 30,
            spawnX: 140,
            spawnY: 250,
            spawnAngle: Math.PI / 2
        },
        {
            // Round 2 — Hard: Expanded screen (1280px), 3 zigzag walls, tighter gaps, bigger head, stun penalty
            mazeWidth: 1280,
            mazeHeight: 500,
            numWalls: 3,
            slitWidth: 122,          // tight challenge but geometrically passable
            wallSpacing: 250,
            wallThickness: 28,
            startX: 290,             // Zone A width 274px, plenty of room to spawn & turn
            zigzag: true,
            // Gap Y-centres: Top (110), Bottom (390), Center (250)
            zigzagOffsets: [110, 390, 250],
            stunOnContact: true,
            stunDurationMs: 2500,
            winX: 1040,              // Trigger win inside the expanded Nest Goal
            headWidth: 55,
            headHeight: 30,
            spawnX: 130,             // Centered in Zone A with >30px clearance from all walls
            spawnY: 250,
            spawnAngle: Math.PI / 2
        }
    ],

    // T-Object base geometry (head changes per round — see rounds[].headWidth)
    object: {
        stemWidth: 24,
        stemLength: 140,
        baseWidth: 180,
        baseHeight: 28,
        color: '#dc2626'
    },

    physics: {
        subSteps: 6,
        friction: 0.85,
        angularFriction: 0.55,
        linearForceScale: 0.16,
        torqueScale: 0.00030
    }
};