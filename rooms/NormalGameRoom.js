// server/rooms/NormalGameRoom.js - Updated for new dungeon generator
import { BaseRoom } from "./BaseRoom.js";
import { GameRoomState } from "../schemas/GameRoomState.js";
import { PlayerState } from "../schemas/PlayerState.js";
import { Position } from "../schemas/Position.js";
import { InputHandler } from "../systems/InputHandler.js";
import { PhaseManager } from "../systems/PhaseManager.js";
import { EventManager } from "../systems/EventManager.js";
import { CollisionSystem } from "../systems/CollisionSystem.js";
import { LeaderboardSystem } from "../systems/LeaderboardSystem.js";
import { MapManager } from "../systems/MapManager.js";

export class NormalGameRoom extends BaseRoom {
  state = new GameRoomState();

  constructor() {
    super();
    this.maxClients = 100;
    this.autoDispose = true;

    // Initialize systems
    this.inputHandler = null;
    this.phaseManager = null;
    this.eventManager = null;
    this.collisionSystem = null;
    this.leaderboardSystem = null;
    this.mapManager = null;
  }

  onCreate(options) {
    super.onCreate(options);

    // Parse options or use defaults
    const roomOptions = {
      maxPlayers: options.maxPlayers || 100,
      minPlayers: options.minPlayers || 2,
      maxWaitTime: options.maxWaitTime || 30 * 1000,
      debug: options.debug || false,
      ...options,
    };

    // Initialize systems
    this.inputHandler = new InputHandler(this);
    this.phaseManager = new PhaseManager(this);
    this.eventManager = new EventManager(this);
    this.collisionSystem = new CollisionSystem(this); // Add collision system
    this.leaderboardSystem = new LeaderboardSystem(this);

    // Initialize map manager with configuration
    this.mapManager = new MapManager(this);
    this.mapManager.init({
      debug: roomOptions.debug,
      tileSize: 64,
    });

    // Generate initial map
    console.log("Generating initial dungeon floor...");
    const initialMap = this.mapManager.generateFirstFloor();
    console.log(
      `Initial floor generated with ${initialMap.layers.tiles.length}x${initialMap.layers.tiles[0].length} tiles`
    );

    // Initialize collision map with the generated map
    this.collisionSystem.initCollisionMap(initialMap);

    // Connect systems
    this.inputHandler.setCollisionSystem(this.collisionSystem);

    // Set initial phase
    this.phaseManager.setPhase("lobby");

    // Register message handlers
    this.registerMessageHandlers();

    // Start waiting for players
    this.phaseManager.waitForPlayers();

    console.log(`Room created: ${this.roomId} with options:`, roomOptions);
  }

  onJoin(client, options) {
    super.onJoin(client, options);

    // Get authenticated user information
    const userId = client.auth?.userId;

    // Create player state
    const player = new PlayerState();
    player.id = client.id;

    // If authenticated, use their profile data
    if (userId && client.auth?.userData) {
      const userData = client.auth.userData;
      player.name =
        userData.playerProfile?.displayName ||
        userData.username ||
        `Player_${client.id.substr(0, 6)}`;
      player.userId = String(userId); // Store user ID for persistence
    } else {
      // For guests or non-authenticated users
      player.name = options.name || `Guest_${client.id.substr(0, 6)}`;
    }

    player.joinTime = Date.now();

    // Set spawn position using map manager
    const spawnPos = this.mapManager
      ? this.mapManager.getSpawnPosition()
      : { x: 400, y: 300 };
    player.position.x = spawnPos.x;
    player.position.y = spawnPos.y;

    // Initialize player properties
    player.lastInputSeq = 0;
    player.moveSpeed = 300; // pixels per second

    // Add player to room state
    this.state.players.set(client.id, player);
    console.log(
      `Player ${player.name} (User ID: ${
        userId || "anonymous"
      }) joined at position (${player.position.x}, ${player.position.y})`
    );

    // Send welcome message with spawn position
    client.send("welcome", {
      message: `Welcome to Dungeon Dash Royale, ${player.name}!`,
      playerId: client.id,
      roomId: this.roomId,
      position: {
        x: player.position.x,
        y: player.position.y,
      },
    });

    // Send map data to new player
    if (this.mapManager && this.mapManager.currentMap) {
      const mapData = this.mapManager.getCurrentMapData(client.id);
      client.send("mapData", mapData);
      console.log(`Sent map data to player ${player.name}`);
    } else {
      console.warn(`No map data available for player ${player.name}`);
    }

    // Broadcast player joined message
    this.broadcast(
      "playerJoined",
      {
        id: client.id,
        name: player.name,
        position: { x: player.position.x, y: player.position.y },
        playerCount: this.state.players.size,
      },
      { except: client }
    );

    // Check if we should start game countdown
    this.phaseManager.checkGameStart();

    console.log(
      `Player ${player.name} (${client.id}) joined room ${this.roomId}`
    );
  }

