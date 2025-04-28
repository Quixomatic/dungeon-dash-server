# Dungeon Dash Royale: Project Documentation

## 🎮 Game Concept

Dungeon Dash Royale is a unique blend of roguelike and battle royale mechanics where up to 100 players navigate through procedurally generated dungeons and face off in periodic "gauntlet" battles. Players collect items, level up, and select boons during dungeon phases, then test their strength against other players in elimination rounds, with everyone starting on an equal footing in each match.

### Core Gameplay Loop

1. **Lobby Phase**
   - Players join a lobby of up to 100 participants
   - Wait for enough players to join

2. **Dungeon Phase**
   - Players navigate their individual procedurally generated dungeons
   - Collect gear and items to boost stats
   - Defeat enemies to gain XP
   - Level up and select boons/abilities (attack speed, crit chance, etc.)
   - Time-limited exploration (5-10 minutes)

3. **Gauntlet Phase**
   - Players are grouped into small "gauntlets" of 4-5 players
   - Battle with all collected gear and abilities
   - Last player standing in each gauntlet continues
   - Eliminated players can spectate or join a new game

4. **Repeat and Reduce**
   - Return to dungeon phase with surviving players
   - Next gauntlet features fewer, but more powerful players
   - Continue until only one player remains

## 🛠️ Technical Stack

### Server-Side

- **Runtime**: Node.js
- **Framework**: [Colyseus](https://colyseus.io/) (v0.16.x) for multiplayer
- **Architecture**: Room-based with state synchronization
- **Module System**: ES Modules
- **Additional Libraries**:
  - `@colyseus/schema` for efficient state synchronization
  - `@colyseus/monitor` for debugging
  - `express` for API endpoints

### Client-Side

- **Game Engine**: [Phaser 3](https://phaser.io/) (v3.60+)
- **Build Tool**: [Vite](https://vitejs.dev/)
- **Networking**: Colyseus.js client
- **Module System**: ES Modules
- **Asset Management**: Handled through Phaser's asset loading system

## 📁 Project Structure

```
dungeon-dash-royale/
├── client/                      # Phaser game client
│   ├── package.json
│   ├── index.html
│   ├── vite.config.js
│   ├── public/                 # Static assets
│   │   └── assets/
│   └── src/
│       ├── main.js             # Entry point
│       ├── managers/           # Game component managers
│       │   ├── PlayerManager.js   # Handles player creation and updates
│       │   ├── NetworkHandler.js  # Handles network communication
│       │   ├── InputHandler.js    # Handles player input
│       │   ├── UIManager.js       # Manages UI elements
│       │   └── DebugManager.js    # Debug visualization
│       ├── scenes/             # Phaser scenes
│       │   ├── LobbyScene.js   # Matchmaking lobby
│       │   ├── GameScene.js    # Main gameplay
│       │   └── ResultsScene.js # End of game
│       ├── systems/            # Game systems
│       │   ├── GameState.js    # Global game state
│       │   └── NetworkManager.js # Network communication
│       └── utils/              # Utility functions
│           ├── controls.js     # Input handling
│           └── debug.js        # Debug helpers
├── server/                     # Colyseus multiplayer server
│   ├── package.json
│   ├── index.js                # Server entry point
│   ├── rooms/                  # Game room definitions
│   │   ├── BaseRoom.js         # Base room class
│   │   └── NormalGameRoom.js   # Standard game mode
│   ├── schemas/                # Colyseus state schemas
│   │   ├── PlayerState.js
│   │   ├── GameRoomState.js
│   │   ├── Position.js
│   │   ├── Item.js
│   │   └── Ability.js
│   └── systems/                # Server-side game logic
│       ├── InputHandler.js     # Processes player inputs
│       ├── PhaseManager.js     # Manages game phases
│       ├── EventManager.js     # Handles global events
│       ├── CollisionSystem.js  # Collision detection
│       ├── LeaderboardSystem.js # Player rankings
│       └── DungeonGenerator.js # Generates dungeons
```

## 🔄 Current Progress

### Architecture Implementation
- [x] Modularized server code
- [x] Modularized client code
- [x] 60Hz fixed tick rate system
- [x] Client-side prediction with server reconciliation
- [x] Smooth interpolation for other players

### Server Features
- [x] Room creation and management
- [x] Player state tracking
- [x] Game phase management
- [x] Countdown system for game start
- [x] Event system
- [x] Input handling and validation
- [x] Leaderboard system

### Client Features
- [x] Lobby scene with connection UI
- [x] Game scene with player movement
- [x] Visual representation of other players
- [x] WASD and arrow key controls
- [x] Debug information display
- [x] Responsive local player controls
- [x] Smooth remote player movement

## 🚀 Next Steps

### Immediate Priorities
1. **Implement Dungeon Generation**
   - Create procedural dungeon generator
   - Implement room types and corridors
   - Add obstacles and collectibles

2. **Create Item and Ability System**
   - Define item types and effects
   - Implement player inventory
   - Create ability activation logic

3. **Build Combat System**
   - Implement attack mechanics
   - Create health and damage calculations
   - Add visual effects for combat

### Medium-Term Goals
1. **Add Progression Systems**
   - Create level-up mechanics
   - Implement XP rewards
   - Add skill tree for abilities

2. **Enhance Visuals**
   - Create proper character sprites
   - Add dungeon tile sets
   - Implement animations for actions

3. **Improve Game Flow**
   - Polish phase transitions
   - Add countdown timers
   - Create spectator mode

## 💻 Development Notes

### Fixed Tick Rate System
- Server runs at 60Hz (16.67ms)
- Client uses fixed timestep for movement
- Input sequencing for reconciliation
- Interpolation for smooth visuals

### Client Prediction
1. Client processes input locally immediately
2. Input is sent to server with sequence number
3. Server validates and processes input
4. Server sends acknowledgement with position
5. Client reconciles if prediction was incorrect

### Interpolation System
- Other players' positions are interpolated
- Linear interpolation factor: 0.3 (adjustable)
- Updates at client frame rate (60+ FPS)

## 🔧 Developer Setup

1. Clone the repository
2. Install dependencies:
   ```
   cd server && npm install
   cd ../client && npm install
   ```
3. Start the server:
   ```
   cd server && npm run dev
   ```
4. Start the client:
   ```
   cd client && npm run dev
   ```
5. Open browser to `http://localhost:5173`

## 📚 Key Resources

- [Colyseus Documentation](https://docs.colyseus.io/)
- [Phaser 3 Documentation](https://newdocs.phaser.io/docs/3.60.0)
- [Client-Side Prediction Guide](https://www.gabrielgambetta.com/client-side-prediction-server-reconciliation.html)