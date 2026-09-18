export const CONFIG = {
    // Maze & Gap Geometry (1 mm = 20 px)
    maze: {
        width: 960,
        height: 500,
        numWalls: 2,
        wallSpacing: 250,      // D_wall = 5.0mm -> 100px corridor width
        wallThickness: 28,
        slitWidth: 126,        // Increased by 40% (was 90px -> now 126px)
        wallColor: '#44403c',
        backgroundColor: '#dcd7c9'
    },

    // Object Geometry
    object: {
        headWidth: 44,         // Increased from 30px (visible width in screenshot)
        headHeight: 30,        // Increased from 20px (height/depth along axis)
        stemWidth: 24,
        stemLength: 140,       // L = 140px
        baseWidth: 180,        // Wide base crossbar
        baseHeight: 28,
        color: '#dc2626'
    },

    physics: {
        subSteps: 6,           // High sub-stepping for tight 0.5x gap clearances
        friction: 0.85,
        angularFriction: 0.55,
        linearForceScale: 0.16,
        torqueScale: 0.00030
    }
};