  onLeave(client, consented) {
    // Get player before removing
    const player = this.state.players.get(client.id);
    const playerName = player ? player.name : "Unknown player";
    const userId = player?.userId;

    // Save player data if authenticated
    if (userId && player) {
      this.savePlayerData(userId, player).catch((err) => {
        console.error(`Error saving player data for ${playerName}:`, err);
      });
    }

    super.onLeave(client, consented);

    // Remove player from room state
    this.state.players.delete(client.id);

    // If this player was assigned to a spawn point, release it
    if (
      this.mapManager &&
      this.mapManager.currentMap &&
      this.mapManager.currentMap.spawnPoints
    ) {
      const spawnPoint = this.mapManager.currentMap.spawnPoints.find(
        (sp) => sp.playerId === client.id
      );
      if (spawnPoint) {
        spawnPoint.playerId = null;
        console.log(`Released spawn point for player ${playerName}`);
      }
    }

    // Broadcast player left message
    this.broadcast("playerLeft", {
      id: client.id,
      name: playerName,
      playerCount: this.state.players.size,
    });

    // Check if game should end or countdown should reset
    this.phaseManager.handlePlayerLeave();

    console.log(
      `Player ${playerName} (${client.id}) left room ${this.roomId}. Consented: ${consented}`
    );
  }

  registerMessageHandlers() {
    // Register input handler messages
    this.inputHandler.registerHandlers();

    // Player ready handler
    this.onMessage("ready", (client, message) => {
      const player = this.state.players.get(client.id);
      if (!player) return;

      player.ready = true;

      // Check if all players are ready
      this.phaseManager.checkAllPlayersReady();
    });

    // Map data request handler
    this.onMessage("requestMapData", (client) => {
      if (!this.mapManager || !this.mapManager.currentMap) return;

      // Send current map data to requesting client
      const mapData = this.mapManager.getCurrentMapData(client.id);
      client.send("mapData", mapData);
    });

    // Chat message handler
    this.onMessage("chat", (client, message) => {
      const player = this.state.players.get(client.id);
      if (!player) return;

      // Broadcast chat message to all clients
      this.broadcast("chatMessage", {
        senderId: client.id,
        senderName: player.name,
        message: message.text.substring(0, 200), // Limit message length
      });
    });

    // Map loaded confirmation handler
    this.onMessage("mapLoaded", (client) => {
      const player = this.state.players.get(client.id);
      if (player) {
        player.mapLoaded = true;
        console.log(`Player ${player.name} has loaded the map`);

        // Check if all players have loaded the map
        this.checkAllPlayersMapLoaded();
      }
    });

    // Handle collision reports from clients (optional)
    this.onMessage("collision", (client, message) => {
      // This can be used to verify client-reported collisions
      // For now, just log it
      if (this.state.players.get(client.id)) {
        console.log(
          `Collision reported by ${client.id} at (${message.x}, ${message.y})`
        );
      }
    });

    // Handle interaction with objects (e.g. chests, triggers)
    this.onMessage("interaction", (client, message) => {
      const player = this.state.players.get(client.id);
      if (!player) return;

      console.log(
        `Player ${player.name} interacted with ${message.type} at tile (${message.tileX}, ${message.tileY})`
      );

      // Handle different interaction types
      switch (message.type) {
        case "chest":
          // Give player an item/reward
          this.handleChestInteraction(client, player, message);
          break;

        case "door":
          // Open/close door
          this.handleDoorInteraction(client, player, message);
          break;

        case "portal":
          // Teleport player
          this.handlePortalInteraction(client, player, message);
          break;

        default:
          // Unknown interaction type
          console.warn(`Unknown interaction type: ${message.type}`);
      }
    });
  }

