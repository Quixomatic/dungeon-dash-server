// dungeonV3.js - Enhanced dungeon generator with integrated spawn rooms
import seedrandom from "seedrandom";
import { TreeNode, Container, Room, Corridor, TileDirection } from "./types.js";
import {
  createTilemap,
  duplicateTilemap,
  random,
  randomChoice,
  randomWeights,
} from "./utils.js";

/**
 * Generate a dungeon with integrated spawn rooms
 * @param {Object} args - Generation arguments
 * @returns {Object} - Generated dungeon
 */
export function generateV3(args) {
  // If a seed is provided, use it to generate dungeon.
  if (args.seed) {
    seedrandom(args.seed, { global: true });
  }

  const startAt = Date.now();

  // Create the tree structure with main dungeon and buffer zones
  const tree = createTreeV3(args);

  // Generate rooms within all containers
  generateAllRooms(tree, args);

  // Create corridors connecting spawn rooms to main dungeon
  connectSpawnRooms(tree, args);

  // Generate tiles, props, and monsters layers
  const tiles = createTilesLayer(tree, args);
  const props = createPropsLayer(tree, tiles, args);
  const monsters = createMonstersLayer(tree, args);

  const endAt = Date.now();
  console.log(`Dungeon V3 generated in ${endAt - startAt}ms`);

  // Collect spawn points for easy reference
  const spawnPoints = collectSpawnPoints(tree);

  return {
    width: args.totalMapWidth,
    height: args.totalMapHeight,
    tree,
    layers: {
      tiles,
      props,
      monsters,
    },
    // Additional metadata
    mainDungeon: {
      x: args.bufferZoneWidth,
      y: args.bufferZoneWidth,
      width: args.mapWidth,
      height: args.mapHeight,
    },
    spawnPoints,
  };
}

/**
 * Create a tree structure with main dungeon and buffer zones
 * @param {Object} args - Generation arguments
 * @returns {TreeNode} - Tree of containers
 */
export function createTreeV3(args) {
  // Calculate total dimensions including buffer zones
  const bufferZoneWidth = args.bufferZoneWidth || 50;
  const totalMapWidth = args.mapWidth + bufferZoneWidth * 2;
  const totalMapHeight = args.mapHeight + bufferZoneWidth * 2;

  // Store calculated dimensions in args for later use
  args.bufferZoneWidth = bufferZoneWidth;
  args.totalMapWidth = totalMapWidth;
  args.totalMapHeight = totalMapHeight;

  // Create root container for the entire map
  const rootContainer = new Container(0, 0, totalMapWidth, totalMapHeight);
  rootContainer.id = "root";
  const rootNode = new TreeNode(rootContainer);

  // Create main dungeon container (centered)
  const dungeonContainer = new Container(
    bufferZoneWidth,
    bufferZoneWidth,
    args.mapWidth,
    args.mapHeight
  );
  dungeonContainer.id = "main_dungeon";
  const dungeonNode = new TreeNode(dungeonContainer);

  // Create buffer zone containers
  const topBufferContainer = new Container(
    bufferZoneWidth, // X position starts after left buffer
    0, // Y position at top of map
    args.mapWidth, // Same width as dungeon
    bufferZoneWidth // Height is buffer zone width
  );
  topBufferContainer.id = "top_buffer";
  const topBufferNode = new TreeNode(topBufferContainer);

  const rightBufferContainer = new Container(
    bufferZoneWidth + args.mapWidth, // X position after dungeon
    bufferZoneWidth, // Y position same as dungeon
    bufferZoneWidth, // Width is buffer zone width
    args.mapHeight // Same height as dungeon
  );
  rightBufferContainer.id = "right_buffer";
  const rightBufferNode = new TreeNode(rightBufferContainer);

  const bottomBufferContainer = new Container(
    bufferZoneWidth, // X position starts after left buffer
    bufferZoneWidth + args.mapHeight, // Y position after dungeon
    args.mapWidth, // Same width as dungeon
    bufferZoneWidth // Height is buffer zone width
  );
  bottomBufferContainer.id = "bottom_buffer";
  const bottomBufferNode = new TreeNode(bottomBufferContainer);

  const leftBufferContainer = new Container(
    0, // X position at left of map
    bufferZoneWidth, // Y position same as dungeon
    bufferZoneWidth, // Width is buffer zone width
    args.mapHeight // Same height as dungeon
  );
  leftBufferContainer.id = "left_buffer";
  const leftBufferNode = new TreeNode(leftBufferContainer);

  // Add all major sections as children of root
  rootNode.children = [
    dungeonNode,
    topBufferNode,
    rightBufferNode,
    bottomBufferNode,
    leftBufferNode,
  ];

  // Generate BSP tree for main dungeon
  generateBspTree(dungeonNode, args.iterations, args);

  // Create spawn room containers in buffer zones
  createSpawnRoomContainers(
    topBufferNode,
    args.spawnRoomsPerSide || 5,
    "top",
    args
  );
  createSpawnRoomContainers(
    rightBufferNode,
    args.spawnRoomsPerSide || 5,
    "right",
    args
  );
  createSpawnRoomContainers(
    bottomBufferNode,
    args.spawnRoomsPerSide || 5,
    "bottom",
    args
  );
  createSpawnRoomContainers(
    leftBufferNode,
    args.spawnRoomsPerSide || 5,
    "left",
    args
  );

  return rootNode;
}

