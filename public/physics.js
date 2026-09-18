import { CONFIG } from './config.js';

export class PhysicsEngine {
    constructor() {
        this.computeCenterOfMass();
        this.walls = this.generateWallBoxes();
        this.reset();
    }

    reset() {
        this.x = 140;
        this.y = CONFIG.maze.height / 2;
        this.angle = Math.PI / 2; // Start vertically aligned to fit initial chamber
        this.vx = 0;
        this.vy = 0;
        this.vRot = 0;
    }

    // Precise Center of Mass reflecting the heavy W_base bottom stance
    computeCenterOfMass() {
        const o = CONFIG.object;
        const aHead = o.headWidth * o.headHeight;
        const aStem = o.stemWidth * o.stemLength;
        const aBase = o.baseWidth * o.baseHeight;
        const totalArea = aHead + aStem + aBase;

        const yHead = -o.headHeight / 2;
        const yStem = o.stemLength / 2;
        const yBase = o.stemLength + (o.baseHeight / 2);

        this.comY = (aHead * yHead + aStem * yStem + aBase * yBase) / totalArea;
    }

    generateWallBoxes() {
        const walls = [];
        const m = CONFIG.maze;

        // Outer Boundaries
        walls.push({ x: 0, y: 0, w: m.width, h: 16 });
        walls.push({ x: 0, y: m.height - 16, w: m.width, h: 16 });
        walls.push({ x: 0, y: 0, w: 16, h: m.height });
        walls.push({ x: m.width - 16, y: 0, w: 16, h: m.height });

        // Barrier Walls with 0.5x Gap Apertures
        const startX = 300;
        for (let i = 0; i < m.numWalls; i++) {
            const wx = startX + i * m.wallSpacing;
            const topH = (m.height - m.slitWidth) / 2;
            walls.push({ x: wx, y: 0, w: m.wallThickness, h: topH });
            walls.push({ x: wx, y: topH + m.slitWidth, w: m.wallThickness, h: topH });
        }
        return walls;
    }

    getNodePositions(numPlayers) {
        const o = CONFIG.object;
        // 6 distinct attachment points around the T-shape perimeter
        const nodeLayout = [
            { id: 1, name: 'Apex Left', rx: -o.headWidth / 2, ry: -o.headHeight / 2 - this.comY, color: '#38bdf8' },
            { id: 2, name: 'Apex Right', rx: o.headWidth / 2, ry: -o.headHeight / 2 - this.comY, color: '#f43f5e' },
            { id: 3, name: 'Stem Right', rx: o.stemWidth / 2 + 4, ry: o.stemLength * 0.45 - this.comY, color: '#10b981' },
            { id: 4, name: 'Base Right', rx: o.baseWidth / 2, ry: o.stemLength + o.baseHeight / 2 - this.comY, color: '#f59e0b' },
            { id: 5, name: 'Base Left', rx: -o.baseWidth / 2, ry: o.stemLength + o.baseHeight / 2 - this.comY, color: '#a855f7' },
            { id: 6, name: 'Stem Left', rx: -o.stemWidth / 2 - 4, ry: o.stemLength * 0.45 - this.comY, color: '#06b6d4' }
        ];

        const count = Math.min(Math.max(1, numPlayers), 6);
        return nodeLayout.slice(0, count);
    }

    getCollisionPoints() {
        const o = CONFIG.object;
        const vertices = [
            { x: -o.headWidth / 2, y: -o.headHeight - this.comY },
            { x: o.headWidth / 2, y: -o.headHeight - this.comY },
            { x: o.headWidth / 2, y: -this.comY },
            { x: o.stemWidth / 2, y: -this.comY },
            { x: o.stemWidth / 2, y: o.stemLength - this.comY },
            { x: o.baseWidth / 2, y: o.stemLength - this.comY },
            { x: o.baseWidth / 2, y: o.stemLength + o.baseHeight - this.comY },
            { x: -o.baseWidth / 2, y: o.stemLength + o.baseHeight - this.comY },
            { x: -o.baseWidth / 2, y: o.stemLength - this.comY },
            { x: -o.stemWidth / 2, y: o.stemLength - this.comY },
            { x: -o.stemWidth / 2, y: -this.comY },
            { x: -o.headWidth / 2, y: -this.comY }
        ];

        const densePoints = [];
        for (let i = 0; i < vertices.length; i++) {
            const p1 = vertices[i];
            const p2 = vertices[(i + 1) % vertices.length];
            const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
            const subdivisions = Math.max(1, Math.ceil(dist / 14));
            for (let s = 0; s < subdivisions; s++) {
                const t = s / subdivisions;
                densePoints.push({
                    x: p1.x + (p2.x - p1.x) * t,
                    y: p1.y + (p2.y - p1.y) * t
                });
            }
        }

        const cos = Math.cos(this.angle);
        const sin = Math.sin(this.angle);

        return densePoints.map(p => ({
            x: this.x + (p.x * cos - p.y * sin),
            y: this.y + (p.x * sin + p.y * cos)
        }));
    }

