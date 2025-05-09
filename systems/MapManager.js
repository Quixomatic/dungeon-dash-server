// systems/MapManager.js - Updated to use the new dungeon generator

import { generate } from "../dungeonGenerator/dungeon.js";
import { addSpawnRooms } from "../dungeonGenerator/spawnRoomGenerator.js";
import roomTemplates from "../dungeonGenerator/roomTemplates.js";

/**
 * MapManager - Manages dungeon map generation and distribution
 */
export class MapManager {
  constructor(room) {
    this.room = room;
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
    this.worldTileWidth = Math.floor(
      (config.worldSize || 20000) / this.tileSize
    );
    this.worldTileHeight = Math.floor(
      (config.worldSize || 20000) / this.tileSize
    );

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
    const playerCount = Math.max(
      4,
      Object.keys(this.room.state.players || {}).length
    );

    // DOUBLED: Define dungeon size in TILES, not pixels
    const dungeonSize = Math.floor(200 + playerCount * 10); // Doubled from (100 + playerCount * 5)

    // Generate the dungeon with the new generator
    const dungeonData = this.generateDungeon({
      playerCount,
      dungeonSize,
      floorLevel: this.floorLevel,
    });

    // Convert to the format expected by client
    this.currentMap = this.prepareMapDataForClient(dungeonData);

    console.log(
      `Generated floor ${this.floorLevel} with dungeon size ${dungeonSize}x${dungeonSize}`
    );

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

    // DOUBLED: Calculate dungeon size - smaller on higher floors
    const dungeonSize = Math.max(
      100, // Minimum size in tiles (doubled from 50)
      200 + playerCount * 10 - this.floorLevel * 10 // Doubled from (100 + playerCount * 5 - this.floorLevel * 5)
    );

    // Generate the dungeon with the new generator
    const dungeonData = this.generateDungeon({
      playerCount,
      dungeonSize,
      floorLevel: this.floorLevel,
    });

    // Convert to the format expected by client
    this.currentMap = this.prepareMapDataForClient(dungeonData);

    console.log(
      `Generated floor ${this.floorLevel} with dungeon size ${dungeonSize}x${dungeonSize}`
    );

    // Broadcast map to all clients
    this.broadcastMapData();

    // Teleport players to new spawn points
    this.teleportPlayersToSpawns();

    return this.currentMap;
  }

  /**
   * Generate a dungeon using the new generator
   * @param {Object} options - Generation options
   * @returns {Object} - Generated dungeon data
   */
  generateDungeon(options) {
    const { playerCount = 4, dungeonSize = 100, floorLevel = 1 } = options;

    // Configure parameters for the generator
    const generatorConfig = {
      rooms: roomTemplates,
      mapWidth: dungeonSize,
      mapHeight: dungeonSize,
      mapGutterWidth: 20,
      iterations: 6,//Math.max(3, Math.min(6, Math.floor(dungeonSize / 20))),
      containerSplitRetries: 30,
      containerMinimumRatio: 0.45,
      containerMinimumSize: 4,
      corridorWidth: 4,
      seed: `dungeon_floor_${floorLevel}_${Date.now()}`,
    };

    // Generate the basic dungeon
    console.log("Generating dungeon with config:", generatorConfig);
    const dungeonData = generate(generatorConfig);

    if (this.debug) {
      console.log(
        `Base dungeon generated with size ${dungeonSize}x${dungeonSize}`
      );
    }

    // Add spawn rooms around the dungeon
    const spawnRoomConfig = {
      playerCount,
      bufferDistance: 5,
      spawnRoomSize: 5,
      templates: roomTemplates,
      gutterWidth: generatorConfig.mapGutterWidth // Pass the gutter width
    };

    const expandedDungeon = addSpawnRooms(dungeonData, spawnRoomConfig);

    if (this.debug) {
      console.log(`Added ${playerCount} spawn rooms to dungeon`);
      console.log(
        `Expanded size: ${expandedDungeon.width}x${expandedDungeon.height}`
      );
    }

    return expandedDungeon;
  }

