// server/systems/DungeonMapGenerator.js
export class DungeonMapGenerator {
  constructor(config = {}) {
    // Default configuration
    this.config = {
      size: config.size || [100, 100],
      roomCount: config.roomCount || 20,
      minRoomSize: config.minRoomSize || [5, 5],
      maxRoomSize: config.maxRoomSize || [15, 15],
      corridorWidth: config.corridorWidth || 2,
      maxCorridorLength: config.maxCorridorLength || 8,
      minCorridorLength: config.minCorridorLength || 3,
      interconnects: config.interconnects || 5,
      seed: config.seed || Date.now().toString(),
      playerCount: config.playerCount || 4,
      floorLevel: config.floorLevel || 1
    };
    
    // Internal state
    this.rooms = [];
    this.corridors = [];
    this.spawnPoints = [];
    this.seed = this.config.seed;
    
    // Initialize random generator
    this.random = this.createRandomGenerator(this.seed);
  }
  
  /**
   * Create a seeded random number generator
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
   * Simple string hash function
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
   * Get a random integer between min and max (inclusive)
   */
  randomInt(min, max) {
    return Math.floor(this.random() * (max - min + 1)) + min;
  }
  
  /**
   * Generate a complete dungeon
   */
  generate() {
    console.time('dungeonGeneration');
    
    // Reset state
    this.rooms = [];
    this.corridors = [];
    this.spawnPoints = [];
    
    // Generate rooms
    this.generateRooms();
    
    // Connect rooms with corridors
    this.connectRooms();
    
    // Add extra interconnections
    this.addInterconnections();
    
    // Place spawn points
    this.placeSpawnPoints();
    
    console.timeEnd('dungeonGeneration');
    
    return this.getDungeonData();
  }
  
  /**
   * Generate rooms with random sizes and positions
   */
  generateRooms() {
    const [width, height] = this.config.size;
    const roomCount = this.config.roomCount;
    const maxAttempts = roomCount * 3;
    let attempts = 0;
    
    while (this.rooms.length < roomCount && attempts < maxAttempts) {
      attempts++;
      
      // Random room size
      const roomWidth = this.randomInt(
        this.config.minRoomSize[0], 
        this.config.maxRoomSize[0]
      );
      
      const roomHeight = this.randomInt(
        this.config.minRoomSize[1], 
        this.config.maxRoomSize[1]
      );
      
      // Random position (with margin)
      const x = this.randomInt(2, width - roomWidth - 2);
      const y = this.randomInt(2, height - roomHeight - 2);
      
      // Create room
      const room = {
        id: this.rooms.length,
        x, y,
        width: roomWidth,
        height: roomHeight,
        connections: [], // IDs of connected rooms
        type: 'normal'   // Default room type
      };
      
      // Check if room overlaps with existing rooms
      if (!this.checkRoomOverlap(room)) {
        this.rooms.push(room);
      }
    }
    
    console.log(`Generated ${this.rooms.length}/${roomCount} rooms after ${attempts} attempts`);
  }
  
  /**
   * Check if a new room overlaps with existing rooms
   */
  checkRoomOverlap(newRoom) {
    // Add padding to avoid rooms being too close
    const padding = 2;
    
    for (const room of this.rooms) {
      if (
        newRoom.x - padding < room.x + room.width + padding &&
        newRoom.x + newRoom.width + padding > room.x - padding &&
        newRoom.y - padding < room.y + room.height + padding &&
        newRoom.y + newRoom.height + padding > room.y - padding
      ) {
        return true; // Overlap found
      }
    }
    
    return false; // No overlap
  }
  
  /**
   * Connect rooms with corridors (using minimum spanning tree)
   */
  connectRooms() {
    if (this.rooms.length <= 1) return;
    
    // Calculate distances between all rooms
    const edges = [];
    
    for (let i = 0; i < this.rooms.length; i++) {
      for (let j = i + 1; j < this.rooms.length; j++) {
        const roomA = this.rooms[i];
        const roomB = this.rooms[j];
        const distance = this.calculateRoomDistance(roomA, roomB);
        
        edges.push({
          roomA: i,
          roomB: j,
          distance
        });
      }
    }
    
    // Sort by distance (ascending)
    edges.sort((a, b) => a.distance - b.distance);
    
    // Use Kruskal's algorithm to create minimum spanning tree
    const disjointSet = new DisjointSet(this.rooms.length);
    
    for (const edge of edges) {
      if (disjointSet.find(edge.roomA) !== disjointSet.find(edge.roomB)) {
        disjointSet.union(edge.roomA, edge.roomB);
        
        // Create corridor between rooms
        const roomA = this.rooms[edge.roomA];
        const roomB = this.rooms[edge.roomB];
        
        this.createCorridor(roomA, roomB);
        
        // Mark rooms as connected
        roomA.connections.push(roomB.id);
        roomB.connections.push(roomA.id);
      }
    }
  }
  
