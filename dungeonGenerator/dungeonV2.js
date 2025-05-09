// server/dungeonGenerator/dungeon.js
// Fully integrated BSP dungeon generator with spawn rooms

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
import { computeTilesMask, carveTorches } from './dungeon.js';

// Standard spawn room template
const SPAWN_ROOM_TEMPLATE = {
  width: 7,
  height: 7,
  type: "spawn",
  id: "spawn_room_template",
  layers: {
    tiles: [
      [1, 1, 1, 1, 1, 1, 1],
      [1, 0, 0, 0, 0, 0, 1],
      [1, 0, 0, 0, 0, 0, 1],
      [1, 0, 0, 0, 0, 0, 1],
      [1, 0, 0, 0, 0, 0, 1],
      [1, 0, 0, 0, 0, 0, 1],
      [1, 1, 1, 1, 1, 1, 1]
    ],
    props: [
      [0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 21, 0, 0, 0], // Special marker (21) in center for spawn point
      [0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0]
    ],
    monsters: [
      [0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0]
    ]
  }
};

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

  // Ensure spawn room template is in room templates
  if (args.rooms && !args.rooms.find(r => r.type === "spawn")) {
    args.rooms.push(SPAWN_ROOM_TEMPLATE);
  }
  
  // Set default player count if not provided
  args.playerCount = args.playerCount || 4;
  
  // Calculate spawn room ring parameters
  args.spawnRoomWidth = SPAWN_ROOM_TEMPLATE.width;
  args.spawnRoomHeight = SPAWN_ROOM_TEMPLATE.height;
  
  // Create a fully integrated BSP tree
  const tree = createIntegratedTree(args);
  
  // Generate rooms in the tree
  generateRooms(tree, args);
  
  // Create layers
  const tiles = createTilesLayer(tree, args);
  const props = createPropsLayer(tree, tiles, args);
  const monsters = createMonstersLayer(tree, args);

  // Extract spawn points
  const spawnPoints = extractSpawnPoints(tree);

  const endAt = Date.now();
  console.log(`Dungeon generated in ${endAt - startAt}ms with ${spawnPoints.length} spawn rooms`);

  return {
    width: args.mapWidth,
    height: args.mapHeight,
    tree,
    layers: {
      tiles,
      props,
      monsters,
    },
    spawnRooms: spawnPoints,
  };
}

/**
 * Create a tree structure for the dungeon with integrated spawn rooms
 * @param {Object} args - Generation arguments
 * @returns {TreeNode} - Tree of containers
 */
export function createIntegratedTree(args) {
  // Start with a container for the full map
  const fullMapContainer = new Container(
    0, 0, args.mapWidth, args.mapHeight
  );
  
  // Create the initial tree node
  const rootNode = new TreeNode(fullMapContainer);
  
  // Create reserved areas for spawn rooms and core dungeon
  reserveSpawnRoomAreas(rootNode, args);
  
  // Apply standard BSP to the core dungeon area
  generateBSPForCore(rootNode, args);
  
  return rootNode;
}

/**
 * First pass: Reserve spawn room areas around the perimeter
 * This creates the initial splits to reserve spawn room containers
 * @param {TreeNode} rootNode - Root of the tree
 * @param {Object} args - Generation arguments
 */
