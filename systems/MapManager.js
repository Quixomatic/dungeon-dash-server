// server/systems/MapManager.js
import { BSPDungeonGenerator } from "./BSPDungeonGenerator.js";
import { getTemplateById, generateBasicLayout } from "./RoomTemplates.js";

/**
 * MapManager - Manages dungeon map generation and distribution
 */
export class MapManager {
  constructor(room) {
    this.room = room;
    this.generator = null;
    this.currentMap = null;
    this.floorLevel = 1;
    this.tileSize = 64; // Pixels per tile
    this.debug = false;

    // Map dimensions in TILES (not pixels)
    this.worldTileWidth = 312; // 20,000 ÷ 64 ≈ 312 tiles wide
    this.worldTileHeight = 312; // 20,000 ÷ 64 ≈ 312 tiles high
  }

  /**
   * Initialize the manager with configuration
   * @param {Object} config - Configuration options
   */
  init(config = {}) {
    this.debug = config.debug || false;
    // Allow config to override tile size
    this.tileSize = config.tileSize || 64;

    // Recalculate world dimensions in tiles
    this.worldTileWidth = Math.floor((config.worldSize || 20000) / this.tileSize);
    this.worldTileHeight =
      Math.floor((config.worldSize || 20000) / this.tileSize);

    console.log(
      `Map initialized with ${this.worldTileWidth}x${this.worldTileHeight} tiles (${this.tileSize}px each)`
    );

    return this;
  }

  /**
   * Generate the first floor
   * @returns {Object} - Generated map data
   */
  generateFirstFloor() {
    console.log("Generating first dungeon floor");
    
    // Get player count (or use a minimum of 4)
    const playerCount = Math.max(4, Object.keys(this.room.state.players || {}).length);
    
    // Define dungeon size in TILES, not pixels
    const dungeonTileSize = Math.floor(100 + (playerCount * 5)); // e.g., 120 tiles for 4 players
    
    // Create generator with tile-based dimensions
    this.generator = new BSPDungeonGenerator({
      worldTileSize: this.worldTileWidth,
      dungeonTileSize: dungeonTileSize,
      minRoomSize: 5, // Minimum room size in tiles
      maxRoomSize: 20, // Maximum room size in tiles
      minLeafSize: 20, // Minimum leaf size for BSP in tiles
      maxLeafSize: 40, // Maximum leaf size for BSP in tiles
      playerCount: playerCount,
      tileSize: this.tileSize, // Pass tile size for later conversion
      debug: this.debug
    });
    
    // Generate dungeon
    this.currentMap = this.generator.generate();
    
    console.log(`Generated floor ${this.floorLevel} with ${this.currentMap.rooms.length} rooms`);
    
    // Send tile size with map data
    this.currentMap.tileSize = this.tileSize;
    
    // Broadcast map to all clients
    this.broadcastMapData();
    
    return this.currentMap;
  }

  /**
   * Generate next floor after collapse
   * @returns {Object} - Generated map data
   */
  generateNextFloor() {
    // Increment floor level
    this.floorLevel++;

    // Get current player count
    const playerCount = Math.max(
      1,
      Object.keys(this.room.state.players || {}).length
    );

    // Create generator with scaling based on player count and floor level
    const dungeonSize = Math.max(
      3000, // Minimum size
      5000 + playerCount * 500 - this.floorLevel * 500 // Shrink with each floor
    );

    this.generator = new BSPDungeonGenerator({
      worldSize: 20000,
      dungeonSize: dungeonSize,
      minRoomSize: 5,
      maxRoomSize: 20,
      minLeafSize: Math.max(10, 20 - this.floorLevel), // Smaller leaves on higher floors
      maxLeafSize: Math.max(20, 40 - this.floorLevel * 2),
      playerCount: playerCount,
      tileSize: this.tileSize,
      debug: this.debug,
    });

    // Generate dungeon
    this.currentMap = this.generator.generate();

    console.log(
      `Generated floor ${this.floorLevel} with ${this.currentMap.rooms.length} rooms`
    );

    // Broadcast map to all clients
    this.broadcastMapData();

    // Teleport players to new spawn points
    this.teleportPlayersToSpawns();

    return this.currentMap;
  }

