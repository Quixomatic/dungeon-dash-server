// server/dungeonGenerator/dungeon.js

import seedrandom from 'seedrandom';
import { 
  TreeNode, 
  Container, 
  Room, 
  Corridor, 
  TileDirection 
} from './types.js';
import { 
  createTilemap, 
  duplicateTilemap, 
  random, 
  randomChoice 
} from './utils.js';

/**
 * Generate a dungeon based on provided arguments
 * @param {Object} args - Generation arguments
 * @returns {Object} - Generated dungeon
 */
export function generate(args) {
  // If a seed is provided, use it to generate dungeon.
  if (args.seed) {
    seedrandom(args.seed, { global: true });
  }

  const startAt = Date.now();

  const tree = createTree(args);
  const tiles = createTilesLayer(tree, args);
  const props = createPropsLayer(tree, tiles, args);
  const monsters = createMonstersLayer(tree, args);

  const endAt = Date.now();
  console.log(`Dungeon generated in ${endAt - startAt}ms`);

  return {
    width: args.mapWidth,
    height: args.mapHeight,
    tree,
    layers: {
      tiles,
      props,
      monsters,
    },
  };
}

/**
 * Create a tree structure for the dungeon
 * @param {Object} args - Generation arguments
 * @returns {TreeNode} - Tree of containers
 */
export function createTree(args) {
  const tree = generateTree(
    new Container(
      args.mapGutterWidth,
      args.mapGutterWidth,
      args.mapWidth - args.mapGutterWidth * 2,
      args.mapHeight - args.mapGutterWidth * 2
    ),
    args.iterations,
    args
  );

  generateRooms(tree, args);

  return tree;
}

/**
 * Recursively generate a BSP tree
 * @param {Container} container - Container to split
 * @param {number} iterations - Number of iterations remaining
 * @param {Object} args - Generation arguments
 * @returns {TreeNode} - Generated tree
 */
function generateTree(container, iterations, args) {
  const node = new TreeNode(container);

  if (
    iterations !== 0 &&
    node.leaf.width > args.containerMinimumSize * 2 &&
    node.leaf.height > args.containerMinimumSize * 2
  ) {
    // We still need to divide the container
    const [left, right] = splitContainer(
      container,
      args,
      args.containerSplitRetries
    );
    if (left && right) {
      node.left = generateTree(left, iterations - 1, args);
      node.right = generateTree(right, iterations - 1, args);

      // Once divided, we create a corridor between the two containers
      node.leaf.corridor = generateCorridor(
        node.left.leaf,
        node.right.leaf,
        args
      );
    }
  }

  return node;
}

/**
 * Split a container into two child containers
 * @param {Container} container - Container to split
 * @param {Object} args - Generation arguments
 * @param {number} iterations - Number of retries remaining
 * @returns {Array} - [left, right] containers or [null, null] if split failed
 */
function splitContainer(container, args, iterations) {
  let left;
  let right;

  // We tried too many times to split the container without success
  if (iterations === 0) {
    return [null, null];
  }

  // Generate a random direction to split the container
  const direction = randomChoice(["vertical", "horizontal"]);
  if (direction === "vertical") {
    // Vertical
    left = new Container(
      container.x,
      container.y,
      random(1, container.width),
      container.height
    );
    right = new Container(
      container.x + left.width,
      container.y,
      container.width - left.width,
      container.height
    );

    // Retry splitting the container if it's not large enough
    const leftWidthRatio = left.width / left.height;
    const rightWidthRatio = right.width / right.height;
    if (
      leftWidthRatio < args.containerMinimumRatio ||
      rightWidthRatio < args.containerMinimumRatio
    ) {
      return splitContainer(container, args, iterations - 1);
    }
  } else {
    // Horizontal
    left = new Container(
      container.x,
      container.y,
      container.width,
      random(1, container.height)
    );
    right = new Container(
      container.x,
      container.y + left.height,
      container.width,
      container.height - left.height
    );

    // Retry splitting the container if it's not high enough
    const leftHeightRatio = left.height / left.width;
    const rightHeightRatio = right.height / right.width;
    if (
      leftHeightRatio < args.containerMinimumRatio ||
      rightHeightRatio < args.containerMinimumRatio
    ) {
      return splitContainer(container, args, iterations - 1);
    }
  }

  return [left, right];
}

/**
 * Generate a corridor between two containers
 * @param {Container} left - Left container
 * @param {Container} right - Right container
 * @param {Object} args - Generation arguments
 * @returns {Corridor} - Generated corridor
 */