/**
 * Recursively generate a BSP tree for dungeon
 * @param {TreeNode} node - Node to split
 * @param {number} iterations - Number of iterations remaining
 * @param {Object} args - Generation arguments
 */
function generateBspTree(node, iterations, args) {
  const container = node.leaf;

  if (
    iterations !== 0 &&
    container.width > args.containerMinimumSize * 2 &&
    container.height > args.containerMinimumSize * 2
  ) {
    // We still need to divide the container
    const [left, right] = splitContainer(
      container,
      args,
      args.containerSplitRetries
    );

    if (left && right) {
      // Create child nodes for left and right containers
      node.left = new TreeNode(left);
      node.right = new TreeNode(right);

      // Recursively split children
      generateBspTree(node.left, iterations - 1, args);
      generateBspTree(node.right, iterations - 1, args);

      // Create corridor between the two children
      node.leaf.corridor = generateCorridor(
        node.left.leaf,
        node.right.leaf,
        args
      );
    }
  }
}

/**
 * Create spawn room containers within a buffer zone
 * @param {TreeNode} bufferNode - Buffer zone node
 * @param {number} count - Number of spawn rooms to create
 * @param {string} side - Which side ('top', 'right', 'bottom', 'left')
 * @param {Object} args - Generation arguments
 */
function createSpawnRoomContainers(bufferNode, count, side, args) {
  const buffer = bufferNode.leaf;
  const spawnRoomSize = args.spawnRoomSize || 5;

  // Calculate how to distribute rooms along the buffer
  const isHorizontal = side === "top" || side === "bottom";
  const length = isHorizontal ? buffer.width : buffer.height;
  const spacing = length / (count + 1);

  // Create child containers for spawn rooms
  bufferNode.children = [];

  for (let i = 1; i <= count; i++) {
    let x, y;

    // Position spawn room based on which side it's on
    if (side === "top") {
      x = buffer.x + spacing * i - spawnRoomSize / 2;
      y = buffer.y + buffer.height - spawnRoomSize - 2; // Near the dungeon
    } else if (side === "right") {
      x = buffer.x + 2; // Near the dungeon
      y = buffer.y + spacing * i - spawnRoomSize / 2;
    } else if (side === "bottom") {
      x = buffer.x + spacing * i - spawnRoomSize / 2;
      y = buffer.y + 2; // Near the dungeon
    } else {
      // left
      x = buffer.x + buffer.width - spawnRoomSize - 2; // Near the dungeon
      y = buffer.y + spacing * i - spawnRoomSize / 2;
    }

    // Create spawn room container
    const spawnContainer = new Container(
      Math.floor(x),
      Math.floor(y),
      spawnRoomSize,
      spawnRoomSize
    );

    // Generate unique ID for spawn container
    spawnContainer.id = `spawn_${side}_${i}`;

    // Mark as spawn room container
    spawnContainer.isSpawn = true;

    // Create node for this container
    const spawnNode = new TreeNode(spawnContainer);

    // Add to children
    bufferNode.children.push(spawnNode);
  }
}