function reserveSpawnRoomAreas(rootNode, args) {
  // Get the number of spawn rooms to create
  const playerCount = args.playerCount;
  const spawnRoomWidth = args.spawnRoomWidth;
  const spawnRoomHeight = args.spawnRoomHeight;
  
  // Calculate how many spawn rooms per side
  const spawnRoomsPerSide = Math.ceil(playerCount / 4);
  
  // Current node to work on
  let currentNode = rootNode;
  
  // Track spawn nodes to mark them later
  const spawnNodes = [];
  
  // 1. Create spawn containers on TOP edge
  for (let i = 0; i < spawnRoomsPerSide && i < playerCount; i++) {
    // Create a split with a spawn container on top
    currentNode = splitForSpawnRoom(
      currentNode, 
      'top', 
      spawnRoomWidth, 
      spawnRoomHeight,
      spawnRoomsPerSide,
      i
    );
    
    // Add the spawn node to our tracking
    if (currentNode.left) {
      currentNode.left.isSpawnNode = true;
      spawnNodes.push(currentNode.left);
    }
  }
  
  // 2. Create spawn containers on RIGHT edge
  for (let i = 0; i < spawnRoomsPerSide && i + spawnRoomsPerSide < playerCount; i++) {
    // Create a split with a spawn container on right
    currentNode = splitForSpawnRoom(
      currentNode, 
      'right', 
      spawnRoomWidth, 
      spawnRoomHeight,
      spawnRoomsPerSide,
      i
    );
    
    // Add the spawn node to our tracking
    if (currentNode.left) {
      currentNode.left.isSpawnNode = true;
      spawnNodes.push(currentNode.left);
    }
  }
  
  // 3. Create spawn containers on BOTTOM edge
  for (let i = 0; i < spawnRoomsPerSide && i + spawnRoomsPerSide * 2 < playerCount; i++) {
    // Create a split with a spawn container on bottom
    currentNode = splitForSpawnRoom(
      currentNode, 
      'bottom', 
      spawnRoomWidth, 
      spawnRoomHeight,
      spawnRoomsPerSide,
      i
    );
    
    // Add the spawn node to our tracking
    if (currentNode.left) {
      currentNode.left.isSpawnNode = true;
      spawnNodes.push(currentNode.left);
    }
  }
  
  // 4. Create spawn containers on LEFT edge
  for (let i = 0; i < spawnRoomsPerSide && i + spawnRoomsPerSide * 3 < playerCount; i++) {
    // Create a split with a spawn container on left
    currentNode = splitForSpawnRoom(
      currentNode, 
      'left', 
      spawnRoomWidth, 
      spawnRoomHeight,
      spawnRoomsPerSide,
      i
    );
    
    // Add the spawn node to our tracking
    if (currentNode.left) {
      currentNode.left.isSpawnNode = true;
      spawnNodes.push(currentNode.left);
    }
  }
  
  // Save the core dungeon container node for further BSP
  rootNode.coreNode = currentNode;
  
  // Set spawn node flags and IDs
  spawnNodes.forEach((node, index) => {
    node.isSpawnNode = true;
    if (node.leaf) {
      node.leaf.isSpawnRoom = true;
      node.leaf.id = `spawn_${index}`;
    }
  });
}

/**
 * Split a container to create a spawn room on one edge
 * @param {TreeNode} node - Node to split
 * @param {string} edge - Edge to place spawn room on ('top', 'right', 'bottom', 'left')
 * @param {number} spawnWidth - Width of spawn room
 * @param {number} spawnHeight - Height of spawn room
 * @param {number} spawnPerSide - Spawn rooms per side
 * @param {number} index - Index on this side
 * @returns {TreeNode} - The node for the inner area
 */
function splitForSpawnRoom(node, edge, spawnWidth, spawnHeight, spawnPerSide, index) {
  if (!node || !node.leaf) return node;
  
  const container = node.leaf;
  let spawnContainer, remainingContainer;
  
  // Calculate position based on edge and index
  switch(edge) {
    case 'top':
      // Split horizontally to create a thin strip at the top
      spawnContainer = new Container(
        container.x + Math.floor((container.width / spawnPerSide) * index),
        container.y,
        Math.floor(container.width / spawnPerSide),
        spawnHeight
      );
      
      remainingContainer = new Container(
        container.x,
        container.y + spawnHeight,
        container.width,
        container.height - spawnHeight
      );
      break;
      
    case 'right':
      // Split vertically to create a thin strip on the right
      spawnContainer = new Container(
        container.x + container.width - spawnWidth,
        container.y + Math.floor((container.height / spawnPerSide) * index),
        spawnWidth,
        Math.floor(container.height / spawnPerSide)
      );
      
      remainingContainer = new Container(
        container.x,
        container.y,
        container.width - spawnWidth,
        container.height
      );
      break;
      
    case 'bottom':
      // Split horizontally to create a thin strip at the bottom
      spawnContainer = new Container(
        container.x + container.width - Math.floor((container.width / spawnPerSide) * (index + 1)),
        container.y + container.height - spawnHeight,
        Math.floor(container.width / spawnPerSide),
        spawnHeight
      );
      
      remainingContainer = new Container(
        container.x,
        container.y,
        container.width,
        container.height - spawnHeight
      );
      break;
      
    case 'left':
      // Split vertically to create a thin strip on the left
      spawnContainer = new Container(
        container.x,
        container.y + container.height - Math.floor((container.height / spawnPerSide) * (index + 1)),
        spawnWidth,
        Math.floor(container.height / spawnPerSide)
      );
      
      remainingContainer = new Container(
        container.x + spawnWidth,
        container.y,
        container.width - spawnWidth,
        container.height
      );
      break;
      
    default:
      return node;
  }
  
  // Create new nodes
  node.left = new TreeNode(spawnContainer);
  node.right = new TreeNode(remainingContainer);
  
  // Mark the spawn container
  spawnContainer.isSpawnRoom = true;
  
  // Return the inner container node for further operations
  return node.right;
}