function generateCorridor(left, right, args) {
  // Create the corridor
  const leftCenter = left.center;
  const rightCenter = right.center;
  const x = Math.ceil(leftCenter.x);
  const y = Math.ceil(leftCenter.y);

  let corridor;
  if (leftCenter.x === rightCenter.x) {
    // Vertical
    corridor = new Corridor(
      x - Math.ceil(args.corridorWidth / 2),
      y - Math.ceil(args.corridorWidth / 2),
      Math.ceil(args.corridorWidth),
      Math.ceil(rightCenter.y) - y
    );
  } else {
    // Horizontal
    corridor = new Corridor(
      x - Math.ceil(args.corridorWidth / 2),
      y - Math.ceil(args.corridorWidth / 2),
      Math.ceil(rightCenter.x) - x,
      Math.ceil(args.corridorWidth)
    );
  }

  return corridor;
}

/**
 * Generate rooms inside containers
 * @param {TreeNode} tree - BSP tree
 * @param {Object} args - Generation arguments
 */
function generateRooms(tree, args) {
  fillByType(tree, args, "boss", 1);
  fillByType(tree, args, "entrance", 1);
  fillByType(tree, args, "heal", 1);
  fillByType(tree, args, "treasure", 1);
  fillByType(tree, args, "monsters", -1);
}

/**
 * Fill containers with rooms of a specific type
 * @param {TreeNode} tree - BSP tree
 * @param {Object} args - Generation arguments
 * @param {string} type - Room type
 * @param {number} count - Number of rooms to create (-1 for "fill rest")
 */
function fillByType(tree, args, type, count) {
  // Filter available templates by type
  const templates = getTemplatesByType(args.rooms, type);
  if (templates.length === 0) {
    throw new Error(`Couldn't find templates of type "${type}"`);
  }

  // List containers ids that have no rooms yet
  const containers = getEmptyContainers(tree.leaves);
  if (containers.length === 0) {
    throw new Error(
      `Couldn't find containers to fit ${count} templates of type "${type}"`
    );
  }

  // "-1" means "fill rest"
  if (count === -1) {
    count = containers.length;
  }

  // Fill containers with rooms
  const usedContainersIds = [];
  const usedTemplatesIds = [];
  while (count > 0) {
    const container = getRandomContainer(containers, usedContainersIds);
    if (!container) {
      break;
    }

    const template = findFittingTemplate(
      templates,
      container,
      usedTemplatesIds
    );

    if (template) {
      const x = Math.floor(container.center.x - template.width / 2);
      const y = Math.floor(container.center.y - template.height / 2);
      container.room = new Room(x, y, template.id, template);
      usedTemplatesIds.push(template.id);
    } else {
      console.warn(
        `Couldn't find a template fitting width="${container.width}" height="${container.height}" for type="${type}"`
      );
    }

    usedContainersIds.push(container.id);
    count--;
  }
}

/**
 * Create the tiles layer of the dungeon
 * @param {TreeNode} tree - BSP tree
 * @param {Object} args - Generation arguments
 * @returns {Array} - Tiles layer
 */
function createTilesLayer(tree, args) {
  let tiles = createTilemap(args.mapWidth, args.mapHeight, 1);

  tiles = carveCorridors(tree, duplicateTilemap(tiles));
  tiles = carveRooms(tree, duplicateTilemap(tiles));
  tiles = computeTilesMask(duplicateTilemap(tiles));

  return tiles;
}

/**
 * Carve corridors into the tiles layer
 * @param {TreeNode} node - BSP tree node
 * @param {Array} tiles - Tiles layer
 * @returns {Array} - Updated tiles layer
 */
function carveCorridors(node, tiles) {
  const corridor = node.leaf.corridor;
  if (!corridor) {
    return tiles;
  }

  for (let y = 0; y < tiles.length; y++) {
    for (let x = 0; x < tiles[y].length; x++) {
      const inHeightRange = y >= corridor.y && y < corridor.down;
      const inWidthRange = x >= corridor.x && x < corridor.right;
      if (inHeightRange && inWidthRange) {
        tiles[y][x] = 0;
      }
    }
  }

  if (node.left) {
    carveCorridors(node.left, tiles);
  }

  if (node.right) {
    carveCorridors(node.right, tiles);
  }

  return tiles;
}

/**
 * Carve rooms into the tiles layer
 * @param {TreeNode} node - BSP tree node
 * @param {Array} tiles - Tiles layer
 * @returns {Array} - Updated tiles layer
 */
function carveRooms(node, tiles) {
  let result = duplicateTilemap(tiles);

  node.leaves.forEach((container) => {
    const room = container.room;
    if (!room) {
      return;
    }

    const tilesLayer = room.template.layers.tiles;
    for (let y = 0; y < room.template.height; y++) {
      for (let x = 0; x < room.template.width; x++) {
        const posY = room.y + y;
        const posX = room.x + x;
        result[posY][posX] = tilesLayer[y][x];
      }
    }
  });

  return result;
}