/**
 * Generate all rooms within containers
 * @param {TreeNode} rootNode - Root of the tree
 * @param {Object} args - Generation arguments
 */
function generateAllRooms(rootNode, args) {
  // Process main dungeon node
  const dungeonNode = rootNode.children[0];
  generateDungeonRooms(dungeonNode, args);

  // Process spawn room nodes
  for (let i = 1; i < rootNode.children.length; i++) {
    const bufferNode = rootNode.children[i];
    generateSpawnRooms(bufferNode, args);
  }
}

/**
 * Generate rooms within the main dungeon
 * @param {TreeNode} dungeonNode - Main dungeon node
 * @param {Object} args - Generation arguments
 */
function generateDungeonRooms(dungeonNode, args) {
  // Get all leaf containers from BSP tree
  const leafContainers = getLeafContainers(dungeonNode);

  // Fill containers with rooms by type
  fillByType(leafContainers, args, "boss", 1);
  fillByType(leafContainers, args, "entrance", 1);
  fillByType(leafContainers, args, "heal", 1);
  fillByType(leafContainers, args, "treasure", 1);
  fillByType(leafContainers, args, "monsters", -1); // Fill rest
}

/**
 * Generate spawn rooms in buffer zones
 * @param {TreeNode} bufferNode - Buffer zone node
 * @param {Object} args - Generation arguments
 */
function generateSpawnRooms(bufferNode, args) {
  // Process each spawn room container
  if (bufferNode.children) {
    bufferNode.children.forEach((spawnNode, index) => {
      const container = spawnNode.leaf;

      // Create a standard spawn room template
      const spawnTemplate = createSpawnRoomTemplate(container.id);

      // Create the room
      container.room = new Room(
        container.x,
        container.y,
        container.id,
        spawnTemplate
      );

      // Add spawn point data
      container.room.spawnPoint = {
        x: container.x + Math.floor(container.width / 2),
        y: container.y + Math.floor(container.height / 2),
        playerId: null,
      };
    });
  }
}

/**
 * Create a standard spawn room template
 * @param {string} id - Room ID
 * @returns {Object} - Spawn room template
 */
function createSpawnRoomTemplate(id) {
  // Standard 5x5 spawn room template
  return {
    id: id,
    type: "spawn",
    width: 5,
    height: 5,
    layers: {
      // All floor tiles (walls will be computed)
      tiles: [
        [0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0],
      ],
      // Empty props array
      props: [
        [0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0],
        [0, 0, 21, 0, 0], // Spawn marker in center (21 = ladder)
        [0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0],
      ],
      // Empty monsters array
      monsters: [
        [0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0],
      ],
    },
  };
}

/**
 * Connect spawn rooms to the main dungeon
 * @param {TreeNode} rootNode - Root of the tree
 * @param {Object} args - Generation arguments
 */
function connectSpawnRooms(rootNode, args) {
  // Get the main dungeon node
  const dungeonNode = rootNode.children[0];

  // Get all leaf containers from the dungeon
  const dungeonContainers = getLeafContainers(dungeonNode);

  // Process each buffer zone
  for (let i = 1; i < rootNode.children.length; i++) {
    const bufferNode = rootNode.children[i];

    // Skip if no children
    if (!bufferNode.children) continue;

    // Connect each spawn room to the dungeon
    bufferNode.children.forEach((spawnNode) => {
      const spawnContainer = spawnNode.leaf;

      // Find nearest dungeon container
      const nearestContainer = findNearestContainer(
        spawnContainer,
        dungeonContainers
      );

      // Generate corridor between spawn room and dungeon
      if (nearestContainer) {
        spawnContainer.corridor = generatePathCorridor(
          spawnContainer,
          nearestContainer,
          args
        );
      }
    });
  }
}