/**
 * Apply standard BSP to the core area
 * @param {TreeNode} rootNode - Root node containing all containers
 * @param {Object} args - Generation arguments
 */
function generateBSPForCore(rootNode, args) {
  if (!rootNode.coreNode || !rootNode.coreNode.leaf) return;
  
  // Get core container
  const coreContainer = rootNode.coreNode.leaf;
  
  // Create a new BSP tree for the core area
  const coreTree = generateTree(
    coreContainer,
    args.iterations,
    args
  );
  
  // Replace the core node with the BSP tree
  rootNode.coreNode = coreTree;
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
    // Vertical split
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
    // Horizontal split
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
  // First handle spawn rooms (all spawn nodes)
  generateSpawnRooms(tree, args);
  
  // Then handle standard rooms in the core dungeon
  fillByType(tree, args, "boss", 1);
  fillByType(tree, args, "entrance", 1);
  fillByType(tree, args, "heal", 1);
  fillByType(tree, args, "treasure", 1);
  fillByType(tree, args, "monsters", -1);
}

/**
 * Generate spawn rooms in spawn containers
 * @param {TreeNode} tree - BSP tree
 * @param {Object} args - Generation arguments
 */
function generateSpawnRooms(tree, args) {
  // Get spawn room template
  const spawnTemplate = args.rooms.find(t => t.type === "spawn") || SPAWN_ROOM_TEMPLATE;
  
  // Find all spawn nodes in the tree
  const spawnNodes = findSpawnNodes(tree);
  
  // Create rooms in each spawn container
  spawnNodes.forEach((node, index) => {
    if (!node.leaf) return;
    
    const container = node.leaf;
    
    // Create the spawn room at the center of the container
    const x = Math.floor(container.center.x - spawnTemplate.width / 2);
    const y = Math.floor(container.center.y - spawnTemplate.height / 2);
    
    container.room = new Room(x, y, `spawn_${index}`, spawnTemplate);
  });
}

/**
 * Find all spawn nodes in the tree
 * @param {TreeNode} node - Tree node to search
 * @param {Array} result - Array to collect results
 * @returns {Array} - Array of spawn nodes
 */