    checkWallCollisions() {
        const points = this.getCollisionPoints();
        for (const p of points) {
            for (const w of this.walls) {
                if (p.x >= w.x && p.x <= w.x + w.w && p.y >= w.y && p.y <= w.y + w.h) {
                    return true;
                }
            }
        }
        return false;
    }

    // Push the object out of any wall it's currently resting inside (penetration ejection)
    resolveContactPenetration() {
        const points = this.getCollisionPoints();
        let totalPushX = 0;
        let totalPushY = 0;
        let hadContact = false;

        for (const p of points) {
            for (const w of this.walls) {
                if (p.x > w.x && p.x < w.x + w.w && p.y > w.y && p.y < w.y + w.h) {
                    const dLeft   = p.x - w.x;
                    const dRight  = (w.x + w.w) - p.x;
                    const dTop    = p.y - w.y;
                    const dBottom = (w.y + w.h) - p.y;
                    const minD    = Math.min(dLeft, dRight, dTop, dBottom);

                    if (minD === dLeft)        totalPushX -= dLeft   + 0.5;
                    else if (minD === dRight)  totalPushX += dRight  + 0.5;
                    else if (minD === dTop)    totalPushY -= dTop    + 0.5;
                    else                       totalPushY += dBottom + 0.5;

                    hadContact = true;
                }
            }
        }

        if (hadContact) {
            // Clamp push to prevent explosive ejection
            const maxPush = 8;
            this.x += Math.max(-maxPush, Math.min(maxPush, totalPushX));
            this.y += Math.max(-maxPush, Math.min(maxPush, totalPushY));
            if (Math.abs(totalPushX) > 0.1) this.vx *= 0.1;
            if (Math.abs(totalPushY) > 0.1) this.vy *= 0.1;
        }
    }

    update(playerDataList) {
        let netFx = 0, netFy = 0, netTorque = 0;
        const nodes = this.getNodePositions(playerDataList.length);

        const cos = Math.cos(this.angle);
        const sin = Math.sin(this.angle);

        playerDataList.forEach((player, idx) => {
            const node = nodes[idx];
            if (!node) return;

            const fx = player.vector?.x || 0;
            const fy = player.vector?.y || 0;

            netFx += fx;
            netFy += fy;

            // Rotate local node position to world orientation for accurate torque
            const rWorldX = (node.rx * cos) - (node.ry * sin);
            const rWorldY = (node.rx * sin) + (node.ry * cos);
            netTorque += (rWorldX * fy) - (rWorldY * fx);
        });

        this.vx = (this.vx + netFx * CONFIG.physics.linearForceScale) * CONFIG.physics.friction;
        this.vy = (this.vy + netFy * CONFIG.physics.linearForceScale) * CONFIG.physics.friction;
        this.vRot = (this.vRot + netTorque * CONFIG.physics.torqueScale) * CONFIG.physics.angularFriction;

        const steps = CONFIG.physics.subSteps;
        const dtX = this.vx / steps;
        const dtY = this.vy / steps;
        const dtRot = this.vRot / steps;

        // Sub-stepped Axis-Separated Integration
        // Allows smooth wall-sliding (thigmotaxis) without sticking
        for (let s = 0; s < steps; s++) {
            // 1. Step X independently
            if (dtX !== 0) {
                const prevX = this.x;
                this.x += dtX;
                if (this.checkWallCollisions()) {
                    this.x = prevX;
                    this.vx = 0;
                }
            }

            // 2. Step Y independently
            if (dtY !== 0) {
                const prevY = this.y;
                this.y += dtY;
                if (this.checkWallCollisions()) {
                    this.y = prevY;
                    this.vy = 0;
                }
            }

            // 3. Step Rotation independently
            if (dtRot !== 0) {
                const prevAngle = this.angle;
                this.angle += dtRot;
                if (this.checkWallCollisions()) {
                    this.angle = prevAngle;
                    this.vRot = 0;
                }
            }

            // 4. Ensure no resting penetration traps the object
            this.resolveContactPenetration();
        }
    }
}