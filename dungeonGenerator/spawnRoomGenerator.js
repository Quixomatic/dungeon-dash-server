// server/dungeonGenerator/spawnRoomGenerator.js

import { TreeNode, Container, Room, Point } from './types.js';
import { random, randomChoice } from './utils.js';

/**
 * Adds spawn rooms to an existing dungeon
 * Seamlessly integrates with the tree/leaf structure
 */
export function addSpawnRooms(dungeonData, options = {}) {
  const {
    playerCount = 4,
    bufferDistance = 8,  // Buffer distance between dungeon and spawn rooms (in tiles)
    spawnRoomSize = 5,   // Size of spawn rooms (in tiles)
    templates = null     // Optional room templates to use (will use default if null)
  } = options;
  
  // Get dungeons width, height and tree
  const { width, height, tree, layers } = dungeonData;
  
  // Calculate the center point of the dungeon
  const centerX = Math.floor(width / 2);
  const centerY = Math.floor(height / 2);
  
  // Calculate radius for spawn room placement (outside dungeon + buffer)
  // Use the maximum distance from center to edge plus buffer
  const maxDimension = Math.max(width, height);
  const spawnRadius = Math.floor(maxDimension / 2) + bufferDistance;
  
  // Expanded map dimensions to include spawn rooms
  const expandedWidth = width + (bufferDistance + spawnRoomSize) * 2;
  const expandedHeight = height + (bufferDistance + spawnRoomSize) * 2;
  
  // Offset for the original dungeon in the expanded map (center it)
  const dungeonOffsetX = Math.floor((expandedWidth - width) / 2);
  const dungeonOffsetY = Math.floor((expandedHeight - height) / 2);
  
  // Create spawn rooms around the perimeter
  const spawnRooms = createSpawnRooms(
    playerCount,
    centerX + dungeonOffsetX,
    centerY + dungeonOffsetY,
    spawnRadius,
    spawnRoomSize,
    templates
  );
  
  // Add spawn rooms to tree as new leaves
  const expandedTree = addSpawnNodesToTree(tree, spawnRooms);
  
  // Expand all layers to accommodate spawn rooms
  const expandedLayers = expandLayers(layers, width, height, expandedWidth, expandedHeight, dungeonOffsetX, dungeonOffsetY);
  
  // Add spawn rooms to the layers
  addSpawnRoomsToLayers(expandedLayers, spawnRooms, templates);
  
  // Return expanded dungeon data
  return {
    width: expandedWidth,
    height: expandedHeight,
    tree: expandedTree,
    layers: expandedLayers,
    // Additional metadata
    originalWidth: width,
    originalHeight: height,
    dungeonOffsetX: dungeonOffsetX,
    dungeonOffsetY: dungeonOffsetY,
    spawnRooms: spawnRooms.map(room => ({
      id: room.id,
      x: room.x,
      y: room.y,
      width: room.width,
      height: room.height,
      center: room.center
    }))
  };
}

/**
 * Create spawn rooms positioned around the dungeon perimeter
 * @param {number} count - Number of spawn rooms to create
 * @param {number} centerX - X center of the dungeon
 * @param {number} centerY - Y center of the dungeon 
 * @param {number} radius - Radius from center to spawn rooms
 * @param {number} size - Size of spawn rooms
 * @param {Array} templates - Optional room templates to use
 * @returns {Array} - Array of spawn room containers
 */
