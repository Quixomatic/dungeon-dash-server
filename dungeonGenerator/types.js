// server/dungeonGenerator/types.js

/**
 * TreeNode class for dungeon container hierarchy
 */
export class TreeNode {
    /**
     * @param {any} data - The data for this node
     */
    constructor(data) {
      this.left = null;
      this.right = null;
      this.leaf = data;
    }
  
    /**
     * Get the bottom-most leaves
     * @returns {Array} - Array of leaf data
     */
    get leaves() {
      const result = [];
  
      if (this.left && this.right) {
        result.push(...this.left.leaves, ...this.right.leaves);
      } else {
        result.push(this.leaf);
      }
  
      return result;
    }
  }
  
  /**
   * Point class for 2D coordinates
   */
  export class Point {
    /**
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     */
    constructor(x, y) {
      this.x = x;
      this.y = y;
    }
  }
  
  /**
   * Rectangle base class
   */
  export class Rectangle {
    /**
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
    }
  
    /**
     * Get the center point
     * @returns {Point} - Center point
     */
    get center() {
      return new Point(this.x + this.width / 2, this.y + this.height / 2);
    }
  
    /**
     * Get the surface area
     * @returns {number} - Surface area
     */
    get surface() {
      return this.width * this.height;
    }
  
    /**
     * Get bottom edge Y coordinate
     * @returns {number} - Y coordinate of bottom edge
     */
    get down() {
      return this.y + this.height;
    }
  
    /**
     * Get right edge X coordinate
     * @returns {number} - X coordinate of right edge
     */
    get right() {
      return this.x + this.width;
    }
  }
  
  /**
   * Container class for dungeon sections
   */
  export class Container extends Rectangle {
    /**
     * @param {number} x - X position
     * @param {number} y - Y position
     * @param {number} width - Width
     * @param {number} height - Height
     */
    constructor(x, y, width, height) {
      super(x, y, width, height);
      this.id = Math.random().toString(36).substring(2, 9);
      this.room = null;
      this.corridor = null;
    }
  }
  
  /**
   * Room class for dungeon rooms
   */
  export class Room extends Rectangle {
    /**
     * @param {number} x - X position
     * @param {number} y - Y position
     * @param {string} id - Room ID
     * @param {Object} template - Room template data
     */
    constructor(x, y, id, template) {
      super(x, y, template.width, template.height);
      this.id = id;
      this.template = template;
    }
  }
  
  /**
   * Corridor class for connections between rooms
   */
  export class Corridor extends Rectangle {
    /**
     * @param {number} x - X position
     * @param {number} y - Y position
     * @param {number} width - Width
     * @param {number} height - Height
     */
    constructor(x, y, width, height) {
      super(x, y, width, height);
    }
  
    /**
     * Get the direction of the corridor
     * @returns {string} - 'horizontal' or 'vertical'
     */
    get direction() {
      return this.width > this.height ? "horizontal" : "vertical";
    }
  }
  
  // Tile direction enum
  export const TileDirection = {
    NorthWest: 1,
    North: 2,
    NorthEast: 4,
    West: 8,
    East: 16,
    SouthWest: 32,
    South: 64,
    SouthEast: 128
  };
  
  // Tile type enum
  export const TileType = {
    Hole: -1,
    Wall: 1
  };
  
  // Map of tile types as strings
  export const TileTypes = ["Hole", "Wall"];
  
  // Prop type enum
  export const PropType = {
    Bone: 2,
    Coin: 22,
    CrateSilver: 3,
    CrateWood: 4,
    Flag: 5,
    Handcuff1: 6,
    Handcuff2: 7,
    HealthLarge: 15,
    HealthSmall: 16,
    KeyGold: 17,
    KeySilver: 18,
    Ladder: 21,
    Lamp: 8,
    ManaLarge: 19,
    ManaSmall: 20,
    Peak: 1,
    Skull: 9,
    StonesLarge: 10,
    StonesSmall: 11,
    Torch: 12,
    WebLeft: 13,
    WebRight: 14
  };
  
  // Map of prop types as strings
  export const PropTypes = [
    "Bone",
    "Coin",
    "CrateSilver",
    "CrateWood",
    "Flag",
    "Handcuff1",
    "Handcuff2",
    "HealthLarge",
    "HealthSmall",
    "KeyGold",
    "KeySilver",
    "Ladder",
    "Lamp",
    "ManaLarge",
    "ManaSmall",
    "Peak",
    "Skull",
    "StonesLarge",
    "StonesSmall",
    "Torch",
    "WebLeft",
    "WebRight"
  ];
  
  // Monster type enum
  export const MonsterType = {
    Bandit: 1,
    CentaurFemale: 2,
    CentaurMale: 3,
    MushroomLarge: 4,
    MushroomSmall: 5,
    Skeleton: 6,
    Troll: 7,
    Wolf: 8
  };
  
  // Map of monster types as strings
  export const MonsterTypes = [
    "Bandit",
    "CentaurFemale",
    "CentaurMale",
    "MushroomLarge",
    "MushroomSmall",
    "Skeleton",
    "Troll",
    "Wolf"
  ];
  
  // Room type definitions
  export const RoomTypes = ["entrance", "monsters", "heal", "treasure", "boss"];
  
  // Layer types
  export const TileLayers = ["tiles", "props", "monsters"];