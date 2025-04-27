// server/rooms/NormalGameRoom.js
import { Room } from "colyseus";
import { Schema, type, MapSchema, ArraySchema } from "@colyseus/schema";

// Define the player state schema
class PlayerState extends Schema {
  constructor() {
    super();
    this.id = "";
    this.name = "";
    this.ready = false;
    this.position = new Position();
    this.health = 100;
    this.maxHealth = 100;
    this.level = 1;
    this.items = new ArraySchema();
    this.abilities = new ArraySchema();
    this.currentProgress = 0;
    this.isAlive = true;
    this.completedObjectives = new ArraySchema();
    this.joinTime = Date.now();
  }
}

// Define position schema
class Position extends Schema {
  constructor() {
    super();
    this.x = 0;
    this.y = 0;
  }
}

// Define the item schema
class Item extends Schema {
  constructor() {
    super();
    this.id = "";
    this.name = "";
    this.type = "";
    this.rarity = "";
    this.stats = {};
  }
}

// Define the ability schema
class Ability extends Schema {
  constructor() {
    super();
    this.id = "";
    this.name = "";
    this.cooldown = 0;
    this.effect = "";
  }
}

// Define the room state schema
class GameRoomState extends Schema {
  constructor() {
    super();
    // Map of all players by client ID
    this.players = new MapSchema();
    // Game state
    this.gameStarted = false;
    this.gameEnded = false;
    this.timeRemaining = 0;
    this.countdown = 0;
    this.winner = null;
    this.leaderboard = new ArraySchema();
    this.globalEvents = new ArraySchema();
  }
}

// Define schemas for types
type(PlayerState, {
  id: "string",
  name: "string",
  ready: "boolean",
  position: Position,
  health: "number",
  maxHealth: "number",
  level: "number",
  items: [Item],
  abilities: [Ability],
  currentProgress: "number",
  isAlive: "boolean",
  completedObjectives: ["string"],
  joinTime: "number"
});

// Define schemas for types
type(Position, {
  x: "number",
  y: "number"
});

type(Item, {
  id: "string",
  name: "string",
  type: "string",
  rarity: "string",
  stats: "object"
});

type(Ability, {
  id: "string",
  name: "string",
  cooldown: "number",
  effect: "string"
});

type(GameRoomState, {
  players: { map: PlayerState },
  gameStarted: "boolean",
  gameEnded: "boolean",
  timeRemaining: "number",
  countdown: "number",
  winner: "string",
  leaderboard: ["string"],
  globalEvents: ["string"]
});

// Main room handler
export class NormalGameRoom extends Room {
  constructor() {
    super();
    this.maxClients = 100;
    this.autoDispose = true;
    this.patchRate = 50; // Send state updates 20 times per second
    
    // Game configuration
    this.waitingForPlayersTimeout = null;
    this.gameStartCountdown = null;
    this.gameDuration = 10 * 60 * 1000; // 10 minutes
    this.minPlayersToStart = 2;
    this.countdownDuration = 10; // seconds
  }

  onCreate(options) {
    console.log("NormalGameRoom created!", options);
    
    // Initialize room state
    this.setState(new GameRoomState());
    
    // Register message handlers
    this.registerMessageHandlers();
    
    // Start waiting for players
    this.waitForPlayers();
  }

  onJoin(client, options) {
    console.log(`${client.id} joined! Options:`, options);
    
    // Create player state
    const player = new PlayerState();
    player.id = client.id;
    player.name = options.name || `Player_${client.id.substr(0, 6)}`;
    player.joinTime = Date.now();
    
    // Add player to room state
    this.state.players[client.id] = player;
    
    // If we've reached minPlayersToStart, start countdown if not already started
    if (Object.keys(this.state.players).length >= this.minPlayersToStart) {
      this.startGameCountdown();
    }
    
    // Send welcome message to the client
    client.send("welcome", {
      message: `Welcome to Dungeon Dash Royale, ${player.name}!`,
      playerId: client.id,
      roomId: this.roomId
    });
    
    // Broadcast player joined message to all clients
    this.broadcast("playerJoined", {
      id: client.id,
      name: player.name,
      playerCount: Object.keys(this.state.players).length
    }, { except: client });
  }

