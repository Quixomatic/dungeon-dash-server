// systems/MapManager.js - Updated to use the EnhancedBSPGenerator

import { EnhancedBSPGenerator } from "./EnhancedBSPGenerator.js";
import { ROOM_TEMPLATES, getTemplateById } from "./RoomTemplates.js";
import roomTemplates from "../dungeonGenerator/roomTemplates.js";
import { generate } from "../dungeonGenerator/dungeon.js";

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

    // Define dungeon size in TILES, not pixels
    const dungeonTileSize = Math.floor(100 + playerCount * 5); // e.g., 120 tiles for 4 players

    // Create generator with tile-based dimensions and improved parameters
    this.generator = new EnhancedBSPGenerator({
      worldTileSize: this.worldTileWidth,
      dungeonTileSize: dungeonTileSize,
      minRoomSize: 15, // Minimum room size in tiles
      maxRoomSize: 24, // Maximum room size in tiles
      minLeafSize: 18, // Minimum leaf size for BSP in tiles
      maxLeafSize: 40, // Maximum leaf size for BSP in tiles
      playerCount: playerCount,
      tileSize: this.tileSize, // Pass tile size for later conversion

      // Enhanced parameters from reference implementation
      containerSplitRetries: 30,
      containerMinimumRatio: 0.45,
      corridorWidth: 3,
      seed: `dungeon_${Date.now()}`,
      debug: this.debug,
    });

    /**
     * Example usage of new floor generator, but the generated data structure is completely
     * different from the original dungeon generator. So we will need to adapt either the returned
     * data or the change the client to use the new data structure.
     * 
     * This is currently not used at all, but it is a good example of how to use the new generator.
     */
    const testNewMapData = generate({
      rooms: roomTemplates, // You'll provide this
      mapWidth: 96,
      mapHeight: 56,
      mapGutterWidth: 1,
      iterations: 5,
      containerSplitRetries: 20,
      containerMinimumRatio: 0.45,
      containerMinimumSize: 4,
      corridorWidth: 2,
      seed: `dungeon_${Date.now()}`,
    });

    // Generate dungeon with room templates
    this.currentMap = this.generator.generate(ROOM_TEMPLATES);

    console.log(
      `Generated floor ${this.floorLevel} with ${this.currentMap.rooms.length} rooms`
    );

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
    const dungeonTileSize = Math.max(
      50, // Minimum size in tiles
      100 + playerCount * 5 - this.floorLevel * 5 // Shrink with each floor
    );

    this.generator = new EnhancedBSPGenerator({
      worldTileSize: this.worldTileWidth,
      dungeonTileSize: dungeonTileSize,
      minRoomSize: 5,
      maxRoomSize: 15,
      minLeafSize: Math.max(10, 20 - this.floorLevel), // Smaller leaves on higher floors
      maxLeafSize: Math.max(20, 40 - this.floorLevel * 2),
      playerCount: playerCount,
      tileSize: this.tileSize,

      // Enhanced parameters
      containerSplitRetries: 20,
      containerMinimumRatio: 0.45,
      corridorWidth: 3,
      seed: `dungeon_floor_${this.floorLevel}_${Date.now()}`,
      debug: this.debug,
    });

    // Generate dungeon with room templates
    this.currentMap = this.generator.generate(ROOM_TEMPLATES);

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

    // Prepare room templates if needed
    let templates = {};

    // Check for template references in rooms
    this.currentMap.rooms.forEach((room) => {
      if (room.t) {
        const template = getTemplateById(room.t);
        if (template) {
          templates[room.t] = template;
        }
      }
    });

    // Create map data for clients
    const mapData = {
      worldTileWidth: this.currentMap.worldTileWidth,
      worldTileHeight: this.currentMap.worldTileHeight,
      dungeonTileWidth: this.currentMap.dungeonTileWidth,
      dungeonTileHeight: this.currentMap.dungeonTileHeight,
      floorLevel: this.floorLevel,
      rooms: this.currentMap.rooms,
      corridors: this.currentMap.corridors,
      spawnPoints: this.currentMap.spawnPoints,
      tileSize: this.tileSize,
      templates: Object.keys(templates).length > 0 ? templates : undefined,
    };

    // Broadcast to all clients
    this.room.broadcast("mapData", mapData);

    // Debug information
    if (this.debug) {
      console.log(
        `Map data broadcast with ${mapData.rooms.length} rooms and ${mapData.corridors.length} corridors`
      );
      console.log(`Included ${Object.keys(templates).length} room templates`);
    }
  }

  /**
   * Get spawn position for a new player
   * @returns {Object} - Spawn position {x, y}
   */
  getSpawnPosition() {
    // If we have a generator, use it to get a spawn position
    if (this.generator) {
      return this.generator.getSpawnPosition();
    }

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

    // Prepare room templates if needed
    let templates = {};

    // Check for template references in rooms
    this.currentMap.rooms.forEach((room) => {
      if (room.t) {
        const template = getTemplateById(room.t);
        if (template) {
          templates[room.t] = template;
        }
      }
    });

    // Clone map data
    const mapData = {
      worldTileWidth: this.currentMap.worldTileWidth,
      worldTileHeight: this.currentMap.worldTileHeight,
      dungeonTileWidth: this.currentMap.dungeonTileWidth,
      dungeonTileHeight: this.currentMap.dungeonTileHeight,
      floorLevel: this.floorLevel,
      rooms: this.currentMap.rooms,
      corridors: this.currentMap.corridors,
      spawnPoints: [...this.currentMap.spawnPoints],
      tileSize: this.tileSize,
      templates: Object.keys(templates).length > 0 ? templates : undefined,
    };

    // Mark which spawn point belongs to this client
    if (clientId) {
      mapData.spawnPoints.forEach((spawn) => {
        spawn.isYours = spawn.playerId === clientId;
      });
    }

    return mapData;
  }
}