  // Save player data to database
  async savePlayerData(userId, player) {
    try {
      // Only save if userId is a valid numeric string
      const userIdNumber = parseInt(userId);
      if (isNaN(userIdNumber)) {
        return;
      }

      // Update player stats in database
      await prisma.playerProfile.update({
        where: { userId: userIdNumber },
        data: {
          playerStats: {
            update: {
              gamesPlayed: { increment: 1 },
              // Add other stats you want to update
              playTime: {
                increment: Math.floor((Date.now() - player.joinTime) / 1000),
              },
            },
          },
        },
      });

      console.log(`Saved player data for user ${userId}`);
    } catch (error) {
      console.error(`Failed to save player data for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Handle player interaction with a chest
   * @param {Client} client - Client object
   * @param {PlayerState} player - Player state
   * @param {Object} message - Interaction message
   */
  handleChestInteraction(client, player, message) {
    // Check if chest exists at specified location
    if (
      this.mapManager &&
      this.mapManager.currentMap &&
      this.mapManager.currentMap.layers
    ) {
      const { tileX, tileY } = message;
      const props = this.mapManager.currentMap.layers.props;

      // Check if there's a chest at this position (prop value 3 = chest)
      if (props && props[tileY] && props[tileY][tileX] === 3) {
        // Give player a reward
        // For now, just notify the player
        client.send("itemFound", {
          type: "gold",
          amount: Math.floor(10 + Math.random() * 20),
        });

        // Mark chest as opened by setting it to 0 (empty)
        props[tileY][tileX] = 0;

        // Notify all clients about chest being opened
        this.broadcast("propsUpdated", {
          updates: [{ x: tileX, y: tileY, value: 0 }],
        });
      }
    }
  }

  /**
   * Handle player interaction with a door
   * @param {Client} client - Client object
   * @param {PlayerState} player - Player state
   * @param {Object} message - Interaction message
   */
  handleDoorInteraction(client, player, message) {
    // Implementation will depend on how doors are represented
    // For now, just acknowledge the interaction
    client.send("doorToggled", {
      x: message.tileX,
      y: message.tileY,
      isOpen: true,
    });
  }

  /**
   * Handle player interaction with a portal
   * @param {Client} client - Client object
   * @param {PlayerState} player - Player state
   * @param {Object} message - Interaction message
   */
  handlePortalInteraction(client, player, message) {
    // Teleport player to a different location
    // For demonstration, just move them 10 tiles away
    const newX = player.position.x + 10 * this.mapManager.tileSize;
    const newY = player.position.y + 10 * this.mapManager.tileSize;

    // Update player position
    player.position.x = newX;
    player.position.y = newY;

    // Notify the player
    client.send("teleported", {
      x: newX,
      y: newY,
      message: "You've been teleported!",
    });

    // Notify other players
    this.broadcast(
      "playerMoved",
      {
        id: player.id,
        x: newX,
        y: newY,
      },
      { except: client }
    );
  }

  checkAllPlayersMapLoaded() {
    const allLoaded = Array.from(this.state.players.values()).every(
      (player) => player.mapLoaded
    );

    if (allLoaded) {
      console.log("All players have loaded the map, ready to start game");
      this.phaseManager.checkGameStart();
    }
  }

  fixedUpdate(deltaTime) {
    // Process player inputs
    this.inputHandler.processAllInputs(deltaTime);

    // Update game systems based on current phase
    this.phaseManager.update(deltaTime);

    // Process collisions
    this.collisionSystem.update(deltaTime);

    // Update leaderboard periodically
    if (this.state.gameStarted && Date.now() % 5000 < deltaTime) {
      this.leaderboardSystem.updateLeaderboard();
    }

    // Trigger random events occasionally (roughly every 2 minutes)
    if (this.state.gameStarted && Math.random() < deltaTime / (120 * 1000)) {
      this.eventManager.triggerGlobalEvent();
    }

    // Specific updates for the dungeon phase
    if (this.state.phase === this.phaseManager.PHASES.DUNGEON) {
      this.updateDungeonPhase(deltaTime);
    }

    // Specific updates for the gauntlet phase
    if (this.state.phase === this.phaseManager.PHASES.GAUNTLET) {
      this.updateGauntletPhase(deltaTime);
    }
  }

  /**
   * Special updates for dungeon phase
   * @param {number} deltaTime - Time since last update in ms
   */
  updateDungeonPhase(deltaTime) {
    // Handle floor collapse warning
    if (this.state.phaseEndTime) {
      const timeLeft = Math.ceil((this.state.phaseEndTime - Date.now()) / 1000);

      // Send warnings at 60, 30, 20, 10, and every second under 10
      if (
        timeLeft === 60 ||
        timeLeft === 30 ||
        timeLeft === 20 ||
        timeLeft === 10 ||
        (timeLeft < 10 && timeLeft > 0)
      ) {
        this.broadcast("floorCollapsing", { timeLeft });
      }
    }

    // Spawn monsters or handle other dungeon-specific logic
    // ...
  }

  /**
   * Special updates for gauntlet phase
   * @param {number} deltaTime - Time since last update in ms
   */
  updateGauntletPhase(deltaTime) {
    // Handle gauntlet-specific logic
    // ...
  }

  onDispose() {
    console.log(`Room ${this.roomId} disposing...`);
    super.onDispose();
  }
}
