// server/systems/CollisionSystem.js
export class CollisionSystem {
  constructor(room) {
    this.room = room;
    this.collisionMap = null;
    this.tileSize = 64; // Default, will be updated with map data
    this.debug = false;
    
    // Player collision settings
    this.playerRadius = 20; // Must match client-side settings
    this.bufferZone = 2; // Small buffer to prevent wall hugging
  }
  
  /**
   * Initialize collision map from map data
   * @param {Object} mapData - Map data
   */
  initCollisionMap(mapData) {
    if (!mapData || !mapData.layers || !mapData.layers.tiles) {
      console.error("Invalid map data for collision map");
      return;
    }
    
    const tilesLayer = mapData.layers.tiles;
    this.tileSize = mapData.tileSize || 64;
    
    // Create a collision map the same size as the tile map
    this.collisionMap = [];
    
    for (let y = 0; y < tilesLayer.length; y++) {
      this.collisionMap[y] = [];
      
      for (let x = 0; x < tilesLayer[y].length; x++) {
        // Any tile value > 0 is considered a wall (collision)
        this.collisionMap[y][x] = tilesLayer[y][x] > 0;
      }
    }
    
    console.log(`Server collision map initialized: ${this.collisionMap.length}x${this.collisionMap[0].length}`);
  }
  
  /**
   * Check if a position collides with a wall
   * @param {number} x - World X position to check
   * @param {number} y - World Y position to check
   * @param {number} radius - Collision radius (defaults to player radius)
   * @returns {boolean} - True if the position collides
   */
  checkCollision(x, y, radius = this.playerRadius) {
    if (!this.collisionMap) return false;
    
    // Calculate adjusted radius with buffer zone
    const effectiveRadius = radius + this.bufferZone;
    
    // Check collision at multiple points around the circle
    const collisionPoints = [
      { x: x, y: y - effectiveRadius }, // Top
      { x: x + effectiveRadius, y: y }, // Right
      { x: x, y: y + effectiveRadius }, // Bottom
      { x: x - effectiveRadius, y: y }, // Left
      { x: x + 0.7 * effectiveRadius, y: y - 0.7 * effectiveRadius }, // Top-right
      { x: x + 0.7 * effectiveRadius, y: y + 0.7 * effectiveRadius }, // Bottom-right
      { x: x - 0.7 * effectiveRadius, y: y + 0.7 * effectiveRadius }, // Bottom-left
      { x: x - 0.7 * effectiveRadius, y: y - 0.7 * effectiveRadius }  // Top-left
    ];
    
    // Check each collision point
    for (const point of collisionPoints) {
      const tileX = Math.floor(point.x / this.tileSize);
      const tileY = Math.floor(point.y / this.tileSize);
      
      // Check if tile coordinates are within bounds
      if (tileX < 0 || tileX >= this.collisionMap[0].length || 
          tileY < 0 || tileY >= this.collisionMap.length) {
        return true; // Collide with map boundaries
      }
      
      // Check if tile is a wall
      if (this.collisionMap[tileY][tileX]) {
        return true;
      }
    }
    
    return false; // No collision detected
  }
  
  /**
   * Calculate a valid position with sliding along walls
   * @param {number} startX - Starting X position
   * @param {number} startY - Starting Y position
   * @param {number} targetX - Target X position
   * @param {number} targetY - Target Y position
   * @param {number} radius - Collision radius
   * @returns {Object} - Valid position {x, y} after collision resolution
   */
  resolveCollision(startX, startY, targetX, targetY, radius = this.playerRadius) {
    // If no collision at target, return target directly
    if (!this.checkCollision(targetX, targetY, radius)) {
      return { x: targetX, y: targetY };
    }
    
    // Try to slide horizontally
    if (!this.checkCollision(targetX, startY, radius)) {
      return { x: targetX, y: startY };
    }
    
    // Try to slide vertically
    if (!this.checkCollision(startX, targetY, radius)) {
      return { x: startX, y: targetY };
    }
    
    // If both sliding directions fail, don't move
    return { x: startX, y: startY };
  }
  
  /**
   * Validate player movement against collision map
   * @param {Object} player - Player state object
   * @param {Object} input - Input command
   * @returns {boolean} - True if movement is valid
   */
  validatePlayerMovement(player, input) {
    if (!player || !input) return false;
    
    // Get current position
    const currentX = player.position.x;
    const currentY = player.position.y;
    
    // Calculate target position from input
    let targetX = currentX;
    let targetY = currentY;
    
    // Calculate movement amount
    const moveAmount = (player.moveSpeed * (input.delta || 16.67)) / 1000;
    
    if (input.left) targetX -= moveAmount;
    if (input.right) targetX += moveAmount;
    if (input.up) targetY -= moveAmount;
    if (input.down) targetY += moveAmount;
    
    // Check collision
    if (this.checkCollision(targetX, targetY)) {
      // Input would result in collision, apply sliding
      const resolvedPosition = this.resolveCollision(
        currentX, currentY, targetX, targetY
      );
      
      // Update input with resolved position
      input.resolvedX = resolvedPosition.x;
      input.resolvedY = resolvedPosition.y;
      
      // Position was modified due to collision
      return false;
    }
    
    // Input is valid, no collision
    input.resolvedX = targetX;
    input.resolvedY = targetY;
    return true;
  }

  update(deltaTime) {
    // This method can be empty for now or contain logic 
    // that needs to run every frame for collision processing
    
    // For example, it could update dynamic collision objects if needed
    // but for now an empty implementation will fix the immediate error
  }
}