  /**
   * Prepare map data for client
   * @param {Object} dungeonData - Generated dungeon data
   * @returns {Object} - Map data ready for client
   */
  prepareMapDataForClient(dungeonData) {
    // Extract spawn points from the dungeon data
    const spawnPoints = (dungeonData.spawnRooms || []).map((room) => ({
      roomId: room.id,
      x: room.center ? room.center.x : room.x + Math.floor(room.width / 2),
      y: room.center ? room.center.y : room.y + Math.floor(room.height / 2),
      playerId: null,
    }));

    // Return a format that includes both raw layer data and higher-level info
    return {
      // World dimensions in tiles
      worldTileWidth: this.worldTileWidth,
      worldTileHeight: this.worldTileHeight,

      // Dungeon dimensions
      dungeonTileWidth: dungeonData.width,
      dungeonTileHeight: dungeonData.height,

      // Floor info
      floorLevel: this.floorLevel,

      // Tile size
      tileSize: this.tileSize,

      // Spawn information
      spawnPoints,

      // Include the raw layer data
      layers: dungeonData.layers,

      // Add a reference to the tree structure if needed
      // tree: dungeonData.tree, // Only include if client needs it

      // Additional metadata that might be useful
      offset: {
        x: dungeonData.dungeonOffsetX || 0,
        y: dungeonData.dungeonOffsetY || 0,
      },

      // Store a unique map ID for reference
      id: `floor_${this.floorLevel}_${Date.now()}`,
    };
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

      // Convert tile coordinates to world coordinates
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

    // Broadcast to all clients
    this.room.broadcast("mapData", this.currentMap);

    // Debug information
    if (this.debug) {
      console.log(`Map data broadcast for floor ${this.currentMap.floorLevel}`);
      console.log(
        `Dungeon size: ${this.currentMap.dungeonTileWidth}x${this.currentMap.dungeonTileHeight}`
      );
      console.log(`Spawn points: ${this.currentMap.spawnPoints.length}`);
    }
  }

  /**
   * Get spawn position for a new player
   * @returns {Object} - Spawn position {x, y}
   */
  getSpawnPosition() {
    // Default spawn at center if no map
    if (
      !this.currentMap ||
      !this.currentMap.spawnPoints ||
      this.currentMap.spawnPoints.length === 0
    ) {
      console.warn("No spawn points available, using center of world");
      return {
        x: (this.worldTileWidth * this.tileSize) / 2,
        y: (this.worldTileHeight * this.tileSize) / 2,
      };
    }

    // Find an unassigned spawn point
    const unassignedSpawns = this.currentMap.spawnPoints.filter(
      (spawn) => !spawn.playerId
    );

    // If all spawns are assigned, pick a random one
    const spawn =
      unassignedSpawns.length > 0
        ? unassignedSpawns[Math.floor(Math.random() * unassignedSpawns.length)]
        : this.currentMap.spawnPoints[
            Math.floor(Math.random() * this.currentMap.spawnPoints.length)
          ];

    // Ensure spawn has valid coordinates
    if (isNaN(spawn.x) || isNaN(spawn.y)) {
      console.error("Invalid spawn point coordinates:", spawn);
      return {
        x: (this.worldTileWidth * this.tileSize) / 2,
        y: (this.worldTileHeight * this.tileSize) / 2,
      };
    }

    // Convert to world coordinates
    const worldX = spawn.x * this.tileSize;
    const worldY = spawn.y * this.tileSize;

    console.log(
      `Assigning spawn point at tile (${spawn.x}, ${spawn.y}) => pixel (${worldX}, ${worldY})`
    );

    // Mark this spawn as assigned
    spawn.playerId = spawn.playerId || "pending";

    return {
      x: worldX,
      y: worldY,
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
    const mapData = { ...this.currentMap };

    // Make a deep copy of spawn points
    mapData.spawnPoints = [...this.currentMap.spawnPoints];

    // Mark which spawn point belongs to this client
    if (clientId) {
      mapData.spawnPoints.forEach((spawn) => {
        spawn.isYours = spawn.playerId === clientId;
      });
    }

    return mapData;
  }
}
