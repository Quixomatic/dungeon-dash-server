// systems/EnhancedBSPGenerator.js

/**
 * EnhancedBSPGenerator - A streamlined version of the BSP dungeon generator
 * inspired by halftheopposite/bsp-dungeon-generator
 */
export class EnhancedBSPGenerator {
  /**
   * Constructor with configuration options
   * @param {Object} config - Configuration parameters
   */
  constructor(config = {}) {
    // Default configuration with essential parameters
    this.config = {
      worldTileSize: config.worldTileSize || 312, // World size in tiles
      dungeonTileSize: config.dungeonTileSize || 100, // Dungeon size in tiles

      // Room size constraints
      minRoomSize: config.minRoomSize || 5, // Minimum room size in tiles
      maxRoomSize: config.maxRoomSize || 20, // Maximum room size in tiles

      // BSP split constraints
      minLeafSize: config.minLeafSize || 20, // Minimum leaf size for BSP in tiles
      maxLeafSize: config.maxLeafSize || 50, // Maximum leaf size for BSP in tiles
      splitVariance: config.splitVariance || 0.3, // How far from center splits can occur (0-0.5)

      // Reference implementation parameters
      containerSplitRetries: config.containerSplitRetries || 10, // Number of retries for splitting
      containerMinimumRatio: config.containerMinimumRatio || 0.45, // Minimum width/height ratio
      mapGutterWidth: config.mapGutterWidth || 1, // Space at map edges

      // Other parameters
      roomPadding: config.roomPadding || 1, // Space between rooms in tiles
      corridorWidth: config.corridorWidth || 3, // Width of corridors in tiles
      seed: config.seed || String(Math.floor(Math.random() * 1000000)), // Random seed
      playerCount: config.playerCount || 4, // Number of players
      spawnRoomDistance: config.spawnRoomDistance || 40, // Distance from dungeon edge to spawn rooms in tiles
      tileSize: config.tileSize || 64, // Size of a tile in pixels
      debug: config.debug || false, // Debug mode
    };

    // Internal state
    this.leaves = []; // BSP leaves
    this.rooms = []; // Generated rooms
    this.corridors = []; // Corridors between rooms
    this.spawnRooms = []; // Player spawn rooms on the outskirts

    // Random generator
    this.random = this.createRandomGenerator(this.config.seed);

    // Debug logging if enabled
    if (this.config.debug) {
      console.log("EnhancedBSPGenerator initialized with config:", this.config);
    }
  }

  /**
   * Create a seeded random number generator
   * @param {string} seed - Seed string
   * @returns {Function} - Random function that returns 0-1
   */
  createRandomGenerator(seed) {
    // Create a local state based on seed hash that won't affect Math.random
    let state = this.hashString(seed);

    // Return a function that generates random numbers
    return function () {
      // Use xorshift algorithm for better randomness
      state ^= state << 13;
      state ^= state >>> 17;
      state ^= state << 5;

      // Convert to 0-1 range (ensuring positive)
      return ((state >>> 0) / 4294967296) % 1;
    };
  }

  /**
   * Hash a string to a number
   * @param {string} str - Input string
   * @returns {number} - Hash value
   */
  hashString(str) {
    let hash = 1;

    // Use simple but effective string hashing
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash = hash & hash; // Convert to 32bit integer
    }