/**
 * Generate a corridor between spawn room and dungeon container
 * @param {Container} spawnContainer - Spawn room container
 * @param {Container} dungeonContainer - Dungeon container
 * @param {Object} args - Generation arguments
 * @returns {Corridor} - Generated corridor
 */
function generatePathCorridor(spawnContainer, dungeonContainer, args) {
  // Calculate centers
  const spawnCenter = {
    x: spawnContainer.x + Math.floor(spawnContainer.width / 2),
    y: spawnContainer.y + Math.floor(spawnContainer.height / 2),
  };

  const dungeonCenter = {
    x: dungeonContainer.x + Math.floor(dungeonContainer.width / 2),
    y: dungeonContainer.y + Math.floor(dungeonContainer.height / 2),
  };

  // Determine which direction to go (horizontal or vertical first)
  const dx = dungeonCenter.x - spawnCenter.x;
  const dy = dungeonCenter.y - spawnCenter.y;
  const horizontalFirst = Math.abs(dx) > Math.abs(dy);

  // Create an L-shaped corridor
  let corridorX, corridorY, corridorWidth, corridorHeight;

  if (horizontalFirst) {
    // Horizontal then vertical
    // First segment (horizontal)
    corridorX = Math.min(spawnCenter.x, dungeonCenter.x);
    corridorY = spawnCenter.y - Math.floor(args.corridorWidth / 2);
    corridorWidth = Math.abs(dx);
    corridorHeight = args.corridorWidth;

    // Create the corridor
    const corridor = new Corridor(
      corridorX,
      corridorY,
      corridorWidth,
      corridorHeight
    );

    // Add second segment information (we'll carve this separately)
    corridor.secondSegment = {
      x: dungeonCenter.x - Math.floor(args.corridorWidth / 2),
      y: Math.min(spawnCenter.y, dungeonCenter.y),
      width: args.corridorWidth,
      height: Math.abs(dy),
    };

    return corridor;
  } else {
    // Vertical then horizontal
    // First segment (vertical)
    corridorX = spawnCenter.x - Math.floor(args.corridorWidth / 2);
    corridorY = Math.min(spawnCenter.y, dungeonCenter.y);
    corridorWidth = args.corridorWidth;
    corridorHeight = Math.abs(dy);

    // Create the corridor
    const corridor = new Corridor(
      corridorX,
      corridorY,
      corridorWidth,
      corridorHeight
    );

    // Add second segment information (we'll carve this separately)
    corridor.secondSegment = {
      x: Math.min(spawnCenter.x, dungeonCenter.x),
      y: dungeonCenter.y - Math.floor(args.corridorWidth / 2),
      width: Math.abs(dx),
      height: args.corridorWidth,
    };

    return corridor;
  }
}

/**
 * Find the nearest container in the dungeon to a spawn container
 * @param {Container} spawnContainer - Spawn room container
 * @param {Array} dungeonContainers - Array of dungeon containers
 * @returns {Container} - Nearest dungeon container
 */
function findNearestContainer(spawnContainer, dungeonContainers) {
  if (!dungeonContainers || dungeonContainers.length === 0) return null;

  // Calculate spawn room center
  const spawnX = spawnContainer.x + Math.floor(spawnContainer.width / 2);
  const spawnY = spawnContainer.y + Math.floor(spawnContainer.height / 2);

  let nearestContainer = null;
  let shortestDistance = Infinity;

  // Find container with shortest Manhattan distance
  for (const container of dungeonContainers) {
    // Skip containers without rooms
    if (!container.room) continue;

    const containerX = container.x + Math.floor(container.width / 2);
    const containerY = container.y + Math.floor(container.height / 2);

    const distance =
      Math.abs(containerX - spawnX) + Math.abs(containerY - spawnY);

    if (distance < shortestDistance) {
      shortestDistance = distance;
      nearestContainer = container;
    }
  }

  return nearestContainer;
}

