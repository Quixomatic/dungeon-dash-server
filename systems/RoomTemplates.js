// server/systems/RoomTemplates.js

/**
 * Room templates for dungeon generation
 */

/**
 * Template types:
 * - small: Small rooms (5-10 tiles)
 * - medium: Medium rooms (10-15 tiles)
 * - large: Large rooms (15-20 tiles)
 * - spawn: Spawn rooms (used for player starting points)
 * 
 * Layout legend:
 * - W: Wall
 * - .: Floor
 * - D: Door
 * - S: Spawn point
 * - C: Chest
 * - T: Torch
 */

// Basic room templates for different sizes
export const ROOM_TEMPLATES = {
  // Small room templates
  small_basic: {
    id: "small_basic",
    width: 7,
    height: 7,
    type: "small",
    layout: [
      "WWWWWWW",
      "W.....W",
      "W.....W",
      "W.....W",
      "W.....W",
      "W.....W",
      "WWWWWWW"
    ]
  },
  
  small_pillars: {
    id: "small_pillars",
    width: 9,
    height: 9,
    type: "small",
    layout: [
      "WWWWWWWWW",
      "W.......W",
      "W.W...W.W",
      "W.......W",
      "W...T...W",
      "W.......W",
      "W.W...W.W",
      "W.......W",
      "WWWWWWWWW"
    ],
    objects: [
      { type: "torch", x: 4, y: 4 }
    ]
  },
  
  // Medium room templates
  medium_basic: {
    id: "medium_basic",
    width: 11,
    height: 11,
    type: "medium",
    layout: [
      "WWWWWWWWWWW",
      "W.........W",
      "W.........W",
      "W.........W",
      "W.........W",
      "W....T....W",
      "W.........W",
      "W.........W",
      "W.........W",
      "W.........W",
      "WWWWWWWWWWW"
    ],
    objects: [
      { type: "torch", x: 5, y: 5 }
    ]
  },
  
  medium_divided: {
    id: "medium_divided",
    width: 13,
    height: 13,
    type: "medium",
    layout: [
      "WWWWWWWWWWWWW",
      "W...........W",
      "W...........W",
      "W...WWW.....W",
      "W...W.......W",
      "W...WD......W",
      "W...W...T...W",
      "W...W.......W",
      "W...W.......W",
      "W...W.......W",
      "W...W.......W",
      "W...........W",
      "WWWWWWWWWWWWW"
    ],
    objects: [
      { type: "torch", x: 7, y: 6 }
    ]
  },
  
  // Large room templates
  large_basic: {
    id: "large_basic",
    width: 17,
    height: 17,
    type: "large",
    layout: [
      "WWWWWWWWWWWWWWWWW",
      "W...............W",
      "W...............W",
      "W...............W",
      "W...............W",
      "W...............W",
      "W...............W",
      "W...............W",
      "W........C......W",
      "W...............W",
      "W...............W",
      "W...............W",
      "W...............W",
      "W...............W",
      "W...............W",
      "W...............W",
      "WWWWWWWWWWWWWWWWW"
    ],
    objects: [
      { type: "chest", x: 8, y: 8 }
    ]
  },
  
  large_columns: {
    id: "large_columns",
    width: 19,
    height: 19,
    type: "large",
    layout: [
      "WWWWWWWWWWWWWWWWWWW",
      "W.................W",
      "W..W.........W....W",
      "W.................W",
      "W.................W",
      "W.................W",
      "W..W.........W....W",
      "W.................W",
      "W.................W",
      "W.........C.......W",
      "W.................W",
      "W.................W",
      "W..W.........W....W",
      "W.................W",
      "W.................W",
      "W.................W",
      "W..W.........W....W",
      "W.................W",
      "WWWWWWWWWWWWWWWWWWW"
    ],
    objects: [
      { type: "chest", x: 9, y: 9 },
      { type: "torch", x: 3, y: 2 },
      { type: "torch", x: 12, y: 2 },
      { type: "torch", x: 3, y: 16 },
      { type: "torch", x: 12, y: 16 }
    ]
  },
  
  // Spawn room template
  spawn_room: {
    id: "spawn_room",
    width: 9,
    height: 9,
    type: "spawn",
    layout: [
      "WWWWWWWWW",
      "W.......W",
      "W.......W",
      "W.......W",
      "W...S...W",
      "W.......W",
      "W.......W",
      "W.......W",
      "WWWWWWWWW"
    ],
    objects: [
      { type: "spawn", x: 4, y: 4 }
    ]
  }
};

/**
 * Get a template by its ID
 * @param {string} id - Template ID
 * @returns {Object|null} - Template or null if not found
 */
export function getTemplateById(id) {
  return ROOM_TEMPLATES[id] || null;
}

/**
 * Get templates by type
 * @param {string} type - Template type (small, medium, large, spawn)
 * @returns {Array} - Array of matching templates
 */
export function getTemplatesByType(type) {
  return Object.values(ROOM_TEMPLATES).filter(template => 
    template.type === type
  );
}

/**
 * Get templates by size range
 * @param {number} minWidth - Minimum width
 * @param {number} maxWidth - Maximum width
 * @param {number} minHeight - Minimum height
 * @param {number} maxHeight - Maximum height
 * @returns {Array} - Array of matching templates
 */
export function getTemplatesBySize(minWidth, maxWidth, minHeight, maxHeight) {
  return Object.values(ROOM_TEMPLATES).filter(template => 
    template.width >= minWidth && template.width <= maxWidth &&
    template.height >= minHeight && template.height <= maxHeight
  );
}

/**
 * Get a random template by type
 * @param {string} type - Template type
 * @param {Function} random - Random function
 * @returns {Object|null} - Random template or null if none found
 */
export function getRandomTemplate(type, random) {
  const templates = getTemplatesByType(type);
  
  if (templates.length === 0) {
    return null;
  }
  
  const index = Math.floor(random() * templates.length);
  return templates[index];
}

/**
 * Generate a basic layout for a room without a template
 * @param {number} width - Room width
 * @param {number} height - Room height
 * @returns {Array} - Room layout
 */
export function generateBasicLayout(width, height) {
  const layout = [];
  
  for (let y = 0; y < height; y++) {
    let row = '';
    
    for (let x = 0; x < width; x++) {
      // Wall at the edges, floor in the middle
      if (x === 0 || x === width - 1 || y === 0 || y === height - 1) {
        row += 'W';
      } else {
        row += '.';
      }
    }
    
    layout.push(row);
  }
  
  return layout;
}