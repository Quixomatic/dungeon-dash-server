// systems/MapManager.js - Updated to use the new dungeon generator

import { generate } from "../dungeonGenerator/dungeon.js";
import { generateV3 } from "../dungeonGenerator/dungeonV3.js";
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
    this.worldTileWidth = 512; // 20,000 ÷ 64 ≈ 312 tiles wide
    this.worldTileHeight = 512; // 20,000 ÷ 64 ≈ 312 tiles high
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
      (config.worldSize || 32768) / this.tileSize
    );
    this.worldTileHeight = Math.floor(
      (config.worldSize || 32768) / this.tileSize
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
    console.log("Generating first dungeon floor with V3 generator");

    // Get player count (or use a minimum of 4)
    const playerCount = Math.max(
      4,
      Object.keys(this.room.state.players || {}).length
    );

    // Define dungeon size in TILES
    const dungeonSize = Math.floor(300 + playerCount * 10);

    // Generate the dungeon with the V3 generator
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

    // Calculate dungeon size - smaller on higher floors
    const dungeonSize = Math.max(
      100, // Minimum size in tiles
      200 + playerCount * 10 - this.floorLevel * 10
    );

    // Generate the dungeon with the V3 generator
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
   * Generate a dungeon using the new V3 generator
   * @param {Object} options - Generation options
   * @returns {Object} - Generated dungeon data
   */
  generateDungeon(options) {
    const { playerCount = 4, dungeonSize = 100, floorLevel = 1 } = options;

    // Configure parameters for the V3 generator
    const generatorConfig = {
      // Main dungeon dimensions
      mapWidth: dungeonSize,
      mapHeight: dungeonSize,

      // Buffer zone width (for spawn rooms)
      bufferZoneWidth: 50,

      // Number of spawn rooms per side (adjust based on player count)
      spawnRoomsPerSide: 25, //Math.max(3, Math.min(8, Math.ceil(playerCount / 4))),

      // BSP generation parameters
      iterations: Math.max(3, Math.min(6, Math.floor(dungeonSize / 20))),
      containerSplitRetries: 30,
      containerMinimumRatio: 0.45,
      containerMinimumSize: 4,
      corridorWidth: 4,

      // Room templates
      rooms: roomTemplates,

      // Spawn room size
      spawnRoomSize: 5,

      // Random seed
      seed: `dungeon_floor_${floorLevel}_${Date.now()}`,
    };

    // Generate the dungeon using V3 generator
    console.log("Generating dungeon with V3 generator:", generatorConfig);
    const dungeonData = generateV3(generatorConfig);

    if (this.debug) {
      console.log(
        `V3 dungeon generated with size ${dungeonSize}x${dungeonSize}, including buffer zones`
      );
      console.log(`Total map size: ${dungeonData.width}x${dungeonData.height}`);
      console.log(`Spawn points: ${dungeonData.spawnPoints.length}`);
    }

    return dungeonData;
  }

  /**
   * Prepare map data for client
   * @param {Object} dungeonData - Generated dungeon data
   * @returns {Object} - Map data ready for client
   */
  prepareMapDataForClient(dungeonData) {
    // Extract spawn points from the dungeon data
    const spawnPoints = dungeonData.spawnPoints.map((spawnPoint) => ({
      roomId: spawnPoint.id,
      x: spawnPoint.x,
      y: spawnPoint.y,
      playerId: null,
    }));

    // Add room and corridor structural data
    const structuralData = this.extractStructuralData(dungeonData.tree);

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

      // Add metadata about main dungeon position
      mainDungeon: dungeonData.mainDungeon,

      // Add structural data for optimized rendering
      structural: {
        rooms: structuralData.rooms,
        corridors: structuralData.corridors,
        spawnRooms: structuralData.spawnRooms,
      },

      hierarchicalTree: this.extractSimplifiedTree(dungeonData.tree),

      // Store a unique map ID for reference
      id: `floor_${this.floorLevel}_${Date.now()}`,
    };
  }

  // Helper function to extract structural data from tree
  extractStructuralData(tree) {
    const rooms = [];
    const corridors = [];
    const spawnRooms = [];

    // Helper to extract data recursively
    function extractFromNode(node, type = "dungeon") {
      if (!node) return;

      // Extract room if present
      if (node.leaf && node.leaf.room) {
        const room = {
          id: node.leaf.room.id,
          x: node.leaf.room.x,
          y: node.leaf.room.y,
          width: node.leaf.room.width,
          height: node.leaf.room.height,
          type: node.leaf.room.template?.type || "unknown",
          isSpawn: type === "spawn",
        };

        if (type === "spawn") {
          spawnRooms.push(room);
        } else {
          rooms.push(room);
        }
      }

      // Extract corridor if present
      if (node.leaf && node.leaf.corridor) {
        corridors.push({
          x: node.leaf.corridor.x,
          y: node.leaf.corridor.y,
          width: node.leaf.corridor.width,
          height: node.leaf.corridor.height,
          direction:
            node.leaf.corridor.direction ||
            (node.leaf.corridor.width > node.leaf.corridor.height
              ? "horizontal"
              : "vertical"),
        });

        // Include second segment for L-shaped corridors
        if (node.leaf.corridor.secondSegment) {
          corridors.push({
            x: node.leaf.corridor.secondSegment.x,
            y: node.leaf.corridor.secondSegment.y,
            width: node.leaf.corridor.secondSegment.width,
            height: node.leaf.corridor.secondSegment.height,
            direction:
              node.leaf.corridor.secondSegment.width >
              node.leaf.corridor.secondSegment.height
                ? "horizontal"
                : "vertical",
            isSecondSegment: true,
          });
        }
      }

      // Traverse BSP tree
      if (node.left) extractFromNode(node.left, type);
      if (node.right) extractFromNode(node.right, type);

      // Traverse children array (for spawn rooms)
      if (node.children) {
        node.children.forEach((child) => {
          extractFromNode(
            child,
            node.leaf && node.leaf.id?.includes("buffer") ? "spawn" : type
          );
        });
      }
    }

    extractFromNode(tree);

    return { rooms, corridors, spawnRooms };
  }

  /**
   * Extract a simplified tree structure for culling
   * @param {Object} treeNode - Tree node from dungeon generator
   * @returns {Object} - Simplified tree structure
   */
  extractSimplifiedTree(treeNode) {
    if (!treeNode) return null;

    // Create a simplified node with just the spatial data
    const simplifiedNode = {
      bounds: treeNode.leaf
        ? {
            x: treeNode.leaf.x,
            y: treeNode.leaf.y,
            width: treeNode.leaf.width,
            height: treeNode.leaf.height,
            id: treeNode.leaf.id || "unknown",
            type: treeNode.leaf.isSpawn ? "spawn" : "dungeon",
          }
        : null,
      children: [],
    };

    // Add children from BSP tree (left/right)
    if (treeNode.left) {
      simplifiedNode.children.push(this.extractSimplifiedTree(treeNode.left));
    }

    if (treeNode.right) {
      simplifiedNode.children.push(this.extractSimplifiedTree(treeNode.right));
    }

    // Add children from list (for buffer zones)
    if (treeNode.children && treeNode.children.length) {
      treeNode.children.forEach((child) => {
        simplifiedNode.children.push(this.extractSimplifiedTree(child));
      });
    }

    return simplifiedNode;
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
