// server/dungeonGenerator/spawnRoomGenerator.js

import { TreeNode, Container, Room, Point, Corridor } from './types.js';
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
    options.gutterWidth || 20, // Pass the gutter width from mapGutterWidth
    spawnRoomSize,
    templates
  );
  
  // Expand all layers to accommodate spawn rooms
  const expandedLayers = expandLayers(layers, width, height, expandedWidth, expandedHeight, dungeonOffsetX, dungeonOffsetY);
  
  // Connect spawn rooms to nearest dungeon room with corridors
  connectSpawnRoomsToMap(spawnRooms, tree, expandedLayers.tiles);
  
  // Add spawn rooms to the layers
  addSpawnRoomsToLayers(expandedLayers, spawnRooms, templates);
  
  // Add spawn rooms to tree as new leaves
  const expandedTree = addSpawnNodesToTree(tree, spawnRooms);
  
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
function createSpawnRooms(count, centerX, centerY, radius, gutterWidth, size, templates) {
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
    
    // Calculate position within the gutter zone
    // The radius should be the dungeon radius minus a small buffer (e.g., half the gutter width)
    const spawnRadius = radius - (gutterWidth / 2);
    
    // Add some randomness to the radius (±10%)
    const randomRadius = spawnRadius * (0.9 + 0.2 * Math.random());
    
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
 * Add corridors from spawn rooms to the main dungeon
 * @param {Array} spawnRooms - Spawn room containers
 * @param {TreeNode} dungeonTree - Main dungeon tree
 * @param {Array} dungeonTiles - Dungeon tiles layer
 * @returns {Array} - Array of corridors created
 */
function connectSpawnRoomsToMap(spawnRooms, dungeonTree, dungeonTiles) {
  const corridors = [];
  
  // Get all rooms from the dungeon tree
  const dungeonRooms = dungeonTree.leaves
    .filter(container => container.room !== null)
    .map(container => container.room);
  
  if (dungeonRooms.length === 0) {
    console.error("No dungeon rooms found to connect to spawn rooms");
    return corridors;
  }
  
  // For each spawn room, connect to the nearest dungeon room
  spawnRooms.forEach((spawnContainer, index) => {
    const spawnRoom = spawnContainer.room;
    
    // Find the nearest room
    let nearestRoom = null;
    let nearestDistance = Infinity;
    
    dungeonRooms.forEach(room => {
      // Calculate distance between room centers
      const dx = (room.x + room.width/2) - (spawnRoom.x + spawnRoom.width/2);
      const dy = (room.y + room.height/2) - (spawnRoom.y + spawnRoom.height/2);
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      if (distance < nearestDistance) {
        nearestRoom = room;
        nearestDistance = distance;
      }
    });
    
    if (!nearestRoom) {
      console.error(`No nearest room found for spawn room ${index}`);
      return;
    }
    
    // Simply carve a direct corridor in each direction
    // This approach guarantees connection without complex calculations
    
    // Corridor width
    const corridorWidth = 4;
    
    // Get room centers
    const spawnCenterX = Math.floor(spawnRoom.x + spawnRoom.width/2);
    const spawnCenterY = Math.floor(spawnRoom.y + spawnRoom.height/2);
    const roomCenterX = Math.floor(nearestRoom.x + nearestRoom.width/2);
    const roomCenterY = Math.floor(nearestRoom.y + nearestRoom.height/2);
    
    // Create a horizontal corridor spanning the entire distance between rooms
    const horizontalCorridor = {
      x: Math.min(spawnCenterX, roomCenterX),
      y: spawnCenterY - Math.floor(corridorWidth/2),
      width: Math.abs(roomCenterX - spawnCenterX) + corridorWidth,
      height: corridorWidth
    };
    
    // Create a vertical corridor spanning the entire distance between rooms
    const verticalCorridor = {
      x: roomCenterX - Math.floor(corridorWidth/2),
      y: Math.min(spawnCenterY, roomCenterY),
      width: corridorWidth,
      height: Math.abs(roomCenterY - spawnCenterY) + corridorWidth
    };
    
    // Carve both corridors - one will be horizontal, one vertical, creating an L shape
    [horizontalCorridor, verticalCorridor].forEach(corridor => {
      for (let y = corridor.y; y < corridor.y + corridor.height; y++) {
        if (y < 0 || y >= dungeonTiles.length) continue;
        
        for (let x = corridor.x; x < corridor.x + corridor.width; x++) {
          if (x < 0 || x >= dungeonTiles[y].length) continue;
          
          // Set to floor (0)
          dungeonTiles[y][x] = 0;
        }
      }
      
      // Add to corridor list
      corridors.push(new Corridor(
        corridor.x,
        corridor.y,
        corridor.width,
        corridor.height
      ));
    });
    
    // Store in spawn room
    spawnContainer.corridors = [
      new Corridor(
        horizontalCorridor.x,
        horizontalCorridor.y,
        horizontalCorridor.width,
        horizontalCorridor.height
      ),
      new Corridor(
        verticalCorridor.x,
        verticalCorridor.y,
        verticalCorridor.width,
        verticalCorridor.height
      )
    ];
    
    console.log(`Created corridor from spawn ${index} to nearest room:`, {
      spawnRoom: { x: spawnRoom.x, y: spawnRoom.y, w: spawnRoom.width, h: spawnRoom.height },
      nearestRoom: { x: nearestRoom.x, y: nearestRoom.y, w: nearestRoom.width, h: nearestRoom.height },
      horizontalCorridor,
      verticalCorridor
    });
  });
  
  return corridors;
}

/**
 * Plot a line using Bresenham's algorithm
 * @param {number} x0 - Start X
 * @param {number} y0 - Start Y
 * @param {number} x1 - End X
 * @param {number} y1 - End Y
 * @returns {Array} - Array of points on the line
 */
function plotLine(x0, y0, x1, y1) {
  const points = [];
  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;
  
  let x = x0;
  let y = y0;
  
  while (true) {
    points.push({ x, y });
    
    if (x === x1 && y === y1) break;
    
    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      x += sx;
    }
    if (e2 < dx) {
      err += dx;
      y += sy;
    }
  }
  
  return points;
}