  /**
   * Add additional interconnections between rooms
   */
  addInterconnections() {
    if (this.rooms.length <= 2) return;
    
    let addedConnections = 0;
    const maxConnections = this.config.interconnects;
    
    // Get all possible connections between rooms
    const possibleConnections = [];
    
    for (let i = 0; i < this.rooms.length; i++) {
      for (let j = i + 1; j < this.rooms.length; j++) {
        const roomA = this.rooms[i];
        const roomB = this.rooms[j];
        
        // Skip if already connected
        if (roomA.connections.includes(roomB.id)) continue;
        
        const distance = this.calculateRoomDistance(roomA, roomB);
        possibleConnections.push({
          roomA: i,
          roomB: j,
          distance
        });
      }
    }
    
    // Sort by distance
    possibleConnections.sort((a, b) => a.distance - b.distance);
    
    // Add closest connections
    for (const connection of possibleConnections) {
      if (addedConnections >= maxConnections) break;
      
      const roomA = this.rooms[connection.roomA];
      const roomB = this.rooms[connection.roomB];
      
      this.createCorridor(roomA, roomB);
      
      // Mark rooms as connected
      roomA.connections.push(roomB.id);
      roomB.connections.push(roomA.id);
      
      addedConnections++;
    }
    
    console.log(`Added ${addedConnections} extra interconnections`);
  }
  
  /**
   * Calculate distance between room centers
   */
  calculateRoomDistance(roomA, roomB) {
    const centerAX = roomA.x + Math.floor(roomA.width / 2);
    const centerAY = roomA.y + Math.floor(roomA.height / 2);
    const centerBX = roomB.x + Math.floor(roomB.width / 2);
    const centerBY = roomB.y + Math.floor(roomB.height / 2);
    
    const dx = centerAX - centerBX;
    const dy = centerAY - centerBY;
    
    return Math.sqrt(dx * dx + dy * dy);
  }
  
  /**
   * Create a corridor between two rooms
   */
  createCorridor(roomA, roomB) {
    // Find exit points for the rooms
    const [exitA, exitB] = this.findRoomExits(roomA, roomB);
    
    // Create L-shaped corridor with a waypoint
    let waypoint;
    if (this.random() < 0.5) {
      waypoint = { x: exitB.x, y: exitA.y };
    } else {
      waypoint = { x: exitA.x, y: exitB.y };
    }
    
    // Create corridor object
    const corridor = {
      id: this.corridors.length,
      start: exitA,
      end: exitB,
      waypoint: waypoint,
      roomA: roomA.id,
      roomB: roomB.id
    };
    
    this.corridors.push(corridor);
  }
  
  /**
   * Find suitable exit points for rooms
   */
  findRoomExits(roomA, roomB) {
    const centerAX = roomA.x + Math.floor(roomA.width / 2);
    const centerAY = roomA.y + Math.floor(roomA.height / 2);
    const centerBX = roomB.x + Math.floor(roomB.width / 2);
    const centerBY = roomB.y + Math.floor(roomB.height / 2);
    
    // Determine the side to exit based on relative positions
    let exitASide, exitBSide;
    
    if (Math.abs(centerAX - centerBX) > Math.abs(centerAY - centerBY)) {
      // Rooms are more separated horizontally
      exitASide = centerAX < centerBX ? 'right' : 'left';
      exitBSide = exitASide === 'right' ? 'left' : 'right';
    } else {
      // Rooms are more separated vertically
      exitASide = centerAY < centerBY ? 'bottom' : 'top';
      exitBSide = exitASide === 'bottom' ? 'top' : 'bottom';
    }
    
    // Get exit coordinates
    const exitA = this.getExitCoordinates(roomA, exitASide);
    const exitB = this.getExitCoordinates(roomB, exitBSide);
    
    return [exitA, exitB];
  }
  
  /**
   * Get exit coordinates for a room side
   */
  getExitCoordinates(room, side) {
    switch (side) {
      case 'top':
        return {
          x: room.x + this.randomInt(1, room.width - 2),
          y: room.y
        };
      case 'bottom':
        return {
          x: room.x + this.randomInt(1, room.width - 2),
          y: room.y + room.height - 1
        };
      case 'left':
        return {
          x: room.x,
          y: room.y + this.randomInt(1, room.height - 2)
        };
      case 'right':
        return {
          x: room.x + room.width - 1,
          y: room.y + this.randomInt(1, room.height - 2)
        };
    }
  }
  
  /**
   * Place spawn points for players
   */
  placeSpawnPoints() {
    const playerCount = this.config.playerCount;
    this.spawnPoints = [];
    
    // Skip if no rooms
    if (this.rooms.length === 0) return;
    
    // Try to distribute spawn points throughout the map
    const candidates = [...this.rooms];
    
    // Start with a random room
    const firstRoomIndex = this.randomInt(0, candidates.length - 1);
    const firstRoom = candidates.splice(firstRoomIndex, 1)[0];
    
    if (firstRoom) {
      firstRoom.type = 'spawn';
      this.addSpawnPoint(firstRoom);
    }
    
    // Add additional spawn points, prioritizing rooms far from existing spawns
    for (let i = 1; i < Math.min(playerCount, candidates.length + 1); i++) {
      if (candidates.length === 0) break;
      
      // Find room farthest from existing spawns
      let bestDistance = -1;
      let bestIndex = -1;
      
      for (let j = 0; j < candidates.length; j++) {
        const room = candidates[j];
        let minDistance = Number.MAX_VALUE;
        
        // Find minimum distance to any existing spawn
        for (const spawn of this.spawnPoints) {
          const distance = this.calculatePointDistance(
            room.x + Math.floor(room.width / 2),
            room.y + Math.floor(room.height / 2),
            spawn.x,
            spawn.y
          );
          
          minDistance = Math.min(minDistance, distance);
        }
        
        // Check if this is better than our current best
        if (minDistance > bestDistance) {
          bestDistance = minDistance;
          bestIndex = j;
        }
      }
      
      if (bestIndex >= 0) {
        const room = candidates.splice(bestIndex, 1)[0];
        room.type = 'spawn';
        this.addSpawnPoint(room);
      }
    }
    
    console.log(`Placed ${this.spawnPoints.length} spawn points`);
  }
  
  /**
   * Add a spawn point in a room
   */
  addSpawnPoint(room) {
    // Place spawn point in center of room
    const spawnX = room.x + Math.floor(room.width / 2);
    const spawnY = room.y + Math.floor(room.height / 2);
    
    this.spawnPoints.push({
      roomId: room.id,
      x: spawnX,
      y: spawnY
    });
  }
  
  /**
   * Calculate distance between two points
   */
  calculatePointDistance(x1, y1, x2, y2) {
    const dx = x1 - x2;
    const dy = y1 - y2;
    return Math.sqrt(dx * dx + dy * dy);
  }
  
  /**
   * Get the final dungeon data
   */
  getDungeonData() {
    return {
      width: this.config.size[0],
      height: this.config.size[1],
      rooms: this.rooms,
      corridors: this.corridors,
      spawnPoints: this.spawnPoints,
      floorLevel: this.config.floorLevel,
      seed: this.seed
    };
  }
}

/**
 * Disjoint-set data structure for Kruskal's algorithm
 */
class DisjointSet {
  constructor(count) {
    this.parent = Array(count).fill(0).map((_, i) => i);
    this.rank = Array(count).fill(0);
  }
  
  find(x) {
    if (this.parent[x] !== x) {
      this.parent[x] = this.find(this.parent[x]);
    }
    return this.parent[x];
  }
  
  union(x, y) {
    const rootX = this.find(x);
    const rootY = this.find(y);
    
    if (rootX === rootY) return;
    
    if (this.rank[rootX] < this.rank[rootY]) {
      this.parent[rootX] = rootY;
    } else if (this.rank[rootX] > this.rank[rootY]) {
      this.parent[rootY] = rootX;
    } else {
      this.parent[rootY] = rootX;
      this.rank[rootX]++;
    }
  }
}