  /**
   * Teleport players to spawn points
   */
  teleportPlayersToSpawns() {
    // Make sure we have spawn points
    if (
      !this.currentMap ||
      !this.currentMap.spawnPoints ||
      this.currentMap.spawnPoints.length === 0
    ) {
      console.error("No spawn points available for teleportation");
      return;
    }

    // Get all players
    const players = Object.entries(this.room.state.players || {});

    // Skip if no players
    if (players.length === 0) {
      console.log("No players to teleport");
      return;
    }

    // Assign spawn points
    players.forEach(([id, player], index) => {
      // Make sure player exists and has a position
      if (!player || !player.position) {
        console.error(`Invalid player object for ID ${id}`);
        return;
      }

      // Get spawn point (wrap if more players than spawns)
      const spawnIndex = index % this.currentMap.spawnPoints.length;
      const spawn = this.currentMap.spawnPoints[spawnIndex];

      // Convert grid to world coordinates
      const worldX = spawn.x * this.tileSize;
      const worldY = spawn.y * this.tileSize;

      // Update player position
      player.position.x = worldX;
      player.position.y = worldY;

      // Add player ID to spawn point for tracking
      spawn.playerId = id;

      // Notify client
      const client = this.room.clients.find((c) => c.id === id);
      if (client) {
        client.send("teleported", {
          x: worldX,
          y: worldY,
          floorLevel: this.floorLevel,
        });
      }
    });
  }

  /**
   * Broadcast map data to all clients
   */
  broadcastMapData() {
    // Skip if no map data
    if (!this.currentMap) return;

    // Prepare room data with templates where applicable
    const rooms = this.prepareRoomData();

    // Prepare corridor data
    const corridors = this.currentMap.corridors.map((corridor) => ({
      s: { x: corridor.start.x, y: corridor.start.y },
      e: { x: corridor.end.x, y: corridor.end.y },
      w: corridor.waypoint
        ? { x: corridor.waypoint.x, y: corridor.waypoint.y }
        : undefined,
      width: corridor.width || 3,
      isSpawnCorridor: corridor.isSpawnCorridor || false,
    }));

    // Identify spawn points
    const spawnPoints = this.currentMap.spawnPoints.map((spawn) => ({
      ...spawn,
      // This will be null for unassigned spawns
      playerId: spawn.playerId || null,
    }));

    // Create map data for clients
    const mapData = {
      worldSize: this.currentMap.worldSize,
      dungeonSize: this.currentMap.dungeonSize,
      floorLevel: this.floorLevel,
      rooms: rooms,
      corridors: corridors,
      spawnPoints: spawnPoints,
      templates: this.prepareTemplateData(),
    };

    // Broadcast to all clients
    this.room.broadcast("mapData", mapData);

    // Debug information
    if (this.debug) {
      const totalRooms = rooms.length;
      const spawnRooms = rooms.filter((r) => r.type === "spawn").length;
      const normalRooms = totalRooms - spawnRooms;

      console.log(
        `Map data broadcast: ${rooms.length} rooms (${normalRooms} normal, ${spawnRooms} spawn), ${corridors.length} corridors`
      );
    }
  }

  /**
   * Prepare room data for clients, using templates where possible
   * @returns {Array} - Array of prepared rooms
   */
  prepareRoomData() {
    if (!this.currentMap || !this.currentMap.rooms) {
      return [];
    }

    return this.currentMap.rooms.map((room) => {
      // Determine if we should use a template or basic layout
      let templateId = null;
      let layout = null;

      // For spawn rooms, always use the spawn template
      if (room.type === "spawn") {
        templateId = "spawn_room";
      }
      // For other rooms, pick based on size
      else if (room.width <= 10 && room.height <= 10) {
        templateId = this.random() < 0.5 ? "small_basic" : "small_pillars";
      } else if (room.width <= 15 && room.height <= 15) {
        templateId = this.random() < 0.5 ? "medium_basic" : "medium_divided";
      } else {
        templateId = this.random() < 0.5 ? "large_basic" : "large_columns";
      }

      // If no suitable template, generate a basic layout
      if (!templateId) {
        layout = generateBasicLayout(room.width, room.height);
      }

      return {
        id: room.id,
        x: room.x,
        y: room.y,
        width: room.width,
        height: room.height,
        type: room.type,
        isSpawn: !!room.isSpawn,
        t: templateId, // Template ID for client-side rendering
        layout: layout, // Only included if no template is used
        connections: room.connections || [],
      };
    });
  }

