// server/systems/BSPDungeonGenerator.js

/**
 * BSP Dungeon Generator
 * Creates dungeons using Binary Space Partitioning approach
 */
export class BSPDungeonGenerator {
    constructor(config = {}) {
      // Default configuration
      this.config = {
        worldSize: config.worldSize || 20000, // World map size (square)
        dungeonSize: config.dungeonSize || 10000, // Size of the dungeon area
        minRoomSize: config.minRoomSize || 5, // Minimum room size
        maxRoomSize: config.maxRoomSize || 20, // Maximum room size
        minLeafSize: config.minLeafSize || 20, // Minimum leaf size for BSP
        maxLeafSize: config.maxLeafSize || 50, // Maximum leaf size for BSP
        splitVariance: config.splitVariance || 0.3, // How far from center splits can occur (0-0.5)
        roomPadding: config.roomPadding || 1, // Space between rooms
        corridorWidth: config.corridorWidth || 3, // Width of corridors
        seed: config.seed || Math.random().toString(36).substring(2, 15), // Random seed
        playerCount: config.playerCount || 4, // Number of players
        spawnRoomDistance: config.spawnRoomDistance || 2000, // Distance from dungeon edge to spawn rooms
        tileSize: config.tileSize || 32, // Size of a tile in pixels
        debug: config.debug || false // Debug mode
      };
      
      // Scale dungeon size based on player count
      if (config.playerCount) {
        // Increase dungeon size by 20% for each player beyond 4
        const scaleFactor = 1 + Math.max(0, config.playerCount - 4) * 0.2;
        this.config.dungeonSize = Math.min(
          this.config.worldSize - this.config.spawnRoomDistance * 2,
          Math.round(this.config.dungeonSize * scaleFactor)
        );
      }
      
      // Internal state
      this.leaves = []; // BSP leaves
      this.rooms = []; // Generated rooms
      this.corridors = []; // Corridors between rooms
      this.spawnRooms = []; // Player spawn rooms on the outskirts
      
      // Random generator
      this.random = this.createRandomGenerator(this.config.seed);
    }
    
    /**
     * Create a seeded random number generator
     * @param {string} seed - Seed string
     * @returns {Function} - Random function that returns 0-1
     */
    createRandomGenerator(seed) {
      // Simple seeded random number generator
      let state = this.hashString(seed);
      
      return function() {
        // Simple LCG algorithm
        state = (1664525 * state + 1013904223) % 4294967296;
        return state / 4294967296; // Convert to 0-1 range
      };
    }
    