/**
 * Carve a path with a specific width into the dungeon tiles
 * @param {Array} path - Array of path points
 * @param {Array} tiles - Tiles layer
 * @param {number} width - Width of the corridor
 */
function carvePathWithWidth(path, tiles, width) {
  // Skip if tiles or path is invalid
  if (!tiles || !tiles.length || !path || !path.length) return;
  
  // Calculate half width (rounded down)
  const halfWidth = Math.floor(width / 2);
  
  // Carve tiles along the path with the specified width
  path.forEach(point => {
    // Carve tiles in a square around the path point
    for (let y = point.y - halfWidth; y <= point.y + halfWidth; y++) {
      // Skip if y is out of bounds
      if (y < 0 || y >= tiles.length) continue;
      
      for (let x = point.x - halfWidth; x <= point.x + halfWidth; x++) {
        // Skip if x is out of bounds
        if (x < 0 || x >= tiles[y].length) continue;
        
        // Set tile to floor (0)
        tiles[y][x] = 0;
      }
    }
  });
}

/**
 * Carve a corridor into the tiles layer
 * @param {Corridor} corridor - Corridor to carve
 * @param {Array} tiles - Tiles layer
 */
function carveCorridorIntoTiles(corridor, tiles) {
  // Make sure tiles exists
  if (!tiles || !tiles.length) return;
  
  // Carve the corridor into the tiles
  for (let y = corridor.y; y < corridor.y + corridor.height; y++) {
    // Skip if y is out of bounds
    if (y < 0 || y >= tiles.length) continue;
    
    for (let x = corridor.x; x < corridor.x + corridor.width; x++) {
      // Skip if x is out of bounds
      if (x < 0 || x >= tiles[y].length) continue;
      
      // Set tile to floor (0)
      tiles[y][x] = 0;
    }
  }
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