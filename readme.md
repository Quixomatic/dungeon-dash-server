# Dungeon Dash Royale: Project Blueprint

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

### Key Features

- **Equal Starting Point**: All players begin with the same capabilities
- **In-Session Progression**: Power increases only within a single run
- **Periodic Player Battles**: Gauntlet phases that test player progression against others
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
│   └── src/
│       ├── main.js            # Entry point
│       ├── config.js          # Game configuration
│       ├── scenes/            # Phaser scenes
│       │   ├── LobbyScene.js  # Matchmaking lobby
│       │   ├── GameScene.js   # Main gameplay
│       │   ├── DungeonScene.js # Dungeon phase
│       │   ├── GauntletScene.js # Combat phase
│       │   └── ResultsScene.js # End of game
│       ├── systems/           # Game systems
│       │   ├── GameState.js   # Global game state
│       │   ├── NetworkManager.js # Network communication
│       │   ├── dungeon/       # Dungeon generation
│       │   ├── combat/        # Combat mechanics
│       │   ├── items/         # Item system
│       │   └── ui/            # User interface
│       ├── utils/             # Utility functions
│       │   ├── controls.js    # Input handling
│       │   └── debug.js       # Debug helpers
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

## 🔄 Current Progress

### Completed Tasks
- **Basic Multiplayer Framework**
  - Server setup with Colyseus
  - Client-server communication
  - Player joining/leaving synchronization
  - Real-time position updates
  - Multiple player visibility

### Server Features Implemented
- Room creation and management
- Player state tracking
- Countdown system for game start
- Broadcasting of player movements

### Client Features Implemented
- Lobby scene with connection UI
- Game scene with player movement
- Visual representation of other players
- WASD and arrow key controls
- Debug information display

## 🚀 Next Steps

### Immediate Priorities
1. **Implement Player Stats System**
   - Create schema for player stats (health, attack, defense, etc.)
   - Add inventory system for items
   - Implement level and experience tracking

2. **Phase Management**
   - Add phase transition logic (Lobby → Dungeon → Gauntlet → Repeat)
   - Create timers for phase duration
   - Implement broadcasting of phase changes

3. **Dungeon Generation**
   - Create procedural dungeon generation algorithm
   - Implement room types (combat, treasure, shop, boss)
   - Add enemies with basic AI

4. **Item and Ability System**
   - Create different item types (weapons, armor, consumables)
   - Implement ability selection on level up
   - Add effects of items and abilities on player stats

### Medium-Term Goals
1. **Gauntlet Combat System**
   - Implement player grouping for gauntlets
   - Create combat mechanics
   - Add victory/defeat conditions and handling

2. **Visual Improvements**
   - Add proper character sprites
   - Create dungeon tile sets
   - Implement combat animations
   - Add UI for player stats, inventory, and abilities

3. **Global Events**
   - Implement event system
   - Create various event types and effects
   - Add visual notifications for events

### Long-Term Goals
1. **Game Balancing**
   - Tune item strength and rarity
   - Balance abilities and progression
   - Adjust combat mechanics for fair play

2. **Matchmaking Improvements**
   - Add skill-based matchmaking
   - Implement lobby management for different game sizes
   - Create spectator mode for eliminated players

3. **Deployment and Scaling**
   - Set up server infrastructure
   - Implement load balancing for high player counts
   - Add analytics for gameplay monitoring

## 📝 Conclusion

Dungeon Dash Royale combines the unpredictability and build diversity of roguelikes with the competitive thrill of battle royales, creating a unique experience where players compete through a mix of PvE and PvP gameplay. The current implementation has established the core multiplayer foundation, allowing us to focus next on the dungeon exploration and combat mechanics that will make the game truly engaging.

The key innovation is the alternating phases of individual progression and competitive elimination, creating dynamic gameplay where strategy and skill are equally important. With the basic multiplayer infrastructure now in place, we can begin implementing these core gameplay mechanics.