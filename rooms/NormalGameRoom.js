// server/rooms/NormalGameRoom.js
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
      ...options
    };
    
    // Initialize systems
    this.inputHandler = new InputHandler(this);
    this.phaseManager = new PhaseManager(this);
    this.eventManager = new EventManager(this);
    this.collisionSystem = new CollisionSystem(this);
    this.leaderboardSystem = new LeaderboardSystem(this);
    
    // Initialize map manager with configuration
    this.mapManager = new MapManager(this);
    this.mapManager.init({
      debug: roomOptions.debug,
      tileSize: 64
    });
    
    // Generate initial map
    console.log("Generating initial dungeon floor...");
    const initialMap = this.mapManager.generateFirstFloor();
    console.log(`Initial floor generated with ${initialMap.rooms.length} rooms and ${initialMap.spawnPoints.length} spawn points`);
    
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
    
    // Create player state
    const player = new PlayerState();
    player.id = client.id;
    player.name = options.name || `Player_${client.id.substr(0, 6)}`;
    player.joinTime = Date.now();
    
    // Set spawn position using map manager
    const spawnPos = this.mapManager ? this.mapManager.getSpawnPosition() : { x: 400, y: 300 };
    player.position.x = spawnPos.x;
    player.position.y = spawnPos.y;
    
    // Initialize player properties
    player.lastInputSeq = 0;
    player.moveSpeed = 300; // pixels per second
    
    // Add player to room state
    this.state.players.set(client.id, player);
    console.log(`Player ${player.name} joined at position (${player.position.x}, ${player.position.y})`);
    
    // Send welcome message with spawn position
    client.send("welcome", {
      message: `Welcome to Dungeon Dash Royale, ${player.name}!`,
      playerId: client.id,
      roomId: this.roomId,
      position: {
        x: player.position.x,
        y: player.position.y
      }
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
    this.broadcast("playerJoined", {
      id: client.id,
      name: player.name,
      position: { x: player.position.x, y: player.position.y },
      playerCount: this.state.players.size
    }, { except: client });
    
    // Check if we should start game countdown
    this.phaseManager.checkGameStart();
    
    console.log(`Player ${player.name} (${client.id}) joined room ${this.roomId}`);
  }

  onLeave(client, consented) {
    super.onLeave(client, consented);
    
    // Get player before removing
    const player = this.state.players.get(client.id);
    const playerName = player ? player.name : "Unknown player";
    
    // Remove player from room state
    this.state.players.delete(client.id);
    
    // If this player was assigned to a spawn point, release it
    if (this.mapManager && this.mapManager.currentMap && this.mapManager.currentMap.spawnPoints) {
      const spawnPoint = this.mapManager.currentMap.spawnPoints.find(sp => sp.playerId === client.id);
      if (spawnPoint) {
        spawnPoint.playerId = null;
        console.log(`Released spawn point for player ${playerName}`);
      }
    }
    
    // Broadcast player left message
    this.broadcast("playerLeft", {
      id: client.id,
      name: playerName,
      playerCount: this.state.players.size
    });
    
    // Check if game should end or countdown should reset
    this.phaseManager.handlePlayerLeave();
    
    console.log(`Player ${playerName} (${client.id}) left room ${this.roomId}. Consented: ${consented}`);
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
        message: message.text.substring(0, 200) // Limit message length
      });
    });

    this.onMessage("mapLoaded", (client) => {
      const player = this.state.players.get(client.id);
      if (player) {
        player.mapLoaded = true;
        console.log(`Player ${player.name} has loaded the map`);
        
        // Check if all players have loaded the map
        this.checkAllPlayersMapLoaded();
      }
    });
  }

  checkAllPlayersMapLoaded() {
    const allLoaded = Array.from(this.state.players.values())
      .every(player => player.mapLoaded);
      
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
  }
  
  onDispose() {
    console.log(`Room ${this.roomId} disposing...`);
    super.onDispose();
  }
}