function createSpawnRooms(count, centerX, centerY, radius, size, templates) {
  const spawnRooms = [];
  
  // When using templates, find spawn room templates
  const spawnTemplate = templates ? 
    templates.find(t => t.type === 'entrance') || templates.find(t => t.type === 'heal') : 
    null;
  
  // Size adjustment if using templates
  const roomWidth = spawnTemplate ? spawnTemplate.width : size;
  const roomHeight = spawnTemplate ? spawnTemplate.height : size;
  
  // Create spawn rooms evenly distributed around a circle
  for (let i = 0; i < count; i++) {
    // Calculate angle for even distribution
    const angle = (i / count) * Math.PI * 2;
    
    // Add some randomness to the radius (±10%)
    const randomRadius = radius * (0.9 + 0.2 * Math.random());
    
    // Calculate position on the circle
    const spawnX = Math.floor(centerX + Math.cos(angle) * randomRadius) - Math.floor(roomWidth / 2);
    const spawnY = Math.floor(centerY + Math.sin(angle) * randomRadius) - Math.floor(roomHeight / 2);
    
    // Create a container for this spawn room
    const container = new Container(spawnX, spawnY, roomWidth, roomHeight);
    
    // If we have a template, create a room in the container
    if (spawnTemplate) {
      container.room = new Room(spawnX, spawnY, `spawn_${i}`, spawnTemplate);
    } else {
      // Create a basic room
      container.room = {
        id: `spawn_${i}`,
        x: spawnX,
        y: spawnY,
        width: roomWidth,
        height: roomHeight,
        template: {
          id: `spawn_${i}`,
          type: 'spawn',
          width: roomWidth,
          height: roomHeight,
          layers: {
            tiles: createBasicRoomLayout(roomWidth, roomHeight),
            props: createEmptyLayout(roomWidth, roomHeight),
            monsters: createEmptyLayout(roomWidth, roomHeight)
          }
        }
      };
    }
    
    // Add spawn point data to the center of the room
    container.room.spawnPoint = {
      x: spawnX + Math.floor(roomWidth / 2),
      y: spawnY + Math.floor(roomHeight / 2),
      playerId: null
    };
    
    spawnRooms.push(container);
  }
  
  return spawnRooms;
}

/**
 * Add spawn nodes to the existing BSP tree
 * @param {TreeNode} tree - Original BSP tree
 * @param {Array} spawnRooms - Spawn room containers
 * @returns {TreeNode} - Expanded tree with spawn rooms
 */
function addSpawnNodesToTree(tree, spawnRooms) {
  // Clone the original tree (we don't want to modify it)
  const expandedTree = cloneTree(tree);
  
  // For each spawn room, add a new leaf node to the tree
  spawnRooms.forEach(spawnRoom => {
    // Create a new node for this spawn room
    const spawnNode = new TreeNode(spawnRoom);
    
    // Reference from root to spawn node
    if (!expandedTree.spawnNodes) {
      expandedTree.spawnNodes = [];
    }
    expandedTree.spawnNodes.push(spawnNode);
  });
  
  return expandedTree;
}

/**
 * Helper to clone a tree node and its children
 * @param {TreeNode} node - Node to clone
 * @returns {TreeNode} - Cloned node
 */
function cloneTree(node) {
  if (!node) return null;
  
  const clonedNode = new TreeNode(node.leaf);
  
  if (node.left) {
    clonedNode.left = cloneTree(node.left);
  }
  
  if (node.right) {
    clonedNode.right = cloneTree(node.right);
  }
  
  return clonedNode;
}

/**
 * Expand all layers to make room for spawn rooms
 * @param {Object} layers - Original layers
 * @param {number} originalWidth - Original width
 * @param {number} originalHeight - Original height
 * @param {number} expandedWidth - Expanded width
 * @param {number} expandedHeight - Expanded height
 * @param {number} offsetX - X offset
 * @param {number} offsetY - Y offset
 * @returns {Object} - Expanded layers
 */
function expandLayers(layers, originalWidth, originalHeight, expandedWidth, expandedHeight, offsetX, offsetY) {
  const expandedLayers = {
    tiles: createExpandedLayer(layers.tiles, originalWidth, originalHeight, expandedWidth, expandedHeight, offsetX, offsetY, 1),
    props: createExpandedLayer(layers.props, originalWidth, originalHeight, expandedWidth, expandedHeight, offsetX, offsetY, 0),
    monsters: createExpandedLayer(layers.monsters, originalWidth, originalHeight, expandedWidth, expandedHeight, offsetX, offsetY, 0)
  };
  
  return expandedLayers;
}