/**
 * Get all leaf containers from a tree
 * @param {TreeNode} node - Tree node
 * @returns {Array} - Array of leaf containers
 */
function getLeafContainers(node) {
  if (!node) return [];

  // For BSP nodes (with left/right)
  if (node.left || node.right) {
    return [...getLeafContainers(node.left), ...getLeafContainers(node.right)];
  }

  // For spawn room style nodes (with children array)
  if (node.children && node.children.length > 0) {
    let containers = [];
    for (const child of node.children) {
      containers = [...containers, ...getLeafContainers(child)];
    }
    return containers;
  }

  // This is a leaf node
  return [node.leaf];
}

/**
 * Collect all spawn points for easy reference
 * @param {TreeNode} rootNode - Root of the tree
 * @returns {Array} - Array of spawn point objects
 */
function collectSpawnPoints(rootNode) {
  const spawnPoints = [];

  // Skip the first child (main dungeon)
  for (let i = 1; i < rootNode.children.length; i++) {
    const bufferNode = rootNode.children[i];

    // Skip if no children
    if (!bufferNode.children) continue;

    // Process each spawn room
    bufferNode.children.forEach((spawnNode) => {
      const container = spawnNode.leaf;

      // Skip if no room
      if (!container.room || !container.room.spawnPoint) return;

      // Add spawn point
      spawnPoints.push({
        id: container.id,
        x: container.room.spawnPoint.x,
        y: container.room.spawnPoint.y,
        roomX: container.x,
        roomY: container.y,
        width: container.width,
        height: container.height,
        playerId: null,
      });
    });
  }

  return spawnPoints;
}

/**
 * Fill containers with rooms of a specific type
 * @param {Array} containers - Array of leaf containers
 * @param {Object} args - Generation arguments
 * @param {string} type - Room type
 * @param {number} count - Number of rooms to create (-1 for "fill rest")
 */
function fillByType(containers, args, type, count) {
  // Filter available templates by type
  const templates = getTemplatesByType(args.rooms, type);
  if (templates.length === 0) {
    throw new Error(`Couldn't find templates of type "${type}"`);
  }

  // List containers ids that have no rooms yet
  const emptyContainers = containers.filter((container) => !container.room);
  if (emptyContainers.length === 0) {
    console.warn(
      `No empty containers to fit ${count} templates of type "${type}"`
    );
    return;
  }

  // "-1" means "fill rest"
  if (count === -1) {
    count = emptyContainers.length;
  }

  // Fill containers with rooms
  const usedContainersIds = [];
  const usedTemplatesIds = [];

  let filledCount = 0;
  while (
    filledCount < count &&
    usedContainersIds.length < emptyContainers.length
  ) {
    const container = getRandomContainer(emptyContainers, usedContainersIds);
    if (!container) {
      break;
    }

    const template = findFittingTemplate(
      templates,
      container,
      usedTemplatesIds
    );

    if (template) {
      const x = Math.floor(
        container.x + (container.width - template.width) / 2
      );
      const y = Math.floor(
        container.y + (container.height - template.height) / 2
      );
      container.room = new Room(x, y, template.id, template);
      usedTemplatesIds.push(template.id);
      filledCount++;
    } else {
      console.warn(
        `Couldn't find a template fitting width="${container.width}" height="${container.height}" for type="${type}"`
      );
    }

    usedContainersIds.push(container.id);
  }

  return filledCount;
}

/**
 * Create the tiles layer of the dungeon
 * @param {TreeNode} tree - BSP tree
 * @param {Object} args - Generation arguments
 * @returns {Array} - Tiles layer
 */