  onLeave(client, consented) {
    console.log(`${client.id} left!`);
    
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
    
    // If not enough players and game hasn't started, reset countdown
    if (Object.keys(this.state.players).length < this.minPlayersToStart && !this.state.gameStarted) {
      this.resetGameCountdown();
    }
    
    // If game is in progress and all players left, end the game
    if (this.state.gameStarted && Object.keys(this.state.players).length === 0) {
      this.endGame();
    }
  }

  onDispose() {
    console.log(`Room ${this.roomId} disposing...`);
    
    // Clear any pending timeouts
    if (this.waitingForPlayersTimeout) clearTimeout(this.waitingForPlayersTimeout);
    if (this.gameStartCountdown) clearInterval(this.gameStartCountdown);
    
    console.log(`Room ${this.roomId} disposed.`);
  }

  // Register all message handlers
  registerMessageHandlers() {
    // Player ready status
    this.onMessage("ready", (client, message) => {
      const player = this.state.players[client.id];
      if (!player) return;
      
      player.ready = true;
      
      // Check if all players are ready
      const allReady = Object.values(this.state.players)
        .every(p => p.ready === true);
      
      // If all players are ready, start the game immediately
      if (allReady && Object.keys(this.state.players).length >= this.minPlayersToStart) {
        this.startGame();
      }
    });
    
    // Player movement/action
    this.onMessage("playerAction", (client, message) => {
      const player = this.state.players[client.id];
      if (!player) return;
      
      // For our tech demo, allow movement even if game hasn't started
      if (message.type === "move") {
        // Update player position
        player.position.x = message.x;
        player.position.y = message.y;
        
        // For debugging, broadcast player movement to all clients
        this.broadcast("playerMoved", {
          id: client.id,
          x: message.x,
          y: message.y
        });
      } 
      // These are for the full game, included for completeness
      else if (message.type === "useAbility" && this.state.gameStarted) {
        // Handle ability usage
        this.handleAbilityUse(client, message.abilityId);
      } else if (message.type === "collectItem" && this.state.gameStarted) {
        // Handle item collection
        this.handleItemCollection(client, message.itemId);
      } else if (message.type === "completeObjective" && this.state.gameStarted) {
        // Handle objective completion
        this.handleObjectiveCompletion(client, message.objectiveId);
      }
    });
    
    // Chat message
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

  // Game flow methods
  waitForPlayers() {
    console.log(`Waiting for players in room ${this.roomId}...`);
    
    // Set timeout for room if no players join
    this.waitingForPlayersTimeout = setTimeout(() => {
      if (Object.keys(this.state.players).length === 0) {
        console.log(`No players joined room ${this.roomId}, disposing...`);
        this.disconnect();
      }
    }, 5 * 60 * 1000); // 5 minutes
  }

  startGameCountdown() {
    // If countdown already started or game already started, return
    if (this.gameStartCountdown || this.state.gameStarted) return;
    
    console.log(`Starting game countdown in room ${this.roomId}...`);
    
    // Set initial countdown value
    this.state.countdown = this.countdownDuration;
    
    // Broadcast countdown started
    this.broadcast("countdownStarted", { 
      seconds: this.countdownDuration 
    });
    
    // Start countdown interval
    this.gameStartCountdown = setInterval(() => {
      this.state.countdown--;
      
      // Broadcast countdown update
      this.broadcast("countdownUpdate", { 
        seconds: this.state.countdown 
      });
      
      // If countdown reached zero, start the game
      if (this.state.countdown <= 0) {
        clearInterval(this.gameStartCountdown);
        this.gameStartCountdown = null;
        this.startGame();
      }
    }, 1000);
  }

  resetGameCountdown() {
    console.log(`Resetting game countdown in room ${this.roomId}...`);
    
    // Clear countdown interval
    if (this.gameStartCountdown) {
      clearInterval(this.gameStartCountdown);
      this.gameStartCountdown = null;
    }
    
    // Reset countdown value
    this.state.countdown = 0;
    
    // Broadcast countdown cancelled
    this.broadcast("countdownCancelled", {
      reason: "Not enough players"
    });
  }

  startGame() {
    console.log(`Starting game in room ${this.roomId}...`);
    
    // Clear any pending timeouts/intervals
    if (this.waitingForPlayersTimeout) clearTimeout(this.waitingForPlayersTimeout);
    if (this.gameStartCountdown) clearInterval(this.gameStartCountdown);
    
    // Set game state
    this.state.gameStarted = true;
    this.state.gameEnded = false;
    this.state.timeRemaining = this.gameDuration;
    
    // Generate dungeons and assign to players
    this.generateDungeons();
    
    // Broadcast game started
    this.broadcast("gameStarted", {
      players: Object.keys(this.state.players).length,
      duration: this.gameDuration
    });
    
    // Set game end timeout
    this.clock.setTimeout(() => {
      this.endGame("timeUp");
    }, this.gameDuration);
    
    // Update time remaining every second
    this.clock.setInterval(() => {
      this.state.timeRemaining -= 1000;
      
      // Every 30 seconds, update leaderboard
      if (this.state.timeRemaining % 30000 === 0) {
        this.updateLeaderboard();
      }
      
      // Every 60 seconds, trigger a global event
      if (this.state.timeRemaining % 60000 === 0) {
        this.triggerGlobalEvent();
      }
    }, 1000);
  }

  endGame(reason = "normal") {
    console.log(`Ending game in room ${this.roomId}. Reason: ${reason}`);
    
    // Set game state
    this.state.gameStarted = false;
    this.state.gameEnded = true;
    
    // Determine winner
    this.updateLeaderboard();
    this.state.winner = this.state.leaderboard[0] || null;
    
    // Broadcast game ended
    this.broadcast("gameEnded", {
      reason: reason,
      winner: this.state.winner ? {
        id: this.state.winner,
        name: this.state.players[this.state.winner]?.name || "Unknown"
      } : null,
      leaderboard: this.state.leaderboard.map(id => ({
        id: id,
        name: this.state.players[id]?.name || "Unknown",
        progress: this.state.players[id]?.currentProgress || 0,
        completedObjectives: this.state.players[id]?.completedObjectives || []
      }))
    });
    
    // Lock the room to prevent new players from joining
    this.lock();
    
    // Close room after results are shown
    this.clock.setTimeout(() => {
      this.disconnect();
    }, 30 * 1000); // 30 seconds
  }

  // Game mechanics methods
  generateDungeons() {
    // For each player, generate a dungeon
    Object.keys(this.state.players).forEach(playerId => {
      // Generate a seed based on player ID and room ID for deterministic generation
      const seed = `${this.roomId}-${playerId}-${Date.now()}`;
      
      // Send dungeon data to the player
      const targetClient = this.clients.find(c => c.id === playerId);
      if (targetClient) {
        targetClient.send("dungeonGenerated", {
          seed: seed,
          layout: this.generateDungeonLayout(seed),
          difficulty: 1 // Starting difficulty
        });
      }
    });
  }

  generateDungeonLayout(seed) {
    // Simple placeholder for dungeon generation
    return {
      width: 50,
      height: 50,
      rooms: [
        { x: 5, y: 5, width: 10, height: 10, type: "start" },
        { x: 25, y: 25, width: 10, height: 10, type: "treasure" },
        { x: 35, y: 15, width: 10, height: 10, type: "combat" }
      ],
      corridors: [
        { startX: 15, startY: 10, endX: 25, endY: 25 },
        { startX: 35, startY: 25, endX: 35, endY: 15 }
      ],
      objectives: [
        { id: "obj1", type: "defeat", target: "boss1", location: { x: 35, y: 15 } },
        { id: "obj2", type: "collect", target: "treasure1", location: { x: 25, y: 25 } }
      ]
    };
  }

  updateLeaderboard() {
    // Sort players by progress
    const sortedPlayers = Object.entries(this.state.players)
      .sort(([, a], [, b]) => {
        // Primary sort by objectives completed
        const aObjectives = a.completedObjectives ? a.completedObjectives.length : 0;
        const bObjectives = b.completedObjectives ? b.completedObjectives.length : 0;
        const objDiff = bObjectives - aObjectives;
        
        if (objDiff !== 0) return objDiff;
        
        // Secondary sort by progress
        return (b.currentProgress || 0) - (a.currentProgress || 0);
      })
      .map(([id]) => id);
    
    // Update leaderboard in state
    this.state.leaderboard = new ArraySchema(...sortedPlayers);
    
    // Broadcast leaderboard update
    this.broadcast("leaderboardUpdate", {
      leaderboard: sortedPlayers.map((id, index) => {
        const player = this.state.players[id];
        if (!player) {
          return {
            id: id,
            name: "Unknown",
            rank: index + 1,
            progress: 0,
            completedObjectives: []
          };
        }
        
        return {
          id: id,
          name: player.name || "Unknown",
          rank: index + 1,
          progress: player.currentProgress || 0,
          completedObjectives: player.completedObjectives || []
        };
      })
    });
  }

  triggerGlobalEvent() {
    // Create a random global event that affects all players
    const eventTypes = [
      "treasure_rain", "monster_surge", "healing_pools", 
      "darkness", "extra_loot", "shop_discount"
    ];
    
    const eventType = eventTypes[Math.floor(Math.random() * eventTypes.length)];
    const eventDuration = Math.floor(Math.random() * 30) + 30; // 30-60 seconds
    
    // Add event to global events
    this.state.globalEvents.push(`${eventType}_${Date.now()}`);
    
    // Broadcast event to all players
    this.broadcast("globalEvent", {
      type: eventType,
      duration: eventDuration,
      message: this.getEventMessage(eventType)
    });
    
    // Clear event after duration
    this.clock.setTimeout(() => {
      this.state.globalEvents.pop(); // Remove oldest event
      
      // Broadcast event ended
      this.broadcast("globalEventEnded", {
        type: eventType
      });
    }, eventDuration * 1000);
  }

  getEventMessage(eventType) {
    // Return appropriate message for event type
    const messages = {
      "treasure_rain": "Treasure is raining from the sky! Extra loot for everyone!",
      "monster_surge": "Monster surge! Beware of increased enemy spawns!",
      "healing_pools": "Healing pools have appeared! Restore your health!",
      "darkness": "Darkness falls! Limited visibility ahead!",
      "extra_loot": "Extra loot from all sources!",
      "shop_discount": "Shop discount! All items are cheaper!"
    };
    
    return messages[eventType] || "A mysterious event is occurring!";
  }

  // Player action handlers
  handleAbilityUse(client, abilityId) {
    const player = this.state.players[client.id];
    if (!player) return;
    
    // Find the ability
    const ability = player.abilities.find(a => a.id === abilityId);
    if (!ability) return;
    
    // Process ability use
    // This would be expanded with actual ability logic
    
    // Broadcast ability used
    this.broadcast("abilityUsed", {
      playerId: client.id,
      playerName: player.name,
      abilityId: abilityId,
      abilityName: ability.name
    });
  }

  handleItemCollection(client, itemId) {
    const player = this.state.players[client.id];
    if (!player) return;
    
    // Create a new item
    const item = new Item();
    item.id = itemId;
    item.name = `Item ${itemId}`;
    item.type = ["weapon", "armor", "potion"][Math.floor(Math.random() * 3)];
    item.rarity = ["common", "uncommon", "rare", "epic"][Math.floor(Math.random() * 4)];
    
    // Add item to player inventory
    player.items.push(item);
    
    // Update player stats based on item
    // This would be expanded with actual item logic
    
    // Increase player progress
    player.currentProgress += 5;
    
    // Send item collected confirmation
    client.send("itemCollected", {
      itemId: itemId,
      item: {
        id: item.id,
        name: item.name,
        type: item.type,
        rarity: item.rarity
      }
    });
  }

  handleObjectiveCompletion(client, objectiveId) {
    const player = this.state.players[client.id];
    if (!player) return;
    
    // Add objective to completed objectives
    if (!player.completedObjectives) {
      player.completedObjectives = new ArraySchema();
    }
    player.completedObjectives.push(objectiveId);
    
    // Increase progress significantly
    player.currentProgress = (player.currentProgress || 0) + 20;
    
    // Broadcast objective completion
    this.broadcast("objectiveCompleted", {
      playerId: client.id,
      playerName: player.name,
      objectiveId: objectiveId
    });
    
    // Update leaderboard
    this.updateLeaderboard();
    
    // Check if player has completed all objectives
    if (player.completedObjectives && player.completedObjectives.length >= 2) { // Assuming 2 objectives for now
      this.handlePlayerVictory(client);
    }
  }

  handlePlayerVictory(client) {
    const player = this.state.players[client.id];
    if (!player) return;
    
    // Set winner and end game
    this.state.winner = client.id;
    
    // Broadcast player victory
    this.broadcast("playerVictory", {
      playerId: client.id,
      playerName: player.name,
      completionTime: Date.now() - player.joinTime
    });
    
    // End the game
    this.endGame("playerWon");
  }
}