/**
 * Create an expanded layer
 * @param {Array} originalLayer - Original layer
 * @param {number} originalWidth - Original width
 * @param {number} originalHeight - Original height
 * @param {number} newWidth - New width
 * @param {number} newHeight - New height
 * @param {number} offsetX - X offset
 * @param {number} offsetY - Y offset
 * @param {number} defaultValue - Default value for new cells
 * @returns {Array} - Expanded layer
 */
function createExpandedLayer(originalLayer, originalWidth, originalHeight, newWidth, newHeight, offsetX, offsetY, defaultValue) {
  // Create new layer with default values
  const newLayer = [];
  for (let y = 0; y < newHeight; y++) {
    newLayer[y] = [];
    for (let x = 0; x < newWidth; x++) {
      newLayer[y][x] = defaultValue;
    }
  }
  
  // Copy original layer data to the expanded layer
  for (let y = 0; y < originalHeight; y++) {
    for (let x = 0; x < originalWidth; x++) {
      if (y < originalLayer.length && x < originalLayer[y].length) {
        newLayer[y + offsetY][x + offsetX] = originalLayer[y][x];
      }
    }
  }
  
  return newLayer;
}

/**
 * Add spawn rooms to the layers
 * @param {Object} layers - Expanded layers
 * @param {Array} spawnRooms - Spawn room containers
 * @param {Array} templates - Optional room templates
 */
function addSpawnRoomsToLayers(layers, spawnRooms, templates) {
  spawnRooms.forEach(container => {
    const room = container.room;
    
    if (room && room.template) {
      const { x, y, width, height, template } = room;
      
      // Add room layout to tiles layer
      if (template.layers.tiles) {
        for (let tY = 0; tY < height; tY++) {
          for (let tX = 0; tX < width; tX++) {
            const posY = y + tY;
            const posX = x + tX;
            
            if (posY >= 0 && posY < layers.tiles.length && 
                posX >= 0 && posX < layers.tiles[posY].length) {
              if (tY < template.layers.tiles.length && tX < template.layers.tiles[tY].length) {
                layers.tiles[posY][posX] = template.layers.tiles[tY][tX];
              }
            }
          }
        }
      }
      
      // Add props to props layer
      if (template.layers.props) {
        for (let tY = 0; tY < height; tY++) {
          for (let tX = 0; tX < width; tX++) {
            const posY = y + tY;
            const posX = x + tX;
            
            if (posY >= 0 && posY < layers.props.length && 
                posX >= 0 && posX < layers.props[posY].length) {
              if (tY < template.layers.props.length && tX < template.layers.props[tY].length) {
                layers.props[posY][posX] = template.layers.props[tY][tX];
              }
            }
          }
        }
      }
      
      // Add spawn marker at the center of the room
      const centerX = x + Math.floor(width / 2);
      const centerY = y + Math.floor(height / 2);
      
      // Add a special prop for spawn point (using a torch or similar)
      if (centerY >= 0 && centerY < layers.props.length && 
          centerX >= 0 && centerX < layers.props[centerY].length) {
        layers.props[centerY][centerX] = 21; // 21 = ladder, could be any special marker
      }
    }
  });
}

/**
 * Create a basic room layout for a spawn room
 * @param {number} width - Room width
 * @param {number} height - Room height
 * @returns {Array} - Room layout
 */
function createBasicRoomLayout(width, height) {
  const layout = [];
  
  for (let y = 0; y < height; y++) {
    layout[y] = [];
    for (let x = 0; x < width; x++) {
      // Wall at the edges, floor in the middle
      if (x === 0 || x === width - 1 || y === 0 || y === height - 1) {
        layout[y][x] = 1; // Wall
      } else {
        layout[y][x] = 0; // Floor
      }
    }
  }
  
  return layout;
}

/**
 * Create an empty layout filled with zeros
 * @param {number} width - Width
 * @param {number} height - Height
 * @returns {Array} - Empty layout
 */
function createEmptyLayout(width, height) {
  const layout = [];
  
  for (let y = 0; y < height; y++) {
    layout[y] = [];
    for (let x = 0; x < width; x++) {
      layout[y][x] = 0;
    }
  }
  
  return layout;
}