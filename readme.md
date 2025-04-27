# Dungeon Dash Royale: Project Blueprint

## 🎮 Game Concept

Dungeon Dash Royale is a unique blend of roguelike and battle royale mechanics where up to 100 players simultaneously navigate their own procedurally generated dungeons. Players race against each other to complete objectives, collect items, and defeat enemies, with everyone starting on an equal footing in each match.

### Core Gameplay Loop

1. Players join a lobby of up to 100 participants
2. When the game starts, each player gets their own procedurally generated dungeon instance
3. Players navigate their dungeons, collecting items, fighting enemies, and completing objectives
4. Progress is tracked on a real-time leaderboard
5. The first player to complete all objectives or the player with the most progress when time expires wins

### Key Features

- **Equal Starting Point**: All players begin with the same capabilities
- **In-Session Progression**: Power increases only within a single run
- **Global Events**: Special events that affect all players simultaneously
- **Real-time Leaderboard**: Track how you compare to other players
- **Roguelike Elements**: Procedurally generated dungeons and random item drops

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
├── client/                     # Phaser game client
│   ├── package.json
│   ├── index.html
│   ├── vite.config.js
│   ├── public/                # Static assets
│   │   └── assets/
│   │       ├── characters/    # Character sprites
│   │       ├── tiles/         # Tileset images
│   │       ├── ui/            # UI elements
│   │       └── items/         # Item sprites
│   └── src/
│       ├── main.js            # Entry point
│       ├── config.js          # Game configuration
│       ├── scenes/            # Phaser scenes
│       │   ├── LobbyScene.js  # Matchmaking lobby
│       │   ├── GameScene.js   # Main gameplay
│       │   └── ResultsScene.js # End of game
│       ├── systems/           # Game systems
│       │   ├── dungeon/       # Dungeon generation
│       │   ├── combat/        # Combat mechanics
│       │   ├── items/         # Item system
│       │   └── ui/            # User interface
│       └── utils/             # Utility functions
├── server/                    # Colyseus multiplayer server
│   ├── package.json
│   ├── index.js               # Server entry point
│   ├── rooms/                 # Game room definitions
│   │   ├── NormalGameRoom.js  # Standard game mode
│   │   └── CustomGameRoom.js  # For private matches
│   ├── schemas/               # Colyseus state schemas
│   │   ├── PlayerState.js
│   │   ├── RoomState.js
│   │   └── items/            # Item schemas
│   └── systems/               # Server-side game logic
│       ├── dungeon/          # Dungeon generation
│       ├── events/           # Global event system
│       └── leaderboard/      # Ranking system
└── shared/                   # Shared code between client and server
    ├── constants.js          # Game constants
    └── utils/                # Shared utility functions
        └── random.js         # Seeded random generation
```

## 🔄 Game Flow

### 1. Server Initialization

- Server starts and creates room handlers
- Rooms are available to join
- Room monitor is available for debugging

### 2. Matchmaking & Lobby

- Players connect to a lobby (up to 100 players)
- Players can see others joining
- When enough players join, a countdown begins
- Players can mark themselves as "ready" to speed up the start

### 3. Game Start

- Server generates a unique dungeon for each player
- Game state is initialized
- Dungeons are sent to respective clients
- Players receive their starting position and objectives

### 4. Gameplay Loop

- Players navigate their dungeons
- Server validates all player actions
- Players collect items and complete objectives
- Progress is synchronized and visible on the leaderboard
- Global events occur periodically affecting all players

### 5. Game End

- Time limit is reached OR a player completes all objectives
- Final scores are calculated
- Results are displayed to all players
- Players return to lobby or can join a new game

## 🎲 Game Mechanics

### Dungeon Generation

- Procedurally generated using a consistent algorithm
- Seeded generation ensures fairness across players
- Multiple room types (combat, treasure, shop, boss)
- Connected by corridors with potential hazards
- Varying difficulty depending on depth

### Player Progression

- Players collect items that enhance abilities
- Abilities include combat moves, traversal options, and special actions
- Power increases only during the active session
- No persistent advantages between games

### Combat System

- Real-time action-based combat
- Different enemy types with distinct behaviors
- Strategic positioning and timing
- Abilities and items change combat options

### Item System

- Random drops with varying rarity
- Equipment affects player stats and abilities
- Consumables for temporary effects
- Special items for objective completion

### Global Events

- Periodic events affecting all players simultaneously
- Can be positive (treasure rain) or negative (monster surge)
- Creates dynamic gameplay moments and comeback opportunities

## 📊 Multiplayer Architecture

### State Synchronization

- Server maintains authoritative game state
- Client predicts movement for responsive feel
- Server validates all important actions
- Optimized state updates using Colyseus schema system

### Room Management

- Lobbies of up to 100 players
- Game rooms created when match starts
- Multiple concurrent games supported
- Auto-disposal of empty rooms

### Networking Optimization

- Position updates only when necessary
- Delta encoding for state changes
- Interest management (only send relevant data to each player)
- Handling latency with prediction and reconciliation

## 🚀 Development Roadmap

### Phase 1: Core Tech (Current)
- Server-client architecture with Colyseus
- Basic multiplayer functionality
- Character movement and visibility
- Lobby and room management

### Phase 2: Core Gameplay
- Procedural dungeon generation
- Basic combat system
- Item collection
- Objective completion tracking

### Phase 3: Game Systems
- Complete item system
- Enemy AI and behaviors
- Global events
- Leaderboard refinement

### Phase 4: Polish
- Visual effects and animations
- Sound design
- UI/UX improvements
- Performance optimization

### Phase 5: Launch
- Matchmaking refinements
- Server scaling
- Analytics integration
- Launch preparation

## 📝 Conclusion

Dungeon Dash Royale combines the unpredictability and build diversity of roguelikes with the competitive thrill of battle royales, creating a unique experience where 100 players can compete in parallel dungeons. The tech stack (Phaser + Colyseus) provides a solid foundation for real-time multiplayer gameplay, and the modular architecture allows for scalable development.

The key innovation is maintaining competitive fairness while incorporating roguelike progression, solving this through session-based power increases without persistent advantages between games.