    /**
     * Hash a string to a number
     * @param {string} str - Input string
     * @returns {number} - Hash value
     */
    hashString(str) {
      let hash = 0;
      for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) - hash) + str.charCodeAt(i);
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
     * @returns {Object} - Generated dungeon data
     */
    generate() {
      console.time('dungeonGeneration');
      
      // Reset state
      this.leaves = [];
      this.rooms = [];
      this.corridors = [];
      this.spawnRooms = [];
      
      // Calculate dungeon position (centered in world)
      const dungeonX = Math.floor((this.config.worldSize - this.config.dungeonSize) / 2);
      const dungeonY = Math.floor((this.config.worldSize - this.config.dungeonSize) / 2);
      
      // Create root leaf for the dungeon area
      const rootLeaf = new BSPLeaf(
        dungeonX, dungeonY,
        this.config.dungeonSize, this.config.dungeonSize
      );
      
      this.leaves.push(rootLeaf);
      
      // Recursively split the dungeon area
      this.splitLeaves(rootLeaf);
      
      // Create rooms in the leaves
      this.createRooms();
      
      // Connect rooms with corridors
      this.createCorridors();
      
      // Create spawn rooms around the outskirts
      this.createSpawnRooms();
      
      console.timeEnd('dungeonGeneration');
      
      if (this.config.debug) {
        console.log(`Generated dungeon with ${this.rooms.length} rooms and ${this.spawnRooms.length} spawn rooms`);
      }
      
      // Return dungeon data
      return {
        worldSize: this.config.worldSize,
        dungeonSize: this.config.dungeonSize,
        rooms: [...this.rooms, ...this.spawnRooms],
        corridors: this.corridors,
        spawnPoints: this.spawnRooms.map(room => ({
          roomId: room.id,
          x: Math.floor(room.x + room.width / 2),
          y: Math.floor(room.y + room.height / 2)
        }))
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
        if (leaf.split(
          this.random, 
          this.config.minLeafSize, 
          this.config.splitVariance
        )) {
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
     */
    createRooms() {
      // Process leaves that don't have children (end nodes)
      for (let i = 0; i < this.leaves.length; i++) {
        const leaf = this.leaves[i];
        
        // Skip if this leaf has children
        if (leaf.leftChild || leaf.rightChild) {
          continue;
        }
        
        // Determine room size and position
        let roomWidth, roomHeight, roomX, roomY;
        
        // Room size is random but proportional to leaf size
        roomWidth = this.randomInt(
          Math.max(this.config.minRoomSize, Math.floor(leaf.width * 0.6)),
          Math.min(leaf.width - this.config.roomPadding * 2, Math.floor(leaf.width * 0.9))
        );
        
        roomHeight = this.randomInt(
          Math.max(this.config.minRoomSize, Math.floor(leaf.height * 0.6)),
          Math.min(leaf.height - this.config.roomPadding * 2, Math.floor(leaf.height * 0.9))
        );
        
        // Position room within leaf (with padding)
        roomX = leaf.x + this.randomInt(
          this.config.roomPadding,
          leaf.width - roomWidth - this.config.roomPadding
        );
        
        roomY = leaf.y + this.randomInt(
          this.config.roomPadding,
          leaf.height - roomHeight - this.config.roomPadding
        );
        
        // Create room
        const room = {
          id: `room_${this.rooms.length}`,
          leaf: leaf,
          x: roomX,
          y: roomY,
          width: roomWidth,
          height: roomHeight,
          type: this.determineRoomType(leaf, this.leaves),
          connections: []
        };
        
        // Store room in leaf
        leaf.room = room;
        
        // Add to rooms list
        this.rooms.push(room);
      }
    }
    
    /**
     * Determine room type based on position and size
     * @param {BSPLeaf} leaf - The leaf containing the room
     * @param {Array} allLeaves - All leaves in the dungeon
     * @returns {string} - Room type (small, medium, large)
     */
    determineRoomType(leaf, allLeaves) {
      // Calculate room size relative to other rooms
      const areaRatio = (leaf.width * leaf.height) / 
        (this.config.maxLeafSize * this.config.maxLeafSize);
      
      if (areaRatio < 0.3) {
        return 'small';
      } else if (areaRatio < 0.7) {
        return 'medium';
      } else {
        return 'large';
      }
    }
    
    /**
     * Create corridors connecting the rooms
     */
    createCorridors() {
      // Create corridors between rooms based on BSP tree structure
      for (const leaf of this.leaves) {
        // Skip leaves without children
        if (!leaf.leftChild || !leaf.rightChild) {
          continue;
        }
        
        // Find rooms in left and right subtrees
        const leftRoom = this.findRoomInLeaf(leaf.leftChild);
        const rightRoom = this.findRoomInLeaf(leaf.rightChild);
        
        // Skip if either side doesn't have a room
        if (!leftRoom || !rightRoom) {
          continue;
        }
        
        // Create corridor between rooms
        this.createCorridor(leftRoom, rightRoom);
      }
      
      // Add a few extra corridors for better connectivity
      this.addExtraCorridors();
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
        x: Math.floor(roomA.x + roomA.width/2),
        y: Math.floor(roomA.y + roomA.height/2)
      };
      
      const pointB = {
        x: Math.floor(roomB.x + roomB.width/2),
        y: Math.floor(roomB.y + roomB.height/2)
      };
      
      // Randomly decide whether to go horizontal-then-vertical or vice versa
      let waypoint;
      if (this.random() < 0.5) {
        waypoint = { x: pointB.x, y: pointA.y };
      } else {
        waypoint = { x: pointA.x, y: pointB.y };
      }
      
      // Create corridor
      const corridor = {
        id: `corridor_${this.corridors.length}`,
        start: pointA,
        end: pointB,
        waypoint: waypoint,
        width: this.config.corridorWidth
      };
      
      // Add corridor to list
      this.corridors.push(corridor);
      
      // Mark rooms as connected
      roomA.connections.push(roomB.id);
      roomB.connections.push(roomA.id);
      
      return corridor;
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
        } while (
          roomA === roomB || 
          roomA.connections.includes(roomB.id)
        );
        
        // If we found a valid room, connect them
        if (roomA !== roomB && !roomA.connections.includes(roomB.id)) {
          this.createCorridor(roomA, roomB);
        }
      }
    }
    
    /**
     * Create spawn rooms around the dungeon outskirts
     */
    createSpawnRooms() {
      // Get number of spawn rooms needed (one per player)
      const spawnCount = this.config.playerCount;
      
      // Calculate dungeon center
      const dungeonCenterX = this.config.worldSize / 2;
      const dungeonCenterY = this.config.worldSize / 2;
      
      // Calculate radius for spawn room placement
      const spawnRadius = (this.config.dungeonSize / 2) + this.config.spawnRoomDistance;
      
      for (let i = 0; i < spawnCount; i++) {
        // Calculate angle for even distribution around the dungeon
        const angle = (i / spawnCount) * Math.PI * 2;
        
        // Calculate position on the circle
        const spawnX = Math.floor(dungeonCenterX + Math.cos(angle) * spawnRadius);
        const spawnY = Math.floor(dungeonCenterY + Math.sin(angle) * spawnRadius);
        
        // Create spawn room (consistent size)
        const spawnRoomSize = 10; // Fixed size for spawn rooms
        
        const spawnRoom = {
          id: `spawn_${i}`,
          x: spawnX - Math.floor(spawnRoomSize / 2),
          y: spawnY - Math.floor(spawnRoomSize / 2),
          width: spawnRoomSize,
          height: spawnRoomSize,
          type: 'spawn',
          isSpawn: true,
          playerId: null, // Will be assigned later
          connections: []
        };
        
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
        y: spawnRoom.y + Math.floor(spawnRoom.height / 2)
      };
      
      for (const room of this.rooms) {
        const roomCenter = {
          x: room.x + Math.floor(room.width / 2),
          y: room.y + Math.floor(room.height / 2)
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
     * @returns {boolean} - True if split successful
     */
    split(random, minSize, variance = 0.25) {
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
      
      // Determine split position with variance
      const minSplit = Math.floor(minSize + (max - minSize) * variance);
      const maxSplit = Math.floor(max - (max - minSize) * variance);
      
      // Ensure there's room to split
      if (minSplit > maxSplit) {
        return false;
      }
      
      const split = Math.floor(minSplit + random() * (maxSplit - minSplit));
      
      // Create child leafs
      if (splitHorizontal) {
        this.leftChild = new BSPLeaf(this.x, this.y, this.width, split);
        this.rightChild = new BSPLeaf(this.x, this.y + split, this.width, this.height - split);
      } else {
        this.leftChild = new BSPLeaf(this.x, this.y, split, this.height);
        this.rightChild = new BSPLeaf(this.x + split, this.y, this.width - split, this.height);
      }
      
      return true;
    }
  }