    return Math.abs(hash);
  }

  /**
   * Generate a random integer between min and max (inclusive)
   * @param {number} min - Minimum value
   * @param {number} max - Maximum value
   * @returns {number} - Random integer
   */
  randomInt(min, max) {
    return Math.floor(this.random() * (max - min + 1)) + min;
  }

  /**
   * Generate the complete dungeon
   * @param {Object} roomTemplates - Optional room templates from RoomTemplates.js
   * @returns {Object} - Generated dungeon data
   */
  generate(roomTemplates = null) {
    console.time("dungeonGeneration");

    // Reset state
    this.leaves = [];
    this.rooms = [];
    this.corridors = [];
    this.spawnRooms = [];

    // Calculate dungeon position (centered in world) - in TILES
    const dungeonX = Math.floor(
      (this.config.worldTileSize - this.config.dungeonTileSize) / 2
    );
    const dungeonY = Math.floor(
      (this.config.worldTileSize - this.config.dungeonTileSize) / 2
    );

    // Create root leaf for the dungeon area
    const rootLeaf = new BSPLeaf(
      dungeonX,
      dungeonY,
      this.config.dungeonTileSize,
      this.config.dungeonTileSize
    );

    this.leaves.push(rootLeaf);

    // Recursively split the dungeon area
    this.splitLeaves(rootLeaf);

    // Create rooms in the leaves with templates
    this.createRooms(roomTemplates);

    // Connect rooms with corridors
    this.createCorridors();

    // Create spawn rooms around the outskirts with templates
    this.createSpawnRooms(roomTemplates);

    console.timeEnd("dungeonGeneration");

    if (this.config.debug) {
      console.log(
        `Generated dungeon with ${this.rooms.length} rooms and ${this.spawnRooms.length} spawn rooms`
      );
    }

    // Create serializable versions of rooms (without circular references)
    const serializableRooms = this.rooms.map((room) => {
      // Create a copy of the room without the leaf reference
      const { leaf, ...roomData } = room;
      return roomData;
    });

    const serializableSpawnRooms = this.spawnRooms.map((room) => {
      // Create a copy without any potential circular references
      const { leaf, ...roomData } = room;
      return roomData;
    });

    // Return dungeon data with serializable rooms
    return {
      worldTileWidth: this.config.worldTileSize,
      worldTileHeight: this.config.worldTileSize,
      dungeonTileWidth: this.config.dungeonTileSize,
      dungeonTileHeight: this.config.dungeonTileSize,
      rooms: [...serializableRooms, ...serializableSpawnRooms],
      corridors: this.corridors,
      tileSize: this.config.tileSize,
      spawnPoints: this.spawnRooms.map((room) => {
        // Explicitly calculate center position in tile coordinates
        const centerX = Math.floor(room.x + room.width / 2);
        const centerY = Math.floor(room.y + room.height / 2);

        return {
          roomId: room.id,
          x: centerX,
          y: centerY,
          playerId: room.playerId || null,
        };
      }),
    };
  }

  /**
   * Recursively split leaves to create dungeon sections
   * @param {BSPLeaf} leaf - Leaf to split
   * @param {number} depth - Current recursion depth
   */
  splitLeaves(leaf, depth = 0) {
    // Only split if the leaf is larger than the maximum size
    // or with decreasing probability as we go deeper
    if (
      leaf.width > this.config.maxLeafSize ||
      leaf.height > this.config.maxLeafSize ||
      (depth < 8 && this.random() > 0.3)
    ) {
      // Try splitting with retries
      let splitSuccessful = false;
      let attempts = 0;

      while (!splitSuccessful && attempts < this.config.containerSplitRetries) {
        attempts++;

        // Determine how much variation to allow in split position
        // We allow more heterogeneous splits in deeper levels
        const varianceByDepth = Math.max(
          0.1,
          this.config.splitVariance - depth * 0.05
        );

        // Try to split the leaf
        splitSuccessful = leaf.split(
          this.random,
          this.config.minLeafSize,
          varianceByDepth,
          this.config.containerMinimumRatio
        );

        // If split failed but we have retries left, we'll try again
        if (
          !splitSuccessful &&
          this.config.debug &&
          attempts === this.config.containerSplitRetries
        ) {
          console.log(`Failed to split leaf after ${attempts} attempts`);
        }
      }

      // If splitting was successful, continue recursion
      if (splitSuccessful) {
        this.leaves.push(leaf.leftChild);
        this.leaves.push(leaf.rightChild);

        // Recursively split children
        this.splitLeaves(leaf.leftChild, depth + 1);
        this.splitLeaves(leaf.rightChild, depth + 1);
      }
    }
  }

  /**
   * Create rooms inside the leaves
   * @param {Object} roomTemplates - Room templates object from RoomTemplates.js
   */
  createRooms(roomTemplates = null) {
    // Process leaves that don't have children (end nodes)
    for (let i = 0; i < this.leaves.length; i++) {
      const leaf = this.leaves[i];

      // Skip if this leaf has children
      if (leaf.leftChild || leaf.rightChild) {
        continue;
      }

      // Determine room type based on leaf size
      const roomType = this.determineRoomType(leaf, this.leaves);

      // Try to get a template for this room type
      const template = roomTemplates
        ? this.getTemplateForRoom(roomType, roomTemplates)
        : null;

      // Determine room size and position
      let roomWidth, roomHeight, roomX, roomY;

      // Room size is random but proportional to leaf size
      roomWidth = this.randomInt(
        Math.max(this.config.minRoomSize, Math.floor(leaf.width * 0.6)),
        Math.min(
          leaf.width - this.config.roomPadding * 2,
          Math.floor(leaf.width * 0.9)
        )
      );

      roomHeight = this.randomInt(
        Math.max(this.config.minRoomSize, Math.floor(leaf.height * 0.6)),
        Math.min(
          leaf.height - this.config.roomPadding * 2,
          Math.floor(leaf.height * 0.9)
        )
      );

      // Position room within leaf (with padding)
      roomX =
        leaf.x +
        this.randomInt(
          this.config.roomPadding,
          leaf.width - roomWidth - this.config.roomPadding
        );

      roomY =
        leaf.y +
        this.randomInt(
          this.config.roomPadding,
          leaf.height - roomHeight - this.config.roomPadding
        );

      // Create room WITHOUT storing a reference to the leaf (prevents circular reference)
      const room = {
        id: `room_${this.rooms.length}`,
        leafId: i, // Store index instead of direct reference
        x: roomX,
        y: roomY,
        width: roomWidth,
        height: roomHeight,
        type: roomType,
        connections: [],
      };

      // Apply template if available
      if (template) {
        room.layout = template.layout;
        room.objects = template.objects;
        room.t = template.id; // Store template ID for client-side rendering
      }

      // Store room in leaf
      leaf.room = room;

      // Add to rooms list
      this.rooms.push(room);
    }
  }

  /**
   * Get a suitable template for a room
   * @param {string} roomType - Type of room (small, medium, large, spawn)
   * @param {Object} roomTemplates - Room templates object from RoomTemplates.js
   * @returns {Object|null} - Selected template or null if none available
   */
  getTemplateForRoom(roomType, roomTemplates) {
    // If no templates provided, return null
    if (!roomTemplates || Object.keys(roomTemplates).length === 0) {
      return null;
    }

    // Find templates matching the room type
    const matchingTemplates = Object.values(roomTemplates).filter(
      (template) => template.type === roomType
    );

    // If no matching templates, return null
    if (matchingTemplates.length === 0) {
      return null;
    }

    // Select a random template from matching ones
    const templateIndex = Math.floor(this.random() * matchingTemplates.length);
    return matchingTemplates[templateIndex];
  }

  /**
   * Determine room type based on position and size
   * @param {BSPLeaf} leaf - The leaf containing the room
   * @param {Array} allLeaves - All leaves in the dungeon
   * @returns {string} - Room type (small, medium, large)
   */
  determineRoomType(leaf, allLeaves) {
    // Calculate room size relative to other rooms
    const areaRatio =
      (leaf.width * leaf.height) /
      (this.config.maxLeafSize * this.config.maxLeafSize);

    if (areaRatio < 0.3) {
      return "small";
    } else if (areaRatio < 0.7) {
      return "medium";
    } else {
      return "large";
    }
  }

  /**
   * Create corridors connecting the rooms
   */
  createCorridors() {
    // First, ensure we have the minimum spanning tree connections
    // This ensures all rooms are connected in a logical way
    this.createMinimumSpanningTree();

    // Then add some extra connections for loop paths (with a certain probability)
    this.addExtraCorridors();
  }

  /**
   * Create a minimum spanning tree to connect all rooms
   * This ensures all rooms are connected without any isolated sections
   */
  createMinimumSpanningTree() {
    // If no rooms, return
    if (this.rooms.length === 0) return;

    // Keep track of connected and unconnected rooms
    const connected = new Set([this.rooms[0].id]);
    const unconnected = new Set(this.rooms.slice(1).map((room) => room.id));

    // Continue until all rooms are connected
    while (unconnected.size > 0) {
      let bestDistance = Infinity;
      let bestConnection = null;

      // For each connected room, find the closest unconnected room
      for (const connectedId of connected) {
        const connectedRoom = this.rooms.find(
          (room) => room.id === connectedId
        );

        for (const unconnectedId of unconnected) {
          const unconnectedRoom = this.rooms.find(
            (room) => room.id === unconnectedId
          );

          // Calculate distance between room centers
          const dx =
            connectedRoom.x +
            connectedRoom.width / 2 -
            (unconnectedRoom.x + unconnectedRoom.width / 2);
          const dy =
            connectedRoom.y +
            connectedRoom.height / 2 -
            (unconnectedRoom.y + unconnectedRoom.height / 2);
          const distance = dx * dx + dy * dy; // Square distance is fine for comparison

          // If this is the closest pair so far, remember it
          if (distance < bestDistance) {
            bestDistance = distance;
            bestConnection = {
              from: connectedRoom,
              to: unconnectedRoom,
            };
          }
        }
      }

      // Create a corridor between the best connection
      if (bestConnection) {
        this.createCorridor(bestConnection.from, bestConnection.to);

        // Mark the destination room as connected
        connected.add(bestConnection.to.id);
        unconnected.delete(bestConnection.to.id);
      } else {
        // Shouldn't happen, but just in case
        break;
      }
    }
  }

  /**
   * Find a room in a leaf or its children
   * @param {BSPLeaf} leaf - Leaf to search
   * @returns {Object|null} - Room or null if not found
   */
  findRoomInLeaf(leaf) {
    // If leaf has a room, return it
    if (leaf.room) {
      return leaf.room;
    }

    // Otherwise search in children
    if (leaf.leftChild) {
      const room = this.findRoomInLeaf(leaf.leftChild);
      if (room) return room;
    }

    if (leaf.rightChild) {
      const room = this.findRoomInLeaf(leaf.rightChild);
      if (room) return room;
    }

    return null;
  }

  /**
   * Create a corridor between two rooms
   * @param {Object} roomA - First room
   * @param {Object} roomB - Second room
   */
  createCorridor(roomA, roomB) {
    // Find center points of rooms
    const pointA = {
      x: Math.floor(roomA.x + roomA.width / 2),
      y: Math.floor(roomA.y + roomA.height / 2),
    };

    const pointB = {
      x: Math.floor(roomB.x + roomB.width / 2),
      y: Math.floor(roomB.y + roomB.height / 2),
    };

    // Choose corridor type based on distance and room layout
    let corridorType = "L-shaped"; // Default to L-shaped

    // For very close rooms, use straight corridors
    const dx = Math.abs(pointA.x - pointB.x);
    const dy = Math.abs(pointA.y - pointB.y);

    if (dx < 5 || dy < 5) {
      corridorType = "straight";
    }
    // For distant rooms with a 10% chance, use complex corridors
    else if (dx + dy > 50 && this.random() < 0.1) {
      corridorType = "complex";
    }

    // Create corridor based on type
    let corridor;

    switch (corridorType) {
      case "straight":
        corridor = this.createStraightCorridor(pointA, pointB);
        break;
      case "complex":
        corridor = this.createComplexCorridor(pointA, pointB);
        break;
      default:
        // L-shaped is the default
        corridor = this.createLShapedCorridor(pointA, pointB);
    }

    // Add corridor to list
    this.corridors.push(corridor);

    // Mark rooms as connected
    roomA.connections.push(roomB.id);
    roomB.connections.push(roomA.id);

    return corridor;
  }

  /**
   * Create a straight corridor between points
   * @param {Object} pointA - Start point
   * @param {Object} pointB - End point
   * @returns {Object} - Corridor data
   */
  createStraightCorridor(pointA, pointB) {
    return {
      id: `corridor_${this.corridors.length}`,
      start: { x: pointA.x, y: pointA.y },
      end: { x: pointB.x, y: pointB.y },
      width: this.config.corridorWidth,
      type: "straight",
    };
  }

  /**
   * Create an L-shaped corridor between points
   * @param {Object} pointA - Start point
   * @param {Object} pointB - End point
   * @returns {Object} - Corridor data
   */
  createLShapedCorridor(pointA, pointB) {
    // Choose waypoint - either horizontal first, then vertical, or vice versa
    let waypoint;

    if (this.random() < 0.5) {
      waypoint = { x: pointB.x, y: pointA.y };
    } else {
      waypoint = { x: pointA.x, y: pointB.y };
    }

    return {
      id: `corridor_${this.corridors.length}`,
      start: { x: pointA.x, y: pointA.y },
      end: { x: pointB.x, y: pointB.y },
      waypoint: waypoint,
      width: this.config.corridorWidth,
      type: "L-shaped",
    };
  }

  /**
   * Create a complex corridor with multiple segments
   * @param {Object} pointA - Start point
   * @param {Object} pointB - End point
   * @returns {Object} - Corridor data
   */
  createComplexCorridor(pointA, pointB) {
    // Create a corridor that starts at pointA, makes two turns, and ends at pointB
    // First create a point 1/3 of the way from A to B (with some randomness)
    const dx = pointB.x - pointA.x;
    const dy = pointB.y - pointA.y;

    // First waypoint - horizontal offset from point A
    const waypoint1 = {
      x: pointA.x + Math.floor(dx * 0.33 * (0.8 + this.random() * 0.4)),
      y: pointA.y,
    };

    // Second waypoint - vertical from waypoint1 to align with point B's y
    const waypoint2 = {
      x: waypoint1.x,
      y: pointB.y,
    };

    return {
      id: `corridor_${this.corridors.length}`,
      start: { x: pointA.x, y: pointA.y },
      end: { x: pointB.x, y: pointB.y },
      waypoints: [waypoint1, waypoint2],
      width: this.config.corridorWidth,
      type: "complex",
    };
  }

  /**
   * Add extra corridors for better connectivity
   */
  addExtraCorridors() {
    // Add 10% more corridors for better connectivity
    const extraCorridors = Math.ceil(this.rooms.length * 0.1);

    for (let i = 0; i < extraCorridors; i++) {
      // Pick two random rooms
      const roomA = this.rooms[this.randomInt(0, this.rooms.length - 1)];
      let roomB;

      // Find a room that isn't already connected to roomA
      let attempts = 0;
      do {
        roomB = this.rooms[this.randomInt(0, this.rooms.length - 1)];
        attempts++;

        // Break if we can't find a suitable room after many attempts
        if (attempts > 50) break;
      } while (roomA === roomB || roomA.connections.includes(roomB.id));

      // If we found a valid room, connect them
      if (roomA !== roomB && !roomA.connections.includes(roomB.id)) {
        this.createCorridor(roomA, roomB);
      }
    }
  }

  /**
   * Create spawn rooms around the dungeon outskirts
   * @param {Object} roomTemplates - Room templates object from RoomTemplates.js
   */
  createSpawnRooms(roomTemplates = null) {
    // Get number of spawn rooms needed (one per player)
    const spawnCount = this.config.playerCount;

    // Calculate dungeon center in tile coordinates
    const dungeonCenterX = Math.floor(this.config.worldTileSize / 2);
    const dungeonCenterY = Math.floor(this.config.worldTileSize / 2);

    // Calculate radius for spawn room placement in tile coordinates
    const spawnRadius =
      Math.floor(this.config.dungeonTileSize / 2) +
      this.config.spawnRoomDistance;

    if (this.config.debug) {
      console.log(
        `Creating ${spawnCount} spawn rooms at radius ${spawnRadius} tiles from center (${dungeonCenterX}, ${dungeonCenterY})`
      );
    }

    // Try to get a spawn room template
    const spawnTemplate = roomTemplates
      ? this.getTemplateForRoom("spawn", roomTemplates)
      : null;

    for (let i = 0; i < spawnCount; i++) {
      // Calculate angle for even distribution around the dungeon
      const angle = (i / spawnCount) * Math.PI * 2;

      // Calculate position on the circle in tile coordinates
      const spawnX = Math.floor(dungeonCenterX + Math.cos(angle) * spawnRadius);
      const spawnY = Math.floor(dungeonCenterY + Math.sin(angle) * spawnRadius);

      // Create spawn room (consistent size)
      const spawnRoomSize = spawnTemplate ? spawnTemplate.width : 10; // Use template size or default to 10

      // Calculate top-left corner of room
      const roomX = spawnX - Math.floor(spawnRoomSize / 2);
      const roomY = spawnY - Math.floor(spawnRoomSize / 2);

      if (this.config.debug) {
        console.log(
          `Spawn room ${i} at position (${roomX}, ${roomY}) with size ${spawnRoomSize}x${spawnRoomSize}`
        );
      }

      const spawnRoom = {
        id: `spawn_${i}`,
        x: roomX,
        y: roomY,
        width: spawnRoomSize,
        height: spawnRoomSize,
        type: "spawn",
        isSpawn: true,
        playerId: null, // Will be assigned later
        connections: [],
      };

      // Apply template if available
      if (spawnTemplate) {
        spawnRoom.layout = spawnTemplate.layout;
        spawnRoom.objects = spawnTemplate.objects;
        spawnRoom.t = spawnTemplate.id; // Store template ID for client-side rendering
      }

      // Add to spawn rooms list
      this.spawnRooms.push(spawnRoom);

      // Connect to nearest dungeon room
      this.connectSpawnRoom(spawnRoom);
    }
  }

  /**
   * Connect a spawn room to the nearest dungeon room
   * @param {Object} spawnRoom - Spawn room to connect
   */
  connectSpawnRoom(spawnRoom) {
    // Find the nearest room in the dungeon
    let nearestRoom = null;
    let shortestDistance = Number.MAX_VALUE;

    const spawnCenter = {
      x: spawnRoom.x + Math.floor(spawnRoom.width / 2),
      y: spawnRoom.y + Math.floor(spawnRoom.height / 2),
    };

    for (const room of this.rooms) {
      const roomCenter = {
        x: room.x + Math.floor(room.width / 2),
        y: room.y + Math.floor(room.height / 2),
      };

      const dx = spawnCenter.x - roomCenter.x;
      const dy = spawnCenter.y - roomCenter.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < shortestDistance) {
        shortestDistance = distance;
        nearestRoom = room;
      }
    }

    // If we found a room, connect it
    if (nearestRoom) {
      const corridor = this.createCorridor(spawnRoom, nearestRoom);

      // Mark corridor as a spawn corridor for visual distinction
      corridor.isSpawnCorridor = true;
    }
  }

  /**
   * Get spawn position for a new player
   * @returns {Object} - Spawn position {x, y}
   */
  getSpawnPosition() {
    // Default spawn at center if no map
    if (!this.spawnRooms || this.spawnRooms.length === 0) {
      console.warn("No spawn points available, using center of world");
      return {
        x: (this.config.worldTileSize * this.config.tileSize) / 2,
        y: (this.config.worldTileSize * this.config.tileSize) / 2,
      };
    }

    // Find an unassigned spawn point
    const unassignedSpawns = this.spawnRooms.filter((spawn) => !spawn.playerId);

    // If all spawns are assigned, pick a random one
    const spawn =
      unassignedSpawns.length > 0
        ? unassignedSpawns[Math.floor(this.random() * unassignedSpawns.length)]
        : this.spawnRooms[Math.floor(this.random() * this.spawnRooms.length)];

    // Ensure spawn has valid coordinates
    if (isNaN(spawn.x) || isNaN(spawn.y)) {
      console.error("Invalid spawn point coordinates:", spawn);
      return {
        x: (this.config.worldTileSize * this.config.tileSize) / 2,
        y: (this.config.worldTileSize * this.config.tileSize) / 2,
      };
    }

    // Calculate center of spawn room in pixel coordinates
    const centerX = Math.floor(spawn.x + spawn.width / 2);
    const centerY = Math.floor(spawn.y + spawn.height / 2);

    // Convert to world coordinates in pixels
    const worldX = centerX * this.config.tileSize;
    const worldY = centerY * this.config.tileSize;

    if (this.config.debug) {
      console.log(
        `Assigning spawn point at tile (${centerX}, ${centerY}) => pixel (${worldX}, ${worldY})`
      );
    }

    // Mark this spawn as assigned
    spawn.playerId = spawn.playerId || "pending";

    return {
      x: worldX,
      y: worldY,
    };
  }
}

