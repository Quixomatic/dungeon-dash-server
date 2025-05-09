// dungeonGenerator/monsterRoomTemplates.js

/**
 * Monster room templates with various sizes
 * All rooms are empty (floor tiles only) with no walls
 * Wall tiles will be handled by the dungeon generator
 */
export const monsterRoomTemplates = [
  // Huge rooms (40x40, 35x35)
  {
    id: "monster_huge_40x40",
    type: "monsters",
    width: 40,
    height: 40,
    layers: {
      tiles: createEmptyRoom(40, 40),
      props: createEmptyLayer(40, 40),
      monsters: createEmptyLayer(40, 40),
    },
  },
  {
    id: "monster_huge_35x35",
    type: "monsters",
    width: 35,
    height: 35,
    layers: {
      tiles: createEmptyRoom(35, 35),
      props: createEmptyLayer(35, 35),
      monsters: createEmptyLayer(35, 35),
    },
  },

  // Large rooms (30x30, 25x25)
  {
    id: "monster_large_30x30",
    type: "monsters",
    width: 30,
    height: 30,
    layers: {
      tiles: createEmptyRoom(30, 30),
      props: createEmptyLayer(30, 30),
      monsters: createEmptyLayer(30, 30),
    },
  },
  {
    id: "monster_large_25x25",
    type: "monsters",
    width: 25,
    height: 25,
    layers: {
      tiles: createEmptyRoom(25, 25),
      props: createEmptyLayer(25, 25),
      monsters: createEmptyLayer(25, 25),
    },
  },

  // Medium rooms (20x20, 18x18, 15x15)
  {
    id: "monster_medium_20x20",
    type: "monsters",
    width: 20,
    height: 20,
    layers: {
      tiles: createEmptyRoom(20, 20),
      props: createEmptyLayer(20, 20),
      monsters: createEmptyLayer(20, 20),
    },
  },
  {
    id: "monster_medium_18x18",
    type: "monsters",
    width: 18,
    height: 18,
    layers: {
      tiles: createEmptyRoom(18, 18),
      props: createEmptyLayer(18, 18),
      monsters: createEmptyLayer(18, 18),
    },
  },
  {
    id: "monster_medium_15x15",
    type: "monsters",
    width: 15,
    height: 15,
    layers: {
      tiles: createEmptyRoom(15, 15),
      props: createEmptyLayer(15, 15),
      monsters: createEmptyLayer(15, 15),
    },
  },

  // Small rooms (12x12, 10x10, 8x8)
  {
    id: "monster_small_12x12",
    type: "monsters",
    width: 12,
    height: 12,
    layers: {
      tiles: createEmptyRoom(12, 12),
      props: createEmptyLayer(12, 12),
      monsters: createEmptyLayer(12, 12),
    },
  },
  {
    id: "monster_small_10x10",
    type: "monsters",
    width: 10,
    height: 10,
    layers: {
      tiles: createEmptyRoom(10, 10),
      props: createEmptyLayer(10, 10),
      monsters: createEmptyLayer(10, 10),
    },
  },
  {
    id: "monster_small_8x8",
    type: "monsters",
    width: 8,
    height: 8,
    layers: {
      tiles: createEmptyRoom(8, 8),
      props: createEmptyLayer(8, 8),
      monsters: createEmptyLayer(8, 8),
    },
  },

  // Tiny rooms (6x6, 5x5)
  {
    id: "monster_tiny_6x6",
    type: "monsters",
    width: 6,
    height: 6,
    layers: {
      tiles: createEmptyRoom(6, 6),
      props: createEmptyLayer(6, 6),
      monsters: createEmptyLayer(6, 6),
    },
  },
  {
    id: "monster_tiny_5x5",
    type: "monsters",
    width: 5,
    height: 5,
    layers: {
      tiles: createEmptyRoom(5, 5),
      props: createEmptyLayer(5, 5),
      monsters: createEmptyLayer(5, 5),
    },
  },

  // Rectangular rooms
  {
    id: "monster_rect_20x10",
    type: "monsters",
    width: 20,
    height: 10,
    layers: {
      tiles: createEmptyRoom(20, 10),
      props: createEmptyLayer(20, 10),
      monsters: createEmptyLayer(20, 10),
    },
  },
  {
    id: "monster_rect_10x20",
    type: "monsters",
    width: 10,
    height: 20,
    layers: {
      tiles: createEmptyRoom(10, 20),
      props: createEmptyLayer(10, 20),
      monsters: createEmptyLayer(10, 20),
    },
  },
  {
    id: "monster_rect_15x30",
    type: "monsters",
    width: 15,
    height: 30,
    layers: {
      tiles: createEmptyRoom(15, 30),
      props: createEmptyLayer(15, 30),
      monsters: createEmptyLayer(15, 30),
    },
  },
  {
    id: "monster_rect_30x15",
    type: "monsters",
    width: 30,
    height: 15,
    layers: {
      tiles: createEmptyRoom(30, 15),
      props: createEmptyLayer(30, 15),
      monsters: createEmptyLayer(30, 15),
    },
  },
  {
    id: "monster_rect_25x15",
    type: "monsters",
    width: 25,
    height: 15,
    layers: {
      tiles: createEmptyRoom(25, 15),
      props: createEmptyLayer(25, 15),
      monsters: createEmptyLayer(25, 15),
    },
  },
  {
    id: "monster_rect_15x25",
    type: "monsters",
    width: 15,
    height: 25,
    layers: {
      tiles: createEmptyRoom(15, 25),
      props: createEmptyLayer(15, 25),
      monsters: createEmptyLayer(15, 25),
    },
  },
];

/**
 * Create an empty room with only floor tiles (0)
 * @param {number} width - Room width
 * @param {number} height - Room height
 * @returns {Array} - 2D array of tiles (all floor)
 */
function createEmptyRoom(width, height) {
  // Create a 2D array filled with floor tiles (0)
  return Array(height)
    .fill()
    .map(() => Array(width).fill(0));
}

/**
 * Create an empty layer (for props or monsters)
 * @param {number} width - Layer width
 * @param {number} height - Layer height
 * @returns {Array} - 2D array (all 0's)
 */
function createEmptyLayer(width, height) {
  return Array(height)
    .fill()
    .map(() => Array(width).fill(0));
}