function createTilesLayer(tree, args) {
  let tiles = createTilemap(args.totalMapWidth, args.totalMapHeight, 1);

  tiles = carveAllCorridors(tree, duplicateTilemap(tiles));
  tiles = carveAllRooms(tree, duplicateTilemap(tiles));
  tiles = computeTilesMask(duplicateTilemap(tiles));

  return tiles;
}

/**
 * Carve all corridors into the tiles layer
 * @param {TreeNode} node - Tree node
 * @param {Array} tiles - Tiles layer
 * @returns {Array} - Updated tiles layer
 */
function carveAllCorridors(node, tiles) {
  // Carve this node's corridor if it exists
  if (node.leaf && node.leaf.corridor) {
    carveCorridorIntoTiles(node.leaf.corridor, tiles);

    // If this is an L-shaped corridor, carve the second segment
    if (node.leaf.corridor.secondSegment) {
      carveCorridorIntoTiles(node.leaf.corridor.secondSegment, tiles);
    }
  }

  // Recursively carve children's corridors
  if (node.left) {
    carveAllCorridors(node.left, tiles);
  }

  if (node.right) {
    carveAllCorridors(node.right, tiles);
  }

  // For spawn room style nodes (with children array)
  if (node.children) {
    for (const child of node.children) {
      carveAllCorridors(child, tiles);
    }
  }

  return tiles;
}

/**
 * Carve a corridor into the tiles layer
 * @param {Corridor|Object} corridor - Corridor or corridor-like object
 * @param {Array} tiles - Tiles layer
 */
function carveCorridorIntoTiles(corridor, tiles) {
  // Skip if parameters are invalid
  if (!corridor || !tiles) return;

  for (let y = 0; y < tiles.length; y++) {
    for (let x = 0; x < tiles[y].length; x++) {
      const inHeightRange = y >= corridor.y && y < corridor.y + corridor.height;
      const inWidthRange = x >= corridor.x && x < corridor.x + corridor.width;
      if (inHeightRange && inWidthRange) {
        tiles[y][x] = 0;
      }
    }
  }
}

/**
 * Carve all rooms into the tiles layer
 * @param {TreeNode} node - Tree node
 * @param {Array} tiles - Tiles layer
 * @returns {Array} - Updated tiles layer
 */
function carveAllRooms(node, tiles) {
  // For spawn room style nodes (with children array)
  if (node.children) {
    for (const child of node.children) {
      tiles = carveAllRooms(child, tiles);
    }
  }

  // Carve this node's room if it exists
  if (node.leaf && node.leaf.room) {
    tiles = carveRoomIntoTiles(node.leaf.room, tiles);
  }

  // Recursively carve children's rooms (for BSP tree)
  if (node.left) {
    tiles = carveAllRooms(node.left, tiles);
  }

  if (node.right) {
    tiles = carveAllRooms(node.right, tiles);
  }

  return tiles;
}

/**
 * Carve a room into the tiles layer
 * @param {Room} room - Room to carve
 * @param {Array} tiles - Tiles layer
 * @returns {Array} - Updated tiles layer
 */