/**
 * BSPLeaf - Represents a region in the binary space partition
 */
class BSPLeaf {
  /**
   * Create a new BSP leaf
   * @param {number} x - X position
   * @param {number} y - Y position
   * @param {number} width - Width
   * @param {number} height - Height
   */
  constructor(x, y, width, height) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
    this.leftChild = null;
    this.rightChild = null;
    this.room = null;
  }

  /**
   * Split this leaf into two children
   * @param {Function} random - Random number generator function
   * @param {number} minSize - Minimum size for a leaf
   * @param {number} variance - Variance for split position (0-0.5)
   * @param {number} minRatio - Minimum ratio of width/height for valid splits
   * @returns {boolean} - True if split successful
   */
  split(random, minSize, variance = 0.25, minRatio = 0.45) {
    // Return false if already split
    if (this.leftChild !== null || this.rightChild !== null) {
      return false;
    }

    // Determine direction of split
    let splitHorizontal = random() > 0.5;

    // If one dimension is more than 25% larger than the other,
    // split in that direction
    if (this.width > this.height && this.width / this.height >= 1.25) {
      splitHorizontal = false;
    } else if (this.height > this.width && this.height / this.width >= 1.25) {
      splitHorizontal = true;
    }

    // Determine maximum split position
    const max = (splitHorizontal ? this.height : this.width) - minSize;

    // Don't split if the leaf is too small
    if (max <= minSize) {
      return false;
    }

    // Calculate valid split range with variance
    const minSplit = Math.floor(minSize + (max - minSize) * variance);
    const maxSplit = Math.floor(max - (max - minSize) * variance);

    // Ensure there's room to split
    if (minSplit > maxSplit) {
      return false;
    }

    // Choose a random split position within the valid range
    const split = Math.floor(minSplit + random() * (maxSplit - minSplit));

    // Create child leaves
    if (splitHorizontal) {
      this.leftChild = new BSPLeaf(this.x, this.y, this.width, split);
      this.rightChild = new BSPLeaf(
        this.x,
        this.y + split,
        this.width,
        this.height - split
      );

      // Check ratio constraints
      const leftRatio = this.leftChild.width / this.leftChild.height;
      const rightRatio = this.rightChild.width / this.rightChild.height;

      if (
        Math.min(leftRatio, 1 / leftRatio) < minRatio ||
        Math.min(rightRatio, 1 / rightRatio) < minRatio
      ) {
        // Reset if ratio constraint failed
        this.leftChild = null;
        this.rightChild = null;
        return false;
      }
    } else {
      this.leftChild = new BSPLeaf(this.x, this.y, split, this.height);
      this.rightChild = new BSPLeaf(
        this.x + split,
        this.y,
        this.width - split,
        this.height
      );

      // Check ratio constraints
      const leftRatio = this.leftChild.width / this.leftChild.height;
      const rightRatio = this.rightChild.width / this.rightChild.height;

      if (
        Math.min(leftRatio, 1 / leftRatio) < minRatio ||
        Math.min(rightRatio, 1 / rightRatio) < minRatio
      ) {
        // Reset if ratio constraint failed
        this.leftChild = null;
        this.rightChild = null;
        return false;
      }
    }

    return true;
  }
}