function findSpawnNodes(node, result = []) {
  if (!node) return result;
  
  // If this is a spawn node, add it
  if (node.isSpawnNode) {
    result.push(node);
  }
  
  // Search children
  if (node.left) findSpawnNodes(node.left, result);
  if (node.right) findSpawnNodes(node.right, result);
  if (node.coreNode) findSpawnNodes(node.coreNode, result);
  
  return result;
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

  // Get all containers that don't have rooms yet (excluding spawn rooms)
  const containers = getEmptyContainers(getAllLeaves(tree))
    .filter(container => !container.isSpawnRoom);
  
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
 * Get all leaf containers from a tree, including spawn nodes
 * @param {TreeNode} node - Tree node to get leaves from
 * @returns {Array} - Array of leaf containers
 */
function getAllLeaves(node) {
  if (!node) return [];
  
  const leaves = [];
  
  // If this is a leaf node with container data, add it
  if (!node.left && !node.right && node.leaf) {
    leaves.push(node.leaf);
    return leaves;
  }
  
  // If we have children, get their leaves
  if (node.left) {
    leaves.push(...getAllLeaves(node.left));
  }
  
  if (node.right) {
    leaves.push(...getAllLeaves(node.right));
  }
  
  // Also check core node
  if (node.coreNode) {
    leaves.push(...getAllLeaves(node.coreNode));
  }
  
  return leaves;
}

/**
 * Extract spawn points from tree for easy access
 * @param {TreeNode} tree - BSP tree
 * @returns {Array} - Array of spawn point objects
 */
function extractSpawnPoints(tree) {
  // Find all spawn nodes
  const spawnNodes = findSpawnNodes(tree);
  
  return spawnNodes.map((node, index) => {
    const container = node.leaf;
    if (!container || !container.room) return null;
    
    // Find spawn marker in props layer
    let spawnX = container.center.x;
    let spawnY = container.center.y;
    
    // Calculate exact spawn position
    if (container.room.template && container.room.template.layers && container.room.template.layers.props) {
      const props = container.room.template.layers.props;
      for (let y = 0; y < props.length; y++) {
        for (let x = 0; x < props[y].length; x++) {
          // Check for spawn marker (value 21)
          if (props[y][x] === 21) {
            spawnX = container.room.x + x;
            spawnY = container.room.y + y;
            break;
          }
        }
      }
    }
    
    return {
      id: container.room.id,
      x: spawnX,
      y: spawnY,
      roomX: container.room.x,
      roomY: container.room.y,
      width: container.room.width,
      height: container.room.height,
      playerId: null // Will be assigned when a player spawns
    };
  }).filter(room => room !== null);
}

/**
 * Create the tiles layer of the dungeon
 * @param {TreeNode} tree - BSP tree
 * @param {Object} args - Generation arguments
 * @returns {Array} - Tiles layer
 */
function createTilesLayer(tree, args) {
  let tiles = createTilemap(args.mapWidth, args.mapHeight, 1);

  // Carve corridors - this handles ALL corridors in the tree
  tiles = carveCorridorsRecursive(tree, duplicateTilemap(tiles));
  
  // Carve rooms - this handles ALL rooms in the tree
  tiles = carveRoomsRecursive(tree, duplicateTilemap(tiles));
  
  // Process tile masks
  tiles = computeTilesMask(duplicateTilemap(tiles));

  return tiles;
}

/**
 * Recursively carve corridors into the tiles layer
 * @param {TreeNode} node - Tree node
 * @param {Array} tiles - Tiles layer
 * @returns {Array} - Updated tiles layer
 */
function carveCorridorsRecursive(node, tiles) {
  if (!node) return tiles;
  
  // Carve corridor in this node
  if (node.leaf && node.leaf.corridor) {
    const corridor = node.leaf.corridor;
    
    for (let y = 0; y < tiles.length; y++) {
      for (let x = 0; x < tiles[y].length; x++) {
        // Check if this position is within the corridor
        const inHeightRange = y >= corridor.y && y < corridor.y + corridor.height;
        const inWidthRange = x >= corridor.x && x < corridor.x + corridor.width;
        
        if (inHeightRange && inWidthRange) {
          tiles[y][x] = 0; // Set to floor
        }
      }
    }
  }
  
  // Process corridors in children
  if (node.left) {
    carveCorridorsRecursive(node.left, tiles);
  }
  
  if (node.right) {
    carveCorridorsRecursive(node.right, tiles);
  }
  
  // Process corridors in core node
  if (node.coreNode) {
    carveCorridorsRecursive(node.coreNode, tiles);
  }
  
  return tiles;
}

/**
 * Recursively carve rooms into the tiles layer
 * @param {TreeNode} node - Tree node
 * @param {Array} tiles - Tiles layer
 * @returns {Array} - Updated tiles layer
 */
function carveRoomsRecursive(node, tiles) {
  if (!node) return tiles;
  
  // Carve room in this node
  if (node.leaf && node.leaf.room) {
    const room = node.leaf.room;
    
    if (!room.template || !room.template.layers || !room.template.layers.tiles) {
      return tiles;
    }
    
    const tilesLayer = room.template.layers.tiles;
    
    for (let y = 0; y < room.template.height; y++) {
      for (let x = 0; x < room.template.width; x++) {
        const posY = room.y + y;
        const posX = room.x + x;
        
        // Skip if out of bounds
        if (posY < 0 || posY >= tiles.length || posX < 0 || posX >= tiles[0].length) {
          continue;
        }
        
        tiles[posY][posX] = tilesLayer[y][x];
      }
    }
  }
  
  // Process rooms in children
  if (node.left) {
    carveRoomsRecursive(node.left, tiles);
  }
  
  if (node.right) {
    carveRoomsRecursive(node.right, tiles);
  }
  
  // Process rooms in core node
  if (node.coreNode) {
    carveRoomsRecursive(node.coreNode, tiles);
  }
  
  return tiles;
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

  // Carve props from all rooms (including spawn rooms)
  props = carvePropsRecursive(tree, props);
  
  // Add torches
  props = carveTorches(tiles, props);

  return props;
}

/**
 * Recursively carve props from rooms into the props layer
 * @param {TreeNode} node - Tree node
 * @param {Array} props - Props layer
 * @returns {Array} - Updated props layer
 */
function carvePropsRecursive(node, props) {
  if (!node) return props;
  
  // Add props from this node's room
  if (node.leaf && node.leaf.room) {
    const room = node.leaf.room;
    
    if (!room.template || !room.template.layers || !room.template.layers.props) {
      return props;
    }
    
    const propsLayer = room.template.layers.props;
    
    for (let y = 0; y < room.template.height; y++) {
      for (let x = 0; x < room.template.width; x++) {
        const posY = room.y + y;
        const posX = room.x + x;
        
        // Skip if out of bounds
        if (posY < 0 || posY >= props.length || posX < 0 || posX >= props[0].length) {
          continue;
        }
        
        props[posY][posX] = propsLayer[y][x];
      }
    }
  }
  
  // Process props in children
  if (node.left) {
    carvePropsRecursive(node.left, props);
  }
  
  if (node.right) {
    carvePropsRecursive(node.right, props);
  }
  
  // Process props in core node
  if (node.coreNode) {
    carvePropsRecursive(node.coreNode, props);
  }
  
  return props;
}

/**
 * Create the monsters layer
 * @param {TreeNode} tree - BSP tree
 * @param {Object} args - Generation arguments
 * @returns {Array} - Monsters layer
 */
function createMonstersLayer(tree, args) {
  let monsters = createTilemap(args.mapWidth, args.mapHeight, 0);

  // Carve monsters from all rooms (excluding spawn rooms)
  monsters = carveMonstersRecursive(tree, monsters);

  return monsters;
}

/**
 * Recursively carve monsters from rooms into the monsters layer
 * @param {TreeNode} node - Tree node
 * @param {Array} monsters - Monsters layer
 * @returns {Array} - Updated monsters layer
 */
function carveMonstersRecursive(node, monsters) {
  if (!node) return monsters;
  
  // Add monsters from this node's room
  if (node.leaf && node.leaf.room) {
    const room = node.leaf.room;
    
    if (!room.template || !room.template.layers || !room.template.layers.monsters) {
      return monsters;
    }
    
    const monstersLayer = room.template.layers.monsters;
    
    for (let y = 0; y < room.template.height; y++) {
      for (let x = 0; x < room.template.width; x++) {
        const posY = room.y + y;
        const posX = room.x + x;
        
        // Skip if out of bounds
        if (posY < 0 || posY >= monsters.length || posX < 0 || posX >= monsters[0].length) {
          continue;
        }
        
        monsters[posY][posX] = monstersLayer[y][x];
      }
    }
  }
  
  // Process monsters in children
  if (node.left) {
    carveMonstersRecursive(node.left, monsters);
  }
  
  if (node.right) {
    carveMonstersRecursive(node.right, monsters);
  }
  
  // Process monsters in core node
  if (node.coreNode) {
    carveMonstersRecursive(node.coreNode, monsters);
  }
  
  return monsters;
}

// The following are utility functions from the original implementation

function getTemplatesByType(templates, type) {
  return templates.filter((room) => room.type === type);
}

function getEmptyContainers(containers) {
  return containers.filter((leaf) => !leaf.room);
}

function getRandomContainer(containers, usedIds) {
  const filtered = containers.filter(
    (container) => !usedIds.includes(container.id)
  );
  if (!filtered.length) {
    return null;
  }

  return randomChoice(filtered);
}

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

function sortTemplatesBySize(templates) {
  return templates.sort((a, b) => a.width - b.width || a.height - b.height);
}

// Re-export important functions
export { computeTilesMask } from './dungeon.js';

// Add these helper functions to maintain compatibility with original implementation
function carveCorridors(tree, tiles) {
  return carveCorridorsRecursive(tree, tiles);
}

function carveRooms(tree, tiles) {
  return carveRoomsRecursive(tree, tiles);
}

export { carveCorridors, carveRooms };