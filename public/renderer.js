import { CONFIG } from './config.js';

export class MazeRenderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx    = canvas.getContext('2d');
        this.roundIndex = 0; // 0-indexed
    }

    setRound(roundIndex) {
        this.roundIndex = roundIndex;
        const rc = CONFIG.rounds[roundIndex] || CONFIG.rounds[0];
        const m  = CONFIG.maze;
        const targetW = rc.mazeWidth  || m.width;
        const targetH = rc.mazeHeight || m.height;
        if (this.canvas.width !== targetW || this.canvas.height !== targetH) {
            this.canvas.width  = targetW;
            this.canvas.height = targetH;
        }
    }

    // Build wall list for a given round (mirrors physics.js logic)
    getWallsForRound(roundIndex) {
        const walls = [];
        const m  = CONFIG.maze;
        const rc = CONFIG.rounds[roundIndex] || CONFIG.rounds[0];
        const mazeW = rc.mazeWidth  || m.width;
        const mazeH = rc.mazeHeight || m.height;

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
                gapCentreY = mazeH / 2;
            }

            const gapTop    = gapCentreY - rc.slitWidth / 2;
            const gapBottom = gapCentreY + rc.slitWidth / 2;

            if (gapTop > 16)
                walls.push({ x: wx, y: 0,          w: rc.wallThickness, h: gapTop });
            if (gapBottom < mazeH - 16)
                walls.push({ x: wx, y: gapBottom,  w: rc.wallThickness, h: mazeH - gapBottom });
        }
        return walls;
    }

    render(physicsObj, playerDataList, myNodeId, stunnedNodes = []) {
        const ctx = this.ctx;
        const m   = CONFIG.maze;
        const rc  = CONFIG.rounds[this.roundIndex] || CONFIG.rounds[0];
        const currentWidth  = rc.mazeWidth  || m.width;
        const currentHeight = rc.mazeHeight || m.height;
        const walls = this.getWallsForRound(this.roundIndex);

        // Keep canvas pixel buffer in sync with round dimensions
        if (this.canvas.width !== currentWidth || this.canvas.height !== currentHeight) {
            this.canvas.width  = currentWidth;
            this.canvas.height = currentHeight;
        }

        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Floor / Canvas Background
        const bgColor = this.roundIndex === 1 ? '#1a0f0f' : m.backgroundColor;
        ctx.fillStyle = bgColor;
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Subtle grid
        ctx.strokeStyle = this.roundIndex === 1 ? 'rgba(255,80,80,0.06)' : 'rgba(0,0,0,0.04)';
        ctx.lineWidth = 1;
        for (let x = 40; x < currentWidth; x += 40) {
            ctx.beginPath(); ctx.moveTo(x, 16); ctx.lineTo(x, currentHeight - 16); ctx.stroke();
        }
        for (let y = 40; y < currentHeight; y += 40) {
            ctx.beginPath(); ctx.moveTo(16, y); ctx.lineTo(currentWidth - 16, y); ctx.stroke();
        }

        // Chamber labels
        ctx.font = '600 11px system-ui, sans-serif';
        ctx.fillStyle = this.roundIndex === 1 ? 'rgba(255,80,80,0.4)' : 'rgba(68,64,60,0.35)';
        ctx.textAlign = 'center';
        if (this.roundIndex === 0) {
            ctx.fillText('CHAMBER 1', 158, 38);
            ctx.fillText('CHAMBER 2 (SLIT 1 & 2)', 439, 38);
            ctx.fillText('CHAMBER 3 (NEST)', 675, 38);
        } else {
            ctx.fillText('ZONE A', 153, 38);
            ctx.fillText('ZONE B', 429, 38);
            ctx.fillText('ZONE C', 679, 38);
            ctx.fillText('ZONE D', 939, 38);
            ctx.fillText('ZONE E (NEST)', 1167, 38);
        }

        // Nest Target Area
        const nestX = this.roundIndex === 1 ? 1070 : (currentWidth - 160);
        const nestW = this.roundIndex === 1 ? 194 : 144;
        ctx.fillStyle = 'rgba(34, 197, 94, 0.12)';
        ctx.fillRect(nestX, 16, nestW, currentHeight - 32);
        ctx.strokeStyle = '#22c55e';
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 6]);
        ctx.strokeRect(nestX, 16, nestW, currentHeight - 32);
        ctx.setLineDash([]);
        ctx.fillStyle = '#15803d';
        ctx.font = 'bold 13px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('NEST GOAL ➔', nestX + nestW / 2, currentHeight / 2);

        // Walls
        ctx.fillStyle = m.wallColor;
        walls.forEach(w => {
            ctx.fillStyle = m.wallColor;
            ctx.fillRect(w.x, w.y, w.w, w.h);
            ctx.fillStyle = 'rgba(255,255,255,0.08)';
            ctx.fillRect(w.x, w.y, w.w, 2);
        });

        // Gap aperture markers (red tick marks at correct zigzag positions)
        for (let i = 0; i < rc.numWalls; i++) {
            const wx = rc.startX + i * rc.wallSpacing;
            let gapCentreY;
            if (rc.zigzag && rc.zigzagOffsets.length > i) {
                gapCentreY = rc.zigzagOffsets[i];
            } else {
                gapCentreY = currentHeight / 2;
            }
            const gapTop    = gapCentreY - rc.slitWidth / 2;
            const gapBottom = gapCentreY + rc.slitWidth / 2;

            ctx.fillStyle = this.roundIndex === 1 ? '#f97316' : '#ef4444';
            ctx.fillRect(wx - 2, gapTop - 2,    rc.wallThickness + 4, 3);
            ctx.fillRect(wx - 2, gapBottom - 1, rc.wallThickness + 4, 3);

            // Zigzag path arrow hints (Round 2 only)
            if (this.roundIndex === 1) {
                if (i < rc.numWalls - 1) {
                    const nextWx = rc.startX + (i + 1) * rc.wallSpacing;
                    const nextGapCY = rc.zigzagOffsets[i + 1];
                    ctx.strokeStyle = 'rgba(251,146,60,0.25)';
                    ctx.lineWidth = 2;
                    ctx.setLineDash([6, 8]);
                    ctx.beginPath();
                    ctx.moveTo(wx + rc.wallThickness, gapCentreY);
                    ctx.lineTo(nextWx, nextGapCY);
                    ctx.stroke();
                    ctx.setLineDash([]);
                } else {
                    // Line from last wall to Nest Goal
                    ctx.strokeStyle = 'rgba(34,197,94,0.3)';
                    ctx.lineWidth = 2;
                    ctx.setLineDash([6, 8]);
                    ctx.beginPath();
                    ctx.moveTo(wx + rc.wallThickness, gapCentreY);
                    ctx.lineTo(nestX, currentHeight / 2);
                    ctx.stroke();
                    ctx.setLineDash([]);
                }
            }
        }

        // T-Object
        ctx.save();
        ctx.translate(physicsObj.x, physicsObj.y);
        ctx.rotate(physicsObj.angle);

        const o  = CONFIG.object;
        const hw = physicsObj.headWidth  ?? rc.headWidth;
        const hh = physicsObj.headHeight ?? rc.headHeight;

        ctx.fillStyle   = o.color;
        ctx.strokeStyle = '#7f1d1d';
        ctx.lineWidth   = 2.5;
        ctx.beginPath();
        ctx.rect(-hw / 2,       -hh - physicsObj.comY, hw, hh);
        ctx.rect(-o.stemWidth/2, -physicsObj.comY,       o.stemWidth, o.stemLength);
        ctx.rect(-o.baseWidth/2,  o.stemLength - physicsObj.comY, o.baseWidth, o.baseHeight);
        ctx.fill();
        ctx.stroke();

        // CoM dot
        ctx.beginPath();
        ctx.arc(0, 0, 3, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 1;
        ctx.stroke();

        // Apex arrow
        ctx.fillStyle = 'rgba(255,255,255,0.6)';
        ctx.beginPath();
        ctx.moveTo(0, -hh - physicsObj.comY + 4);
        ctx.lineTo(-5, -physicsObj.comY + 2);
        ctx.lineTo( 5, -physicsObj.comY + 2);
        ctx.closePath();
        ctx.fill();

        ctx.restore();

        // Node circles + force arrows
        const nodes  = physicsObj.getNodePositions(playerDataList.length);
        const cos    = Math.cos(physicsObj.angle);
        const sin    = Math.sin(physicsObj.angle);
        const stunSet = new Set(stunnedNodes);

        nodes.forEach((node, idx) => {
            const player = playerDataList[idx];
            const isMe   = node.id === myNodeId;
            const isStunned = stunSet.has(node.id);

            const wx = physicsObj.x + (node.rx * cos - node.ry * sin);
            const wy = physicsObj.y + (node.rx * sin + node.ry * cos);

            // Force arrow (skip if stunned)
            if (!isStunned && player && player.vector) {
                const vx  = Number(player.vector.x) || 0;
                const vy  = Number(player.vector.y) || 0;
                const mag = Math.hypot(vx, vy);

                if (mag > 0.05) {
                    const arrowLen = Math.min(mag * 45, 55);
                    const tx = wx + (vx / mag) * arrowLen;
                    const ty = wy + (vy / mag) * arrowLen;

                    ctx.strokeStyle = node.color;
                    ctx.lineWidth   = isMe ? 3.5 : 2.5;
                    ctx.beginPath(); ctx.moveTo(wx, wy); ctx.lineTo(tx, ty); ctx.stroke();

                    const ang     = Math.atan2(ty - wy, tx - wx);
                    const headLen = 8;
                    ctx.fillStyle = node.color;
                    ctx.beginPath();
                    ctx.moveTo(tx, ty);
                    ctx.lineTo(tx - headLen * Math.cos(ang - Math.PI / 6), ty - headLen * Math.sin(ang - Math.PI / 6));
                    ctx.lineTo(tx - headLen * Math.cos(ang + Math.PI / 6), ty - headLen * Math.sin(ang + Math.PI / 6));
                    ctx.closePath();
                    ctx.fill();
                }
            }

            // Node circle
            ctx.save();
            const nodeColor = isStunned ? '#6b7280' : (node.color || '#38bdf8');
            if (isStunned) {
                ctx.shadowColor = '#ef4444';
                ctx.shadowBlur  = 12;
                ctx.strokeStyle = '#ef4444';
                ctx.lineWidth   = 3;
            } else if (isMe) {
                ctx.shadowColor = '#facc15';
                ctx.shadowBlur  = 10;
                ctx.strokeStyle = '#facc15';
                ctx.lineWidth   = 3;
            } else {
                ctx.strokeStyle = '#0f172a';
                ctx.lineWidth   = 1.5;
            }

            ctx.fillStyle = nodeColor;
            ctx.beginPath();
            ctx.arc(wx, wy, isMe ? 10 : 7.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            ctx.restore();

            // Stun lightning bolt ⚡ label
            if (isStunned) {
                ctx.fillStyle = '#ef4444';
                ctx.font = 'bold 13px system-ui';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('⚡', wx, wy - 18);
            }

            // Node ID number
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 9px system-ui, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(node.id, wx, wy);
        });
    }
}