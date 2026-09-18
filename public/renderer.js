import { CONFIG } from './config.js';

export class MazeRenderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.walls = this.generateWalls();
    }

    generateWalls() {
        const walls = [];
        const m = CONFIG.maze;

        // Outer Boundaries
        walls.push({ x: 0, y: 0, w: m.width, h: 16 });
        walls.push({ x: 0, y: m.height - 16, w: m.width, h: 16 });
        walls.push({ x: 0, y: 0, w: 16, h: m.height });
        walls.push({ x: m.width - 16, y: 0, w: 16, h: m.height });

        // Barrier Slit Walls
        const startX = 300;
        for (let i = 0; i < m.numWalls; i++) {
            const wx = startX + i * m.wallSpacing;
            const topH = (m.height - m.slitWidth) / 2;
            walls.push({ x: wx, y: 0, w: m.wallThickness, h: topH });
            walls.push({ x: wx, y: topH + m.slitWidth, w: m.wallThickness, h: topH });
        }
        return walls;
    }

    render(physicsObj, playerDataList, myNodeId) {
        const ctx = this.ctx;
        const m = CONFIG.maze;

        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Floor / Canvas Background
        ctx.fillStyle = m.backgroundColor;
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Chamber Zone Markers & Subtle Grid
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.04)';
        ctx.lineWidth = 1;
        for (let x = 40; x < m.width; x += 40) {
            ctx.beginPath();
            ctx.moveTo(x, 16);
            ctx.lineTo(x, m.height - 16);
            ctx.stroke();
        }
        for (let y = 40; y < m.height; y += 40) {
            ctx.beginPath();
            ctx.moveTo(16, y);
            ctx.lineTo(m.width - 16, y);
            ctx.stroke();
        }

        // Chamber zone labels
        ctx.font = '600 11px system-ui, sans-serif';
        ctx.fillStyle = 'rgba(68, 64, 60, 0.35)';
        ctx.textAlign = 'center';
        ctx.fillText('CHAMBER 1', 158, 38);
        ctx.fillText('CHAMBER 2 (SLIT 1 & 2)', 439, 38);
        ctx.fillText('CHAMBER 3 (NEST)', 675, 38);

        // Nest Target Area (Right side)
        const nestX = m.width - 160;
        const nestW = 144;
        ctx.fillStyle = 'rgba(34, 197, 94, 0.15)';
        ctx.fillRect(nestX, 16, nestW, m.height - 32);

        // Nest dashed border
        ctx.strokeStyle = '#22c55e';
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 6]);
        ctx.strokeRect(nestX, 16, nestW, m.height - 32);
        ctx.setLineDash([]);

        ctx.fillStyle = '#15803d';
        ctx.font = 'bold 14px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('NEST GOAL ➔', nestX + nestW / 2, m.height / 2);

        // Walls
        ctx.fillStyle = m.wallColor;
        this.walls.forEach(w => {
            ctx.fillRect(w.x, w.y, w.w, w.h);
            // Subtle bevel highlight
            ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
            ctx.fillRect(w.x, w.y, w.w, 2);
            ctx.fillStyle = m.wallColor;
        });

        // Slit Aperture Indicators (Red/Amber tick marks)
        ctx.fillStyle = '#ef4444';
        const startX = 300;
        for (let i = 0; i < m.numWalls; i++) {
            const wx = startX + i * m.wallSpacing;
            const topH = (m.height - m.slitWidth) / 2;
            ctx.fillRect(wx - 2, topH - 2, m.wallThickness + 4, 3);
            ctx.fillRect(wx - 2, topH + m.slitWidth - 1, m.wallThickness + 4, 3);
        }

        // Render T-Object
        ctx.save();
        ctx.translate(physicsObj.x, physicsObj.y);
        ctx.rotate(physicsObj.angle);

        const o = CONFIG.object;
        ctx.fillStyle = o.color;
        ctx.strokeStyle = '#7f1d1d';
        ctx.lineWidth = 2.5;

        ctx.beginPath();
        // Top Apex
        ctx.rect(-o.headWidth / 2, -o.headHeight - physicsObj.comY, o.headWidth, o.headHeight);
        // Stem
        ctx.rect(-o.stemWidth / 2, -physicsObj.comY, o.stemWidth, o.stemLength);
        // Base
        ctx.rect(-o.baseWidth / 2, o.stemLength - physicsObj.comY, o.baseWidth, o.baseHeight);
        ctx.fill();
        ctx.stroke();

        // Object Center of Mass indicator
        ctx.beginPath();
        ctx.arc(0, 0, 3, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 1;
        ctx.stroke();

        // Apex Direction Indicator (Arrow pointing toward narrow apex)
        ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.beginPath();
        ctx.moveTo(0, -o.headHeight - physicsObj.comY + 4);
        ctx.lineTo(-5, -physicsObj.comY + 2);
        ctx.lineTo(5, -physicsObj.comY + 2);
        ctx.closePath();
        ctx.fill();

        ctx.restore();

        // Render Nodes and Live Force Vectors in World Coordinates
        const nodes = physicsObj.getNodePositions(playerDataList.length);
        const cos = Math.cos(physicsObj.angle);
        const sin = Math.sin(physicsObj.angle);

        nodes.forEach((node, idx) => {
            const player = playerDataList[idx];
            const isMe = node.id === myNodeId;

            // World position of node
            const wx = physicsObj.x + (node.rx * cos - node.ry * sin);
            const wy = physicsObj.y + (node.rx * sin + node.ry * cos);

            // 1. Force Vector Arrow
            if (player && player.vector) {
                const vx = Number(player.vector.x) || 0;
                const vy = Number(player.vector.y) || 0;
                const mag = Math.hypot(vx, vy);

                if (mag > 0.05) {
                    const arrowLen = Math.min(mag * 45, 55);
                    const tx = wx + (vx / mag) * arrowLen;
                    const ty = wy + (vy / mag) * arrowLen;

                    ctx.strokeStyle = node.color || '#38bdf8';
                    ctx.lineWidth = isMe ? 3.5 : 2.5;
                    ctx.beginPath();
                    ctx.moveTo(wx, wy);
                    ctx.lineTo(tx, ty);
                    ctx.stroke();

                    // Arrowhead
                    const angle = Math.atan2(ty - wy, tx - wx);
                    const headLen = 8;
                    ctx.fillStyle = node.color || '#38bdf8';
                    ctx.beginPath();
                    ctx.moveTo(tx, ty);
                    ctx.lineTo(tx - headLen * Math.cos(angle - Math.PI / 6), ty - headLen * Math.sin(angle - Math.PI / 6));
                    ctx.lineTo(tx - headLen * Math.cos(angle + Math.PI / 6), ty - headLen * Math.sin(angle + Math.PI / 6));
                    ctx.closePath();
                    ctx.fill();
                }
            }

            // 2. Node Circle
            ctx.save();
            if (isMe) {
                // Pulsing glow for the local player
                ctx.shadowColor = '#facc15';
                ctx.shadowBlur = 10;
                ctx.strokeStyle = '#facc15';
                ctx.lineWidth = 3;
            } else {
                ctx.strokeStyle = '#0f172a';
                ctx.lineWidth = 1.5;
            }

            ctx.fillStyle = node.color || '#38bdf8';
            ctx.beginPath();
            ctx.arc(wx, wy, isMe ? 10 : 7.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            ctx.restore();

            // 3. Node ID Number
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 9px system-ui, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(node.id, wx, wy);
        });
    }
}