/**
 * Compute tile masks to add walls
 * @param {Array} tiles - Tiles layer
 * @returns {Array} - Updated tiles layer with walls
 */
export function computeTilesMask(tiles) {
  const result = duplicateTilemap(tiles);

  for (let y = 0; y < result.length; y++) {
    for (let x = 0; x < result[y].length; x++) {
      // Apply tilemask only to walls
      if (result[y][x] > 0) {
        result[y][x] = computeBitMask(x, y, result);
      }

      // Compute holes
      if (result[y][x] < 0) {
        result[y][x] = computeHole(x, y, result);
      }
    }
  }

  return result;
}

/**
 * Create the props layer
 * @param {TreeNode} tree - BSP tree
 * @param {Array} tiles - Tiles layer
 * @param {Object} args - Generation arguments
 * @returns {Array} - Props layer
 */
function createPropsLayer(tree, tiles, args) {
  let props = createTilemap(args.mapWidth, args.mapHeight, 0);

  props = carveProps(tree, props);
  props = carveTorches(tiles, props);

  return props;
}

/**
 * Carve props from rooms into the props layer
 * @param {TreeNode} node - BSP tree node
 * @param {Array} props - Props layer
 * @returns {Array} - Updated props layer
 */
function carveProps(node, props) {
  let result = duplicateTilemap(props);

  node.leaves.forEach((container) => {
    const room = container.room;
    if (!room) {
      return;
    }

    const propsLayer = room.template.layers.props;
    for (let y = 0; y < room.template.height; y++) {
      for (let x = 0; x < room.template.width; x++) {
        const posY = room.y + y;
        const posX = room.x + x;
        result[posY][posX] = propsLayer[y][x];
      }
    }
  });

  return result;
}

/**
 * Add torches to corners in the props layer
 * @param {Array} tiles - Tiles layer
 * @param {Array} props - Props layer
 * @returns {Array} - Updated props layer with torches
 */
export function carveTorches(tiles, props) {
  let result = duplicateTilemap(props);

  for (let y = 0; y < result.length; y++) {
    for (let x = 0; x < result[y].length; x++) {
      const tileId = tiles[y][x];

      const leftCorner = maskToTileIdMap[
        TileDirection.North | TileDirection.West | TileDirection.NorthWest
      ];
      const rightCorner = maskToTileIdMap[
        TileDirection.North | TileDirection.East | TileDirection.NorthEast
      ];

      if (tileId === leftCorner || tileId === rightCorner) {
        result[y][x] = 12; // PropType.Torch
      }
    }
  }

  return result;
}

/**
 * Create the monsters layer
 * @param {TreeNode} tree - BSP tree
 * @param {Object} args - Generation arguments
 * @returns {Array} - Monsters layer
 */
function createMonstersLayer(tree, args) {
  let monsters = createTilemap(args.mapWidth, args.mapHeight, 0);

  monsters = carveMonsters(tree, monsters);

  return monsters;
}

/**
 * Carve monsters from rooms into the monsters layer
 * @param {TreeNode} node - BSP tree node
 * @param {Array} monsters - Monsters layer
 * @returns {Array} - Updated monsters layer
 */
function carveMonsters(node, monsters) {
  let result = duplicateTilemap(monsters);

  node.leaves.forEach((container) => {
    const room = container.room;
    if (!room) {
      return;
    }

    const monstersLayer = room.template.layers.monsters;
    for (let y = 0; y < room.template.height; y++) {
      for (let x = 0; x < room.template.width; x++) {
        const posY = room.y + y;
        const posX = room.x + x;
        result[posY][posX] = monstersLayer[y][x];
      }
    }
  });

  return result;
}

//
// Utility functions
//

/**
 * Mapping from bit masks to tile IDs
 */
const maskToTileIdMap = {
  2: 1,
  8: 2,
  10: 3,
  11: 4,
  16: 5,
  18: 6,
  22: 7,
  24: 8,
  26: 9,
  27: 10,
  30: 11,
  31: 12,
  64: 13,
  66: 14,
  72: 15,
  74: 16,
  75: 17,
  80: 18,
  82: 19,
  86: 20,
  88: 21,
  90: 22,
  91: 23,
  94: 24,
  95: 25,
  104: 26,
  106: 27,
  107: 28,
  120: 29,
  122: 30,
  123: 31,
  126: 32,
  127: 33,
  208: 34,
  210: 35,
  214: 36,
  216: 37,
  218: 38,
  219: 39,
  222: 40,
  223: 41,
  246: 36,
  248: 42,
  250: 43,
  251: 44,
  254: 45,
  255: 46,
  0: 47,
};

