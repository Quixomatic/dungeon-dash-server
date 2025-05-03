# Dungeon Dash Royale: Project Documentation

## 🎮 Game Concept

Dungeon Dash Royale is a unique blend of roguelike and battle royale mechanics where up to 100 players navigate through procedurally generated dungeons and face off in periodic "gauntlet" battles. Players collect items, level up, and select boons during dungeon phases, then test their strength against other players in elimination rounds, with everyone starting on an equal footing in each match.

### Core Gameplay Loop

1. **Lobby Phase**
   - Players join a lobby of up to 100 participants
   - Wait for enough players to join
   - Map data is loaded and synchronized across all clients
   - Game starts only when all players have loaded the map

2. **Dungeon Exploration Phase**
   - All players spawn at different points on a large shared dungeon floor
   - Players explore the procedurally generated dungeon
   - Collect gear and items to boost stats
   - Defeat AI enemies to gain XP
   - Level up and select boons/abilities
   - Players may encounter and battle other players while exploring
   - Phase lasts for a set amount of time (5-10 minutes)

3. **Floor Collapse**
   - After the time limit, the current dungeon floor "collapses"
   - Surviving players fall to the next floor of the dungeon
   - Each new floor is smaller than the previous one
   - This forces remaining players into closer proximity

4. **Repeat Until Victory**
   - Exploration and collapse cycles continue
   - Each floor becomes increasingly dangerous
   - Player density increases as the floor size decreases
   - The last player standing wins the match

5. **Final Showdown (Optional)**
   - If the game lasts too long, a final "forced combat" phase begins
   - The remaining players are teleported to a small arena
   - A battle royale ensues until only one player remains

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
│       │   ├── DebugManager.js    # Debug visualization
│       │   └── DungeonRenderer.js # Renders the dungeon map
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
│   │   ├── StatsSchema.js      # Player stats schema
│   │   ├── GameRoomState.js
│   │   ├── Position.js
│   │   ├── Item.js
│   │   ├── DungeonSchema.js    # Compact dungeon representation
│   │   └── Ability.js
│   └── systems/                # Server-side game logic
│       ├── InputHandler.js     # Processes player inputs
│       ├── PhaseManager.js     # Manages game phases
│       ├── EventManager.js     # Handles global events
│       ├── CollisionSystem.js  # Collision detection
│       ├── LeaderboardSystem.js # Player rankings
│       ├── MapManager.js       # Manages dungeon maps
│       ├── BSPDungeonGenerator.js # Generates dungeons using BSP
│       └── RoomTemplates.js    # Room templates for dungeon generation
```

## 🔄 Current Progress

### Architecture Implementation
- [x] Modularized server code
- [x] Modularized client code
- [x] 60Hz fixed tick rate system
- [x] Client-side prediction with server reconciliation
- [x] Smooth interpolation for other players
- [x] Centralized GameState management for cross-scene state
- [x] Tile-based dungeon generation using Binary Space Partitioning

### Server Features
- [x] Room creation and management
- [x] Player state tracking
- [x] Game phase management
- [x] Countdown system for game start
- [x] Event system
- [x] Input handling and validation
- [x] Leaderboard system
- [x] Player position synchronization
- [x] Procedural dungeon generation
- [x] Spawn point allocation
- [x] Map data synchronization

### Client Features
- [x] Lobby scene with connection UI
- [x] Game scene with player movement
- [x] Visual representation of other players
- [x] WASD and arrow key controls
- [x] Debug information display
- [x] Responsive local player controls
- [x] Smooth remote player movement
- [x] Server-determined player spawn positions
- [x] Efficient dungeon rendering with culling
- [x] Minimap for navigation
- [x] Map loading synchronization
- [x] Adaptive tile size handling
- [x] Responsive UI design

## 🚀 Next Steps

### Immediate Priorities
1. **Finalize Dungeon Rendering**
   - Ensure corridors are properly rendered
   - Implement collision detection with dungeon walls
   - Fix any remaining tile rendering issues

2. **Enhance Dungeon Generation**
   - Add more room templates
   - Add environmental obstacles
   - Add collectibles and items

3. **Create Item and Ability System**
   - Define item types and effects
   - Implement player inventory
   - Create ability activation logic

4. **Build Combat System**
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

## 🔄 State Management System

We've implemented a centralized GameState system that acts as a single source of truth for all game data across scenes:

### Key Components

1. **GameState Singleton**
   - Maintains player data, game phase, and other critical information
   - Accessible from any scene or component
   - Provides event system for changes
   - Persists data between scene transitions
   - Stores map data for consistent access

2. **Server-Client Synchronization**
   - Server determines initial player positions
   - Client receives positions through welcome messages and state updates
   - GameState initialized with server-provided coordinates
   - Player Manager renders players at correct positions

3. **Schema System**
   - Using Colyseus Schema for efficient state synchronization
   - Schema definitions with `defineTypes` for proper serialization
   - MapSchema for tracking players by ID
   - Nested schemas for efficient state organization (StatsSchema)

### Game Flow

1. Player joins through Lobby Scene:
   - Connects to server and adds to GameState
   - Server assigns position upon player join
   - Welcome message includes position information
   - Server sends map data to all clients
   - Clients confirm map loading status
   - Game starts when all players have loaded the map

2. Transition to Game Scene:
   - GameState provides player information
   - Player rendered at server-determined position
   - Other players synchronized through state updates
   - Map data retrieved from GameState

3. Gameplay:
   - Position updates handled through server broadcasts
   - GameState updates reflect current server state
   - Smooth interpolation for other players

## 💻 Development Notes

### Tile-Based Dungeon Generation
- Maps now use proper tile coordinates rather than pixel coordinates
- Default tile size of 64px, configurable at runtime
- Dungeon generation using Binary Space Partitioning (BSP) algorithm
- Custom room templates with different types (standard, spawn, etc.)
- Efficient dungeon rendering with tile culling
- L-shaped corridors connecting rooms

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

### GameState Usage
- Import the singleton: `import gameState from '../systems/GameState.js';`
- Access player data: `gameState.getPlayer(id)`
- Track phase changes: `gameState.addEventListener('phaseChange', callback)`
- Add new players: `gameState.addPlayer(id, playerData)`
- Remove players: `gameState.removePlayer(id)`
- Access map data: `gameState.getMapData()`

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