# 🎮 Swarm Maze — Cooperative Piano-Movers Puzzle

A real-time **cooperative multiplayer** physics puzzle where up to **6 players** must work together to guide a rigid T-shaped object through narrow slit walls — without any single player being able to control it alone.

Inspired by the research paper *"Comparing cooperative transport strategies"* (Dreyer et al., PNAS). Each player controls a **force node** attached to the object; success requires genuine team coordination to rotate the piece through tight gaps.

---

## 🕹️ How to Play

1. **Host** opens the game, clicks **Create Room** → gets a **4-digit code**.
2. **Players** open the game on their phones/devices, click **Join Room**, enter the code.
3. Up to **6 players** join (each controls one attachment node on the T-shape).
4. Use the **on-screen joystick** to push/pull your node.
5. Cooperate to **rotate** the T-shape to slip it through the narrow slit walls.
6. Get it to the far end of the maze to win!

> 💡 **Tip:** The base of the T is wider than the gap. You *must* rotate it to pass through — raw pushing won't work.

---

## 🧠 Key Features

| Feature | Details |
|---|---|
| **Multiplayer Rooms** | Unique 4-digit codes, up to 6 players per room |
| **Authoritative Physics** | Server-side 60 Hz physics tick — everyone sees the same object |
| **Torque Mechanics** | Forces applied off-center create realistic rotation |
| **Wall Sliding** | Axis-separated sub-stepping lets the object glide along walls |
| **Responsive UI** | Works on desktop and mobile (touch joystick) |
| **Host Display Mode** | Dedicated large-screen view for TV/projector display |

---

## 🚀 Running Locally

### Prerequisites
- [Node.js](https://nodejs.org/) **v18 or newer**

### Setup

`ash
# 1. Clone / download the project
git clone https://github.com/YOUR_USERNAME/swarm-maze.git
cd swarm-maze

# 2. Install dependencies
npm install

# 3. Start the server
npm start
`

The server starts at **http://localhost:3000**.

Open that URL in your browser to play. Share your local IP (e.g. http://192.168.1.x:3000) with others on the same Wi-Fi to play together locally.

---

## 📁 Project Structure

`
swarm-maze/
├── server.js           # Express + Socket.IO server, authoritative 60Hz physics loop
├── package.json        # Node.js dependencies and scripts
├── test_rooms.js       # Automated tests for room isolation and physics sync
│
└── public/             # All client-side files (served statically)
    ├── index.html      # Player view — joystick + game canvas
    ├── host.html       # Host/display view — full game canvas for TV screens
    ├── config.js       # Shared geometry & physics constants (server + client)
    └── physics.js      # PhysicsEngine class (shared between server and client)
`

### Key Files Explained

**server.js** — Manages room creation/joining, authoritative 60 Hz PhysicsEngine per room, and physics-sync broadcasts.

**public/physics.js** — PhysicsEngine with T-shape geometry, dense perimeter collision (14px intervals), axis-separated sub-stepping (6 substeps), and multi-point penetration ejection.

**public/config.js** — Single source of truth for all geometry, imported by both server and client.

| Constant | Value | Meaning |
|---|---|---|
| slitWidth | 126 px | Gap aperture in barrier walls |
| stemLength | 140 px | Height of the T-stem |
| aseWidth | 180 px | Width of the T-foot (wider than the gap!) |
| headWidth | 44 px | Width of the T top cap |
| subSteps | 6 | Physics substeps per 60 Hz tick |

---

## ☁️ Deploying Online (Free)

### Option A — Render (Recommended)

1. Push your code to a GitHub repository (see section below).
2. Go to [render.com](https://render.com) → **New → Web Service**.
3. Connect your GitHub repo.
4. Set:
   - **Build Command:** 
pm install
   - **Start Command:** 
pm start
   - **Environment:** Node
5. Click **Deploy** — Render gives you a URL like https://swarm-maze.onrender.com.

> ⚠️ Free Render instances sleep after 15 min of inactivity. First request after sleep takes ~30s.

### Option B — Railway

1. Go to [railway.app](https://railway.app) → **New Project → Deploy from GitHub**.
2. Connect your repo; Railway auto-detects 
pm start.
3. Your app gets a live URL instantly.

---

## 📤 Pushing to GitHub

`ash
git init
git add .
git commit -m "Initial release: Swarm Maze cooperative puzzle"

# After creating a new repo on github.com:
git remote add origin https://github.com/YOUR_USERNAME/swarm-maze.git
git branch -M main
git push -u origin main
`

---

## 🧪 Running Tests

`ash
npm test
`

Verifies: room creation, 6-player capacity limit, room isolation (physics in Room A don't affect Room B), and player re-indexing after disconnects.

---

## 🔬 Scientific Background

Each player's joystick input becomes a **force vector** at their node's position on the T-object. The torque τ = r × F drives rotation. Passing through the slit requires players to coordinate net torque to align the stem with the gap aperture — a direct playable implementation of cooperative rigid-body transport research.

> Dreyer, D. R., et al. *"Quantifying collective behavior by measuring the cooperative transport efficiency of ants carrying food items."* PNAS (2015).

---

## 📄 License

MIT — free to use, modify, and share.