function carveRoomIntoTiles(room, tiles) {
  const tilesLayer = room.template.layers.tiles;

  for (let y = 0; y < room.template.height; y++) {
    for (let x = 0; x < room.template.width; x++) {
      const posY = room.y + y;
      const posX = room.x + x;

      // Make sure position is within tiles bounds
      if (
        posY >= 0 &&
        posY < tiles.length &&
        posX >= 0 &&
        posX < tiles[posY].length
      ) {
        tiles[posY][posX] = tilesLayer[y][x];
      }
    }
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
  let props = createTilemap(args.totalMapWidth, args.totalMapHeight, 0);

  props = carveAllProps(tree, props);
  props = carveTorches(tiles, props);

  return props;
}

/**
 * Carve all props from rooms into the props layer
 * @param {TreeNode} node - Tree node
 * @param {Array} props - Props layer
 * @returns {Array} - Updated props layer
 */
function carveAllProps(node, props) {
  // For spawn room style nodes (with children array)
  if (node.children) {
    for (const child of node.children) {
      props = carveAllProps(child, props);
    }
  }

  // Carve this node's room's props if it exists
  if (node.leaf && node.leaf.room) {
    props = carveRoomPropsIntoLayer(node.leaf.room, props);
  }

  // Recursively carve children's rooms' props (for BSP tree)
  if (node.left) {
    props = carveAllProps(node.left, props);
  }

  if (node.right) {
    props = carveAllProps(node.right, props);
  }

  return props;
}

/**
 * Carve a room's props into the props layer
 * @param {Room} room - Room containing props
 * @param {Array} props - Props layer
 * @returns {Array} - Updated props layer
 */
function carveRoomPropsIntoLayer(room, props) {
  const propsLayer = room.template.layers.props;

  for (let y = 0; y < room.template.height; y++) {
    for (let x = 0; x < room.template.width; x++) {
      const posY = room.y + y;
      const posX = room.x + x;

      // Make sure position is within props bounds
      if (
        posY >= 0 &&
        posY < props.length &&
        posX >= 0 &&
        posX < props[posY].length
      ) {
        props[posY][posX] = propsLayer[y][x];
      }
    }
  }

  return props;
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
      // Skip if props already exist at this position
      if (result[y][x] > 0) continue;

      const tileId = tiles[y] && tiles[y][x] !== undefined ? tiles[y][x] : 0;

      // Check if this is a corner wall tile
      const isCorner =
        tileId === 3 || // Northwest corner
        tileId === 6 || // Northeast corner
        tileId === 15 || // Southwest corner
        tileId === 18; // Southeast corner

      if (isCorner) {
        // Random chance to place a torch
        if (Math.random() < 0.4) {
          result[y][x] = 12; // PropType.Torch
        }
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
  let monsters = createTilemap(args.totalMapWidth, args.totalMapHeight, 0);

  monsters = carveAllMonsters(tree, monsters);

  return monsters;
}

/**
 * Carve all monsters from rooms into the monsters layer
 * @param {TreeNode} node - Tree node
 * @param {Array} monsters - Monsters layer
 * @returns {Array} - Updated monsters layer
 */
function carveAllMonsters(node, monsters) {
  // For spawn room style nodes (with children array)
  if (node.children) {
    for (const child of node.children) {
      monsters = carveAllMonsters(child, monsters);
    }
  }

  // Carve this node's room's monsters if it exists
  if (node.leaf && node.leaf.room) {
    monsters = carveRoomMonstersIntoLayer(node.leaf.room, monsters);
  }

  // Recursively carve children's rooms' monsters (for BSP tree)
  if (node.left) {
    monsters = carveAllMonsters(node.left, monsters);
  }

  if (node.right) {
    monsters = carveAllMonsters(node.right, monsters);
  }

  return monsters;
}

/**
 * Carve a room's monsters into the monsters layer
 * @param {Room} room - Room containing monsters
 * @param {Array} monsters - Monsters layer
 * @returns {Array} - Updated monsters layer
 */
function carveRoomMonstersIntoLayer(room, monsters) {
  const monstersLayer = room.template.layers.monsters;

  for (let y = 0; y < room.template.height; y++) {
    for (let x = 0; x < room.template.width; x++) {
      const posY = room.y + y;
      const posX = room.x + x;

      // Make sure position is within monsters bounds
      if (
        posY >= 0 &&
        posY < monsters.length &&
        posX >= 0 &&
        posX < monsters[posY].length
      ) {
        monsters[posY][posX] = monstersLayer[y][x];
      }
    }
  }

  return monsters;
}

/*
 * The following functions are reused from the original dungeon generator,
 * with minor modifications as needed.
 */

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

// The rest of these utility functions remain the same as the original

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

// Mapping from bit masks to tile IDs
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
 * Get templates by type
 * @param {Array} templates - Room templates
 * @param {string} type - Room type
 * @returns {Array} - Filtered templates
 */
function getTemplatesByType(templates, type) {
  return templates.filter((room) => room.type === type);
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
