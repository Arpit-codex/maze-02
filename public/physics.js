import { CONFIG } from './config.js';

export class PhysicsEngine {
    constructor() {
        this.roundIndex = 0; // 0 = Round 1, 1 = Round 2
        this.computeCenterOfMass(0);
        this.walls = this.generateWallBoxes(0);
        this.reset();
    }

    // Switch to a specific round (0-indexed)
    setRound(roundIndex) {
        this.roundIndex = roundIndex;
        const rc = CONFIG.rounds[roundIndex];
        // Update head dimensions from round config
        this._headWidth  = rc.headWidth;
        this._headHeight = rc.headHeight;
        this.computeCenterOfMass(roundIndex);
        this.walls = this.generateWallBoxes(roundIndex);
        this.reset();
    }

    // Effective head dimensions (may vary by round)
    get headWidth()  { return this._headWidth  ?? CONFIG.rounds[0].headWidth; }
    get headHeight() { return this._headHeight ?? CONFIG.rounds[0].headHeight; }

    reset() {
        const rc = CONFIG.rounds[this.roundIndex] || CONFIG.rounds[0];
        const m  = CONFIG.maze;
        this.x = rc.spawnX !== undefined ? rc.spawnX : 140;
        this.y = rc.spawnY !== undefined ? rc.spawnY : ((rc.mazeHeight || m.height) / 2);
        this.angle = rc.spawnAngle !== undefined ? rc.spawnAngle : Math.PI / 2;
        this.vx = 0;
        this.vy = 0;
        this.vRot = 0;
    }

    // Precise Centre of Mass
    computeCenterOfMass(roundIndex) {
        const o = CONFIG.object;
        const rc = CONFIG.rounds[roundIndex] || CONFIG.rounds[0];
        const hw = rc.headWidth;
        const hh = rc.headHeight;

        const aHead  = hw * hh;
        const aStem  = o.stemWidth * o.stemLength;
        const aBase  = o.baseWidth * o.baseHeight;
        const totalArea = aHead + aStem + aBase;

        const yHead = -hh / 2;
        const yStem =  o.stemLength / 2;
        const yBase =  o.stemLength + (o.baseHeight / 2);

        this.comY = (aHead * yHead + aStem * yStem + aBase * yBase) / totalArea;
    }

    // Build wall rectangles for a given round (0-indexed)
    generateWallBoxes(roundIndex) {
        const walls = [];
        const m = CONFIG.maze;
        const rc = CONFIG.rounds[roundIndex] || CONFIG.rounds[0];
        const mazeW = rc.mazeWidth  || m.width;
        const mazeH = rc.mazeHeight || m.height;

        // Outer Boundaries
        walls.push({ x: 0,          y: 0,          w: mazeW, h: 16 });
        walls.push({ x: 0,          y: mazeH - 16, w: mazeW, h: 16 });
        walls.push({ x: 0,          y: 0,          w: 16,    h: mazeH });
        walls.push({ x: mazeW - 16, y: 0,          w: 16,    h: mazeH });

        for (let i = 0; i < rc.numWalls; i++) {
            const wx = rc.startX + i * rc.wallSpacing;

            let gapCentreY;
            if (rc.zigzag && rc.zigzagOffsets.length > i) {
                gapCentreY = rc.zigzagOffsets[i];
            } else {
                gapCentreY = m.height / 2;
            }

            const gapTop    = gapCentreY - rc.slitWidth / 2;
            const gapBottom = gapCentreY + rc.slitWidth / 2;

            // Top wall segment (from canvas top to gap)
            if (gapTop > 16) {
                walls.push({ x: wx, y: 0, w: rc.wallThickness, h: gapTop });
            }
            // Bottom wall segment (from gap to canvas bottom)
            if (gapBottom < m.height - 16) {
                walls.push({ x: wx, y: gapBottom, w: rc.wallThickness, h: m.height - gapBottom });
            }
        }
        return walls;
    }

    // Returns node attachment points for N players
    getNodePositions(numPlayers) {
        const o  = CONFIG.object;
        const hw = this.headWidth;
        const hh = this.headHeight;

        const nodeLayout = [
            { id: 1, name: 'Apex Left',   rx: -hw / 2,             ry: -hh / 2 - this.comY,                    color: '#38bdf8' },
            { id: 2, name: 'Apex Right',  rx:  hw / 2,             ry: -hh / 2 - this.comY,                    color: '#f43f5e' },
            { id: 3, name: 'Stem Right',  rx:  o.stemWidth / 2 + 4, ry: o.stemLength * 0.45 - this.comY,       color: '#10b981' },
            { id: 4, name: 'Base Right',  rx:  o.baseWidth / 2,    ry: o.stemLength + o.baseHeight / 2 - this.comY, color: '#f59e0b' },
            { id: 5, name: 'Base Left',   rx: -o.baseWidth / 2,    ry: o.stemLength + o.baseHeight / 2 - this.comY, color: '#a855f7' },
            { id: 6, name: 'Stem Left',   rx: -o.stemWidth / 2 - 4, ry: o.stemLength * 0.45 - this.comY,      color: '#06b6d4' }
        ];

        const count = Math.min(Math.max(1, numPlayers), 6);
        return nodeLayout.slice(0, count);
    }