  /**
   * Prepare template data for clients
   * @returns {Object} - Template data
   */
  prepareTemplateData() {
    const templates = {
      spawn_room: getTemplateById("spawn_room"),
      small_basic: getTemplateById("small_basic"),
      small_pillars: getTemplateById("small_pillars"),
      medium_basic: getTemplateById("medium_basic"),
      medium_divided: getTemplateById("medium_divided"),
      large_basic: getTemplateById("large_basic"),
      large_columns: getTemplateById("large_columns"),
    };

    // Remove any null templates
    Object.keys(templates).forEach((key) => {
      if (!templates[key]) {
        delete templates[key];
      }
    });

    return templates;
  }

  /**
   * Get spawn position for a new player
   * @returns {Object} - Spawn position {x, y}
   */
  getSpawnPosition() {
    // Default spawn at center if no map
    if (!this.currentMap || !this.currentMap.spawnPoints || this.currentMap.spawnPoints.length === 0) {
      console.warn("No spawn points available, using center of world");
      return { 
        x: this.worldTileWidth * this.tileSize / 2, 
        y: this.worldTileHeight * this.tileSize / 2 
      };
    }
    
    // Find an unassigned spawn point
    const unassignedSpawns = this.currentMap.spawnPoints.filter(spawn => !spawn.playerId);
    
    // If all spawns are assigned, pick a random one
    const spawn = unassignedSpawns.length > 0 
      ? unassignedSpawns[Math.floor(Math.random() * unassignedSpawns.length)]
      : this.currentMap.spawnPoints[Math.floor(Math.random() * this.currentMap.spawnPoints.length)];
    
    // Ensure spawn has valid coordinates
    if (isNaN(spawn.x) || isNaN(spawn.y)) {
      console.error("Invalid spawn point coordinates:", spawn);
      return { 
        x: this.worldTileWidth * this.tileSize / 2, 
        y: this.worldTileHeight * this.tileSize / 2 
      };
    }
    
    // Convert to world coordinates
    const worldX = spawn.x * this.tileSize;
    const worldY = spawn.y * this.tileSize;
    
    console.log(`Assigning spawn point at tile (${spawn.x}, ${spawn.y}) => pixel (${worldX}, ${worldY})`);
    
    // Mark this spawn as assigned
    spawn.playerId = spawn.playerId || "pending"; 
    
    return {
      x: worldX,
      y: worldY
    };
  }

  /**
   * Get current map data for a specific client
   * @param {string} clientId - Client ID to customize for
   * @returns {Object} - Map data
   */
  getCurrentMapData(clientId) {
    if (!this.currentMap) {
      return null;
    }

    // Clone map data
    const mapData = {
      worldSize: this.currentMap.worldSize,
      dungeonSize: this.currentMap.dungeonSize,
      floorLevel: this.floorLevel,
      rooms: this.prepareRoomData(),
      corridors: this.currentMap.corridors.map((corridor) => ({
        s: { x: corridor.start.x, y: corridor.start.y },
        e: { x: corridor.end.x, y: corridor.end.y },
        w: corridor.waypoint
          ? { x: corridor.waypoint.x, y: corridor.waypoint.y }
          : undefined,
        width: corridor.width || 3,
        isSpawnCorridor: corridor.isSpawnCorridor || false,
      })),
      spawnPoints: [...this.currentMap.spawnPoints],
      templates: this.prepareTemplateData(),
    };

    // Mark which spawn point belongs to this client
    if (clientId) {
      mapData.spawnPoints.forEach((spawn) => {
        spawn.isYours = spawn.playerId === clientId;
      });
    }

    return mapData;
  }

  /**
   * Simple random function for template selection
   * @returns {number} - Random number between 0 and 1
   */
  random() {
    return Math.random();
  }
}
