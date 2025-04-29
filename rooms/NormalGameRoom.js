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
import { DungeonGenerator } from "../systems/DungeonGenerator.js";

export class NormalGameRoom extends BaseRoom {
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
    this.dungeonGenerator = null;
  }

  onCreate(options) {
    super.onCreate(options);
    
    // Initialize room state
    this.setState(new GameRoomState());
    
    // Initialize systems
    this.inputHandler = new InputHandler(this);
    this.phaseManager = new PhaseManager(this);
    this.eventManager = new EventManager(this);
    this.collisionSystem = new CollisionSystem(this);
    this.leaderboardSystem = new LeaderboardSystem(this);
    this.dungeonGenerator = new DungeonGenerator(this);
    
    // Set initial phase
    this.phaseManager.setPhase("lobby");
    
    // Register message handlers
    this.registerMessageHandlers();
    
    // Start waiting for players
    this.phaseManager.waitForPlayers();
    
    console.log(`Room created: ${this.roomId} with options:`, options);
  }

  onJoin(client, options) {
    super.onJoin(client, options);
    
    // Create player state
    const player = new PlayerState();
    player.id = client.id;
    player.name = options.name || `Player_${client.id.substr(0, 6)}`;
    player.joinTime = Date.now();
    
    // Set random starting position
    player.position.x = 400 + (Math.random() * 100 - 50);
    player.position.y = 300 + (Math.random() * 100 - 50);
    
    // Initialize player properties
    player.lastInputSeq = 0;
    player.moveSpeed = 300; // pixels per second
    
    // Add player to room state
    this.state.players[client.id] = player;
    
    // Send welcome message
    client.send("welcome", {
      message: `Welcome to Dungeon Dash Royale, ${player.name}!`,
      playerId: client.id,
      roomId: this.roomId
    });
    
    // Broadcast player joined message
    this.broadcast("playerJoined", {
      id: client.id,
      name: player.name,
      position: { x: player.position.x, y: player.position.y },
      playerCount: Object.keys(this.state.players).length
    }, { except: client });
    
    // Check if we should start game countdown
    this.phaseManager.checkGameStart();
    
    console.log(`Player ${player.name} (${client.id}) joined room ${this.roomId}`);
  }

  onLeave(client, consented) {
    super.onLeave(client, consented);
    
    // Get player name for broadcast
    const playerName = this.state.players[client.id]?.name || "Unknown player";
    
    // Remove player from room state
    delete this.state.players[client.id];
    
    // Broadcast player left message
    this.broadcast("playerLeft", {
      id: client.id,
      name: playerName,
      playerCount: Object.keys(this.state.players).length
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
      const player = this.state.players[client.id];
      if (!player) return;
      
      player.ready = true;
      
      // Check if all players are ready
      this.phaseManager.checkAllPlayersReady();
    });
    
    // Chat message handler
    this.onMessage("chat", (client, message) => {
      const player = this.state.players[client.id];
      if (!player) return;
      
      // Broadcast chat message to all clients
      this.broadcast("chatMessage", {
        senderId: client.id,
        senderName: player.name,
        message: message.text.substring(0, 200) // Limit message length
      });
    });
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
  }
  
  onDispose() {
    console.log(`Room ${this.roomId} disposing...`);
    super.onDispose();
  }
}