    // Dense perimeter collision points (world-space)
    getCollisionPoints() {
        const o  = CONFIG.object;
        const hw = this.headWidth;
        const hh = this.headHeight;

        const vertices = [
            { x: -hw / 2,        y: -hh - this.comY },
            { x:  hw / 2,        y: -hh - this.comY },
            { x:  hw / 2,        y: -this.comY },
            { x:  o.stemWidth/2, y: -this.comY },
            { x:  o.stemWidth/2, y:  o.stemLength - this.comY },
            { x:  o.baseWidth/2, y:  o.stemLength - this.comY },
            { x:  o.baseWidth/2, y:  o.stemLength + o.baseHeight - this.comY },
            { x: -o.baseWidth/2, y:  o.stemLength + o.baseHeight - this.comY },
            { x: -o.baseWidth/2, y:  o.stemLength - this.comY },
            { x: -o.stemWidth/2, y:  o.stemLength - this.comY },
            { x: -o.stemWidth/2, y: -this.comY },
            { x: -hw / 2,        y: -this.comY }
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

    // Returns the first contact point world-position (null if no contact within margin)
    getFirstContactPoint(margin = 6) {
        const points = this.getCollisionPoints();
        for (const p of points) {
            for (const w of this.walls) {
                if (p.x >= w.x - margin && p.x <= w.x + w.w + margin &&
                    p.y >= w.y - margin && p.y <= w.y + w.h + margin) {
                    return { x: p.x, y: p.y };
                }
            }
        }
        return null;
    }

    // For stun targeting: returns playerList sorted by their node's distance to the nearest contact point
    // Used by server in all rounds to identify which nodes to stun
    getContactNodeDistances(playerList, contactPoint = null) {
        const contact = contactPoint || this.getFirstContactPoint(6);
        if (!contact || playerList.length === 0) return [];

        const allNodes = this.getNodePositions(6);
        const cos      = Math.cos(this.angle);
        const sin      = Math.sin(this.angle);

        return playerList.map((player, idx) => {
            const node = allNodes.find(n => n.id === player.nodeId) || allNodes[idx] || allNodes[0];
            const wx   = this.x + (node.rx * cos - node.ry * sin);
            const wy   = this.y + (node.rx * sin + node.ry * cos);
            const dist = Math.hypot(wx - contact.x, wy - contact.y);
            return { playerId: player.id, nodeId: player.nodeId, dist };
        }).sort((a, b) => a.dist - b.dist);
    }

    // Push the object out of any wall it's currently resting inside
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

            // Skip stunned players (Round 2 wall-contact penalty)
            if (player.stunned) return;

            const fx = player.vector?.x || 0;
            const fy = player.vector?.y || 0;

            netFx += fx;
            netFy += fy;

            const rWorldX = (node.rx * cos) - (node.ry * sin);
            const rWorldY = (node.rx * sin) + (node.ry * cos);
            netTorque += (rWorldX * fy) - (rWorldY * fx);
        });

        this.vx   = (this.vx   + netFx    * CONFIG.physics.linearForceScale) * CONFIG.physics.friction;
        this.vy   = (this.vy   + netFy    * CONFIG.physics.linearForceScale) * CONFIG.physics.friction;
        this.vRot = (this.vRot + netTorque * CONFIG.physics.torqueScale)      * CONFIG.physics.angularFriction;

        const steps = CONFIG.physics.subSteps;
        const dtX   = this.vx   / steps;
        const dtY   = this.vy   / steps;
        const dtRot = this.vRot / steps;

        for (let s = 0; s < steps; s++) {
            if (dtX !== 0) {
                const prevX = this.x;
                this.x += dtX;
                if (this.checkWallCollisions()) { this.x = prevX; this.vx = 0; }
            }
            if (dtY !== 0) {
                const prevY = this.y;
                this.y += dtY;
                if (this.checkWallCollisions()) { this.y = prevY; this.vy = 0; }
            }
            if (dtRot !== 0) {
                const prevAngle = this.angle;
                this.angle += dtRot;
                if (this.checkWallCollisions()) { this.angle = prevAngle; this.vRot = 0; }
            }
            this.resolveContactPenetration();
        }
    }
}