/**
 * Compute the bit mask for a wall tile
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 * @param {Array} tiles - Tiles layer
 * @returns {number} - Computed mask
 */
function computeBitMask(x, y, tiles) {
  let mask = 0;

  if (tileDirectionCollides(x, y, "north", tiles)) {
    mask |= TileDirection.North;
  }

  if (tileDirectionCollides(x, y, "west", tiles)) {
    mask |= TileDirection.West;
  }

  if (tileDirectionCollides(x, y, "east", tiles)) {
    mask |= TileDirection.East;
  }

  if (tileDirectionCollides(x, y, "south", tiles)) {
    mask |= TileDirection.South;
  }

  if (
    mask & TileDirection.North &&
    mask & TileDirection.West &&
    tileDirectionCollides(x, y, "north-west", tiles)
  ) {
    mask |= TileDirection.NorthWest;
  }

  if (
    mask & TileDirection.North &&
    mask & TileDirection.East &&
    tileDirectionCollides(x, y, "north-east", tiles)
  ) {
    mask |= TileDirection.NorthEast;
  }

  if (
    mask & TileDirection.South &&
    mask & TileDirection.West &&
    tileDirectionCollides(x, y, "south-west", tiles)
  ) {
    mask |= TileDirection.SouthWest;
  }

  if (
    mask & TileDirection.South &&
    mask & TileDirection.East &&
    tileDirectionCollides(x, y, "south-east", tiles)
  ) {
    mask |= TileDirection.SouthEast;
  }

  return maskToTileIdMap[mask];
}

/**
 * Compute hole type
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 * @param {Array} tiles - Tiles layer
 * @returns {number} - Hole type
 */
function computeHole(x, y, tiles) {
  let result = -1;

  const isTop = y === 0;
  if (!isTop && tiles[y - 1][x] < 0) {
    result = -2;
  }

  return result;
}

/**
 * Check if a tile collides in a specific direction
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 * @param {string} side - Direction to check
 * @param {Array} tilemap - Tiles layer
 * @returns {boolean} - True if collides
 */
function tileDirectionCollides(x, y, side, tilemap) {
  const isLeft = x === 0;
  const isRight = x === tilemap[y].length - 1;
  const isTop = y === 0;
  const isBottom = y === tilemap.length - 1;

  switch (side) {
    case "north":
      return isTop || tilemap[y - 1][x] > 0;
    case "west":
      return isLeft || tilemap[y][x - 1] > 0;
    case "east":
      return isRight || tilemap[y][x + 1] > 0;
    case "south":
      return isBottom || tilemap[y + 1][x] > 0;
    case "north-west":
      return isLeft || isTop || tilemap[y - 1][x - 1] > 0;
    case "north-east":
      return isRight || isTop || tilemap[y - 1][x + 1] > 0;
    case "south-west":
      return isLeft || isBottom || tilemap[y + 1][x - 1] > 0;
    case "south-east":
      return isRight || isBottom || tilemap[y + 1][x + 1] > 0;
  }
}

/**
 * Sort templates by size
 * @param {Array} templates - Room templates
 * @returns {Array} - Sorted templates
 */
function sortTemplatesBySize(templates) {
  return templates.sort((a, b) => a.width - b.width || a.height - b.height);
}

/**
 * Find a template that fits in a container
 * @param {Array} templates - Room templates
 * @param {Container} container - Container to fit in
 * @param {Array} usedIds - IDs of already used templates
 * @returns {Object} - Fitting template
 */
function findFittingTemplate(templates, container, usedIds) {
  const sorted = sortTemplatesBySize(templates).reverse();

  let result = sorted.find(
    (template) =>
      !usedIds.includes(template.id) &&
      template.width <= container.width &&
      template.height <= container.height
  );

  if (!result) {
    result = sorted.find(
      (template) =>
        template.width <= container.width && template.height <= container.height
    );
  }

  return result;
}

/**
 * Get templates by type
 * @param {Array} templates - Room templates
 * @param {string} type - Room type
 * @returns {Array} - Filtered templates
 */
function getTemplatesByType(templates, type) {
  return templates.filter((room) => room.type === type);
}

/**
 * Get empty containers
 * @param {Array} containers - All containers
 * @returns {Array} - Empty containers
 */
function getEmptyContainers(containers) {
  return containers.filter((leaf) => !leaf.room);
}

/**
 * Get a random container
 * @param {Array} containers - All containers
 * @param {Array} usedIds - IDs of already used containers
 * @returns {Container} - Random container
 */
function getRandomContainer(containers, usedIds) {
  const filtered = containers.filter(
    (container) => !usedIds.includes(container.id)
  );
  if (!filtered.length) {
    return null;
  }

  return randomChoice(filtered);
}