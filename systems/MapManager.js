// server/systems/MapManager.js
import { DungeonMapGenerator } from './DungeonMapGenerator.js';

export class MapManager {
  constructor(room) {
    this.room = room;
    this.dungeonGenerator = new DungeonMapGenerator();
    this.currentMap = null;
    this.floorLevel = 1;
    this.tileSize = 32; // Pixels per tile
  }
  
  /**
   * Generate the first floor
   */
  generateFirstFloor() {
    console.log("Generating first dungeon floor");
    
    // Get player count (or use a minimum of 4)
    const playerCount = Math.max(4, Object.keys(this.room.state.players || {}).length);
    
    // Configure generator
    this.dungeonGenerator.config.playerCount = playerCount;
    this.dungeonGenerator.config.floorLevel = this.floorLevel;
    
    // Generate dungeon
    this.currentMap = this.dungeonGenerator.generate();
    
    console.log(`Generated floor ${this.floorLevel} with ${this.currentMap.rooms.length} rooms and ${this.currentMap.spawnPoints.length} spawn points`);
    
    // Broadcast map to all clients
    this.broadcastMapData();
    
    return this.currentMap;
  }
  
  /**
   * Generate next floor after collapse
   */
  generateNextFloor() {
    // Increment floor level
    this.floorLevel++;
    
    // Adjust size based on floor level (smaller maps for higher floors)
    const sizeReduction = Math.min(0.4, (this.floorLevel - 1) * 0.1);
    const newSize = [
      Math.max(50, Math.floor(100 * (1 - sizeReduction))),
      Math.max(50, Math.floor(100 * (1 - sizeReduction)))
    ];
    
    // Get current player count
    const playerCount = Math.max(1, Object.keys(this.room.state.players || {}).length);
    
    // Configure generator
    this.dungeonGenerator.config.size = newSize;
    this.dungeonGenerator.config.playerCount = playerCount;
    this.dungeonGenerator.config.floorLevel = this.floorLevel;
    
    // Generate dungeon
    this.currentMap = this.dungeonGenerator.generate();
    
    console.log(`Generated floor ${this.floorLevel} with ${this.currentMap.rooms.length} rooms and ${this.currentMap.spawnPoints.length} spawn points`);
    
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
    if (!this.currentMap || !this.currentMap.spawnPoints || this.currentMap.spawnPoints.length === 0) {
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
      
      // Notify client
      const client = this.room.clients.find(c => c.id === id);
      if (client) {
        client.send("teleported", {
          x: worldX,
          y: worldY,
          floorLevel: this.floorLevel
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
    
    // Create optimized map data for network transmission
    const mapData = {
      width: this.currentMap.width,
      height: this.currentMap.height,
      floorLevel: this.floorLevel,
      // Just send core room data
      rooms: this.currentMap.rooms.map(room => ({
        id: room.id,
        x: room.x,
        y: room.y,
        width: room.width,
        height: room.height,
        type: room.type
      })),
      // Send corridor paths
      corridors: this.currentMap.corridors.map(corridor => ({
        start: corridor.start,
        end: corridor.end,
        waypoint: corridor.waypoint
      })),
      // Send spawn points
      spawnPoints: this.currentMap.spawnPoints
    };
    
    // Broadcast to all clients
    this.room.broadcast("mapData", mapData);
  }
  
  /**
   * Get spawn position for a new player
   */
  getSpawnPosition() {
    // Default spawn at center if no map
    if (!this.currentMap || !this.currentMap.spawnPoints || this.currentMap.spawnPoints.length === 0) {
      return { x: 400, y: 300 };
    }
    
    // Pick a random spawn point
    const spawnIndex = Math.floor(Math.random() * this.currentMap.spawnPoints.length);
    const spawn = this.currentMap.spawnPoints[spawnIndex];
    
    // Convert to world coordinates
    return {
      x: spawn.x * this.tileSize,
      y: spawn.y * this.tileSize
    };
  }
}