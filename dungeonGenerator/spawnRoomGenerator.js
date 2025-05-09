// server/dungeonGenerator/spawnRoomGenerator.js

import { TreeNode, Container, Room, Point, Corridor } from "./types.js";
import { random, randomChoice } from "./utils.js";

/**
 * Adds spawn rooms to an existing dungeon
 * Properly places them in the buffer zone around the dungeon
 */
export function addSpawnRooms(dungeonData, options = {}) {
  const {
    playerCount = 4,
    bufferDistance = 8, // Buffer distance between dungeon and spawn rooms (in tiles)
    spawnRoomSize = 5, // Size of spawn rooms (in tiles)
    templates = null, // Optional room templates to use (will use default if null)
  } = options;

  // Get dungeon width, height and tree
  const { width, height, tree, layers } = dungeonData;

  // Expanded map dimensions to include spawn rooms
  const expandedWidth = width + (bufferDistance + spawnRoomSize) * 2;
  const expandedHeight = height + (bufferDistance + spawnRoomSize) * 2;

  // Offset for the original dungeon in the expanded map (center it)
  const dungeonOffsetX = Math.floor((expandedWidth - width) / 2);
  const dungeonOffsetY = Math.floor((expandedHeight - height) / 2);

  // Create spawn rooms properly within the buffer zone
  const spawnRooms = createSpawnRoomsInBufferZone(
    playerCount,
    width,
    height,
    dungeonOffsetX,
    dungeonOffsetY,
    bufferDistance,
    spawnRoomSize,
    templates
  );

  // Expand all layers to accommodate spawn rooms
  const expandedLayers = expandLayers(
    layers,
    width,
    height,
    expandedWidth,
    expandedHeight,
    dungeonOffsetX,
    dungeonOffsetY
  );

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
    spawnRooms: spawnRooms.map((room) => {
      // Get the center coordinates
      const centerX = room.roomCenter
        ? room.roomCenter.x
        : room.room && room.room.spawnPoint
        ? room.room.spawnPoint.x
        : room.x + Math.floor(room.width / 2);

      const centerY = room.roomCenter
        ? room.roomCenter.y
        : room.room && room.room.spawnPoint
        ? room.room.spawnPoint.y
        : room.y + Math.floor(room.height / 2);

      return {
        id: room.room ? room.room.id : `spawn_${room.id}`,
        x: room.x,
        y: room.y,
        width: room.width,
        height: room.height,
        center: { x: centerX, y: centerY },
      };
    }),
  };
}

/**
 * Create spawn rooms positioned within the buffer zone around the dungeon
 * Distributes rooms evenly along the top, right, bottom, and left edges
 * @param {number} count - Number of spawn rooms to create
 * @param {number} dungeonWidth - Width of the original dungeon
 * @param {number} dungeonHeight - Height of the original dungeon
 * @param {number} offsetX - X offset of the dungeon
 * @param {number} offsetY - Y offset of the dungeon
 * @param {number} bufferDistance - Distance between dungeon and spawn rooms
 * @param {number} roomSize - Size of spawn rooms
 * @param {Array} templates - Optional room templates to use
 * @returns {Array} - Array of spawn room containers
 */
function createSpawnRoomsInBufferZone(
  count,
  dungeonWidth,
  dungeonHeight,
  offsetX,
  offsetY,
  bufferDistance,
  roomSize,
  templates
) {
  const spawnRooms = [];

  // When using templates, find spawn room templates
  const spawnTemplate = templates
    ? templates.find((t) => t.type === "entrance") ||
      templates.find((t) => t.type === "heal")
    : null;

  // Size adjustment if using templates
  const roomWidth = spawnTemplate ? spawnTemplate.width : roomSize;
  const roomHeight = spawnTemplate ? spawnTemplate.height : roomSize;

  // Determine the number of rooms per side based on total count
  // We'll distribute them as evenly as possible
  const roomsPerSide = Math.max(1, Math.ceil(count / 4));
  let remainingRooms = count;

  // Calculate dungeon bounds (with offset)
  const dungeonLeft = offsetX;
  const dungeonRight = offsetX + dungeonWidth;
  const dungeonTop = offsetY;
  const dungeonBottom = offsetY + dungeonHeight;

  // Calculate the buffer zone positions - place rooms in the MIDDLE of the buffer zone
  // For top and left edges
  const topBufferY =
    dungeonTop - Math.floor(bufferDistance / 2) - Math.floor(roomHeight / 2);
  const leftBufferX =
    dungeonLeft - Math.floor(bufferDistance / 2) - Math.floor(roomWidth / 2);

  // For bottom and right edges
  const bottomBufferY =
    dungeonBottom + Math.floor(bufferDistance / 2) - Math.floor(roomHeight / 2);
  const rightBufferX =
    dungeonRight + Math.floor(bufferDistance / 2) - Math.floor(roomWidth / 2);

  console.log(
    `Buffer positions: top=${topBufferY}, right=${rightBufferX}, bottom=${bottomBufferY}, left=${leftBufferX}`
  );
  console.log(`Room dimensions: ${roomWidth}x${roomHeight}`);

  // Function to create a spawn room at specific coordinates
  const createSpawnRoom = (x, y, index) => {
    // Ensure coordinates are integers
    const roomX = Math.floor(x);
    const roomY = Math.floor(y);

    console.log(`Creating spawn room ${index} at (${roomX}, ${roomY})`);

    const container = new Container(roomX, roomY, roomWidth, roomHeight);

    // If we have a template, create a room in the container
    if (spawnTemplate) {
      container.room = new Room(roomX, roomY, `spawn_${index}`, spawnTemplate);
    } else {
      // Create a basic room
      container.room = {
        id: `spawn_${index}`,
        x: roomX,
        y: roomY,
        width: roomWidth,
        height: roomHeight,
        template: {
          id: `spawn_${index}`,
          type: "spawn",
          width: roomWidth,
          height: roomHeight,
          layers: {
            tiles: createBasicRoomLayout(roomWidth, roomHeight),
            props: createEmptyLayout(roomWidth, roomHeight),
            monsters: createEmptyLayout(roomWidth, roomHeight),
          },
        },
      };
    }

    // Add spawn point data to the center of the room
    container.room.spawnPoint = {
      x: roomX + Math.floor(roomWidth / 2),
      y: roomY + Math.floor(roomHeight / 2),
      playerId: null,
    };

    // Instead of trying to add to the container.room directly, add to container
    container.roomCenter = {
      x: roomX + Math.floor(roomWidth / 2),
      y: roomY + Math.floor(roomHeight / 2),
    };

    return container;
  };

  // Place rooms on the top edge
  if (remainingRooms > 0) {
    const topCount = Math.min(roomsPerSide, remainingRooms);
    const topSpacing = dungeonWidth / (topCount + 1);

    for (let i = 0; i < topCount; i++) {
      // Position room at equal intervals along the top buffer
      const x = dungeonLeft + topSpacing * (i + 1) - Math.floor(roomWidth / 2);
      const y = topBufferY;
      spawnRooms.push(createSpawnRoom(x, y, spawnRooms.length));
      remainingRooms--;
    }
  }

  // Place rooms on the right edge
  if (remainingRooms > 0) {
    const rightCount = Math.min(roomsPerSide, remainingRooms);
    const rightSpacing = dungeonHeight / (rightCount + 1);

    for (let i = 0; i < rightCount; i++) {
      // Position room at equal intervals along the right buffer
      const x = rightBufferX;
      const y =
        dungeonTop + rightSpacing * (i + 1) - Math.floor(roomHeight / 2);
      spawnRooms.push(createSpawnRoom(x, y, spawnRooms.length));
      remainingRooms--;
    }
  }

  // Place rooms on the bottom edge
  if (remainingRooms > 0) {
    const bottomCount = Math.min(roomsPerSide, remainingRooms);
    const bottomSpacing = dungeonWidth / (bottomCount + 1);

    for (let i = 0; i < bottomCount; i++) {
      // Position room at equal intervals along the bottom buffer
      const x =
        dungeonLeft + bottomSpacing * (i + 1) - Math.floor(roomWidth / 2);
      const y = bottomBufferY;
      spawnRooms.push(createSpawnRoom(x, y, spawnRooms.length));
      remainingRooms--;
    }
  }

  // Place rooms on the left edge
  if (remainingRooms > 0) {
    const leftCount = Math.min(roomsPerSide, remainingRooms);
    const leftSpacing = dungeonHeight / (leftCount + 1);

    for (let i = 0; i < leftCount; i++) {
      // Position room at equal intervals along the left buffer
      const x = leftBufferX;
      const y = dungeonTop + leftSpacing * (i + 1) - Math.floor(roomHeight / 2);
      spawnRooms.push(createSpawnRoom(x, y, spawnRooms.length));
      remainingRooms--;
    }
  }

  // If we still have rooms to place, add them to corners
  if (remainingRooms > 0) {
    console.log(`Still need to place ${remainingRooms} spawn rooms`);

    // Place additional rooms in the corners
    const corners = [
      { x: leftBufferX, y: topBufferY }, // Top-left
      { x: rightBufferX, y: topBufferY }, // Top-right
      { x: rightBufferX, y: bottomBufferY }, // Bottom-right
      { x: leftBufferX, y: bottomBufferY }, // Bottom-left
    ];

    for (let i = 0; i < Math.min(remainingRooms, corners.length); i++) {
      const { x, y } = corners[i];
      spawnRooms.push(createSpawnRoom(x, y, spawnRooms.length));
      remainingRooms--;
    }

    // If we STILL have rooms to place, distribute them randomly along the edges
    if (remainingRooms > 0) {
      const sides = ["top", "right", "bottom", "left"];

      for (let i = 0; i < remainingRooms; i++) {
        const side = sides[i % 4];
        let x, y;

        switch (side) {
          case "top":
            // Random position along top buffer
            x = dungeonLeft + Math.random() * (dungeonWidth - roomWidth);
            y = topBufferY;
            break;
          case "right":
            // Random position along right buffer
            x = rightBufferX;
            y = dungeonTop + Math.random() * (dungeonHeight - roomHeight);
            break;
          case "bottom":
            // Random position along bottom buffer
            x = dungeonLeft + Math.random() * (dungeonWidth - roomWidth);
            y = bottomBufferY;
            break;
          case "left":
            // Random position along left buffer
            x = leftBufferX;
            y = dungeonTop + Math.random() * (dungeonHeight - roomHeight);
            break;
        }

        spawnRooms.push(createSpawnRoom(x, y, spawnRooms.length));
      }
    }
  }

  return spawnRooms;
}

/**
 * Connect spawn rooms to the main dungeon map using corridors
 * Uses path-based corridor generation for reliable connections
 * @param {Array} spawnRooms - Spawn room containers
 * @param {TreeNode} dungeonTree - Main dungeon tree
 * @param {Array} dungeonTiles - Dungeon tiles layer
 * @returns {Array} - Array of corridors created
 */
function connectSpawnRoomsToMap(spawnRooms, dungeonTree, dungeonTiles) {
  const corridors = [];

  // Safety check - make sure dungeonTiles exists
  if (
    !dungeonTiles ||
    !Array.isArray(dungeonTiles) ||
    dungeonTiles.length === 0
  ) {
    console.error("Invalid dungeon tiles array for corridor carving");
    return corridors;
  }

  // Get all rooms from the dungeon tree
  let dungeonRooms = [];

  // Safely extract rooms from tree
  if (dungeonTree && dungeonTree.leaves) {
    dungeonRooms = dungeonTree.leaves
      .filter((container) => container && container.room !== null)
      .map((container) => container.room);
  }

  if (dungeonRooms.length === 0) {
    console.error("No dungeon rooms found to connect to spawn rooms");
    return corridors;
  }

  // Process each spawn room
  spawnRooms.forEach((spawnContainer, index) => {
    try {
      const spawnRoom = spawnContainer.room;
      if (!spawnRoom) {
        console.error(`Spawn room ${index} has no room property`);
        return;
      }

      // Find the nearest room
      let nearestRoom = null;
      let nearestDistance = Infinity;

      dungeonRooms.forEach((room) => {
        // Calculate distance between room centers
        const spawnCenterX = spawnRoom.center
          ? spawnRoom.center.x
          : spawnRoom.x + Math.floor(spawnRoom.width / 2);
        const spawnCenterY = spawnRoom.center
          ? spawnRoom.center.y
          : spawnRoom.y + Math.floor(spawnRoom.height / 2);
        const roomCenterX = room.x + Math.floor(room.width / 2);
        const roomCenterY = room.y + Math.floor(room.height / 2);

        const dx = roomCenterX - spawnCenterX;
        const dy = roomCenterY - spawnCenterY;
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

      // Use center points if available, otherwise calculate them
      let startX, startY;

      // Try to get room center from various properties to ensure compatibility
      if (spawnContainer.roomCenter) {
        startX = spawnContainer.roomCenter.x;
        startY = spawnContainer.roomCenter.y;
      } else if (spawnRoom.spawnPoint) {
        startX = spawnRoom.spawnPoint.x;
        startY = spawnRoom.spawnPoint.y;
      } else {
        startX = spawnRoom.x + Math.floor(spawnRoom.width / 2);
        startY = spawnRoom.y + Math.floor(spawnRoom.height / 2);
      }

      const endX = nearestRoom.x + Math.floor(nearestRoom.width / 2);
      const endY = nearestRoom.y + Math.floor(nearestRoom.height / 2);

      console.log(
        `Connecting spawn room ${index} from (${startX},${startY}) to (${endX},${endY})`
      );

      // Generate path between the spawn room and nearest dungeon room
      const path = generateLShapedPath(startX, startY, endX, endY);

      // Carve corridor along the path with a width of 4 tiles
      carvePathWithWidth(path, dungeonTiles, 4);

      // Store corridors reference in spawn room
      const corridor = {
        start: { x: startX, y: startY },
        end: { x: endX, y: endY },
        path: path,
      };

      spawnContainer.corridors = [corridor];
      corridors.push(corridor);

      console.log(`Created corridor from spawn ${index} to nearest room`);
    } catch (error) {
      console.error(`Error connecting spawn room ${index} to map:`, error);
    }
  });

  return corridors;
}

/**
 * Generate an L-shaped path between two points
 * @param {number} startX - Start X position
 * @param {number} startY - Start Y position
 * @param {number} endX - End X position
 * @param {number} endY - End Y position
 * @returns {Array} - Array of points on the path
 */
function generateLShapedPath(startX, startY, endX, endY) {
  const path = [];

  // Calculate distances
  const dx = endX - startX;
  const dy = endY - startY;
  const absDx = Math.abs(dx);
  const absDy = Math.abs(dy);

  // Determine whether to go horizontal or vertical first
  // If the horizontal distance is greater, go horizontal first
  const horizontalFirst = absDx > absDy;

  if (horizontalFirst) {
    // First move horizontally
    const stepX = dx > 0 ? 1 : -1;
    for (let x = startX; x !== endX; x += stepX) {
      path.push({ x, y: startY });
    }

    // Then move vertically
    const stepY = dy > 0 ? 1 : -1;
    for (let y = startY; y !== endY + stepY; y += stepY) {
      path.push({ x: endX, y });
    }
  } else {
    // First move vertically
    const stepY = dy > 0 ? 1 : -1;
    for (let y = startY; y !== endY; y += stepY) {
      path.push({ x: startX, y });
    }

    // Then move horizontally
    const stepX = dx > 0 ? 1 : -1;
    for (let x = startX; x !== endX + stepX; x += stepX) {
      path.push({ x, y: endY });
    }
  }

  return path;
}

/**
 * Carve a path with a specific width into the dungeon tiles
 * @param {Array} path - Array of path points
 * @param {Array} tiles - Tiles layer
 * @param {number} width - Width of the corridor
 */
function carvePathWithWidth(path, tiles, width) {
  // Skip if tiles or path is invalid
  if (
    !tiles ||
    !Array.isArray(tiles) ||
    tiles.length === 0 ||
    !path ||
    !path.length
  ) {
    console.error("Cannot carve path: invalid tiles or path array");
    return;
  }

  // Calculate half width (rounded down)
  const halfWidth = Math.floor(width / 2);

  // Carve tiles along the path with the specified width
  path.forEach((point) => {
    // Carve tiles in a square around the path point
    for (let y = point.y - halfWidth; y <= point.y + halfWidth; y++) {
      // Skip if y is out of bounds
      if (y < 0 || y >= tiles.length) continue;

      for (let x = point.x - halfWidth; x <= point.x + halfWidth; x++) {
        // Skip if x is out of bounds or row doesn't exist
        if (x < 0 || !tiles[y] || x >= tiles[y].length) continue;

        // Set tile to floor (0)
        tiles[y][x] = 0;
      }
    }
  });
}

// This function has been replaced by carvePathWithWidth
// Keeping the function definition empty in case it's called elsewhere
function carveCorridorIntoTiles(corridor, tiles) {
  console.log(
    "carveCorridorIntoTiles is deprecated, using carvePathWithWidth instead"
  );

  // Skip if tiles is invalid
  if (!tiles || !Array.isArray(tiles) || tiles.length === 0) return;

  // Skip if corridor is invalid
  if (
    !corridor ||
    !corridor.x ||
    !corridor.y ||
    !corridor.width ||
    !corridor.height
  )
    return;

  // Fall back to simple implementation for backward compatibility
  try {
    for (let y = corridor.y; y < corridor.y + corridor.height; y++) {
      // Skip if y is out of bounds
      if (y < 0 || y >= tiles.length) continue;

      // Make sure this row exists
      if (!Array.isArray(tiles[y])) continue;

      for (let x = corridor.x; x < corridor.x + corridor.width; x++) {
        // Skip if x is out of bounds
        if (x < 0 || x >= tiles[y].length) continue;

        // Set tile to floor (0)
        tiles[y][x] = 0;
      }
    }
  } catch (error) {
    console.error("Error in carveCorridorIntoTiles:", error);
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
  spawnRooms.forEach((spawnRoom) => {
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
function expandLayers(
  layers,
  originalWidth,
  originalHeight,
  expandedWidth,
  expandedHeight,
  offsetX,
  offsetY
) {
  const expandedLayers = {
    tiles: createExpandedLayer(
      layers.tiles,
      originalWidth,
      originalHeight,
      expandedWidth,
      expandedHeight,
      offsetX,
      offsetY,
      1
    ),
    props: createExpandedLayer(
      layers.props,
      originalWidth,
      originalHeight,
      expandedWidth,
      expandedHeight,
      offsetX,
      offsetY,
      0
    ),
    monsters: createExpandedLayer(
      layers.monsters,
      originalWidth,
      originalHeight,
      expandedWidth,
      expandedHeight,
      offsetX,
      offsetY,
      0
    ),
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
function createExpandedLayer(
  originalLayer,
  originalWidth,
  originalHeight,
  newWidth,
  newHeight,
  offsetX,
  offsetY,
  defaultValue
) {
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
  spawnRooms.forEach((container) => {
    const room = container.room;

    if (room && room.template) {
      const { x, y, width, height, template } = room;

      // Add room layout to tiles layer
      if (template.layers.tiles) {
        for (let tY = 0; tY < height; tY++) {
          for (let tX = 0; tX < width; tX++) {
            const posY = y + tY;
            const posX = x + tX;

            if (
              posY >= 0 &&
              posY < layers.tiles.length &&
              posX >= 0 &&
              posX < layers.tiles[posY].length
            ) {
              if (
                tY < template.layers.tiles.length &&
                tX < template.layers.tiles[tY].length
              ) {
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

            if (
              posY >= 0 &&
              posY < layers.props.length &&
              posX >= 0 &&
              posX < layers.props[posY].length
            ) {
              if (
                tY < template.layers.props.length &&
                tX < template.layers.props[tY].length
              ) {
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
      if (
        centerY >= 0 &&
        centerY < layers.props.length &&
        centerX >= 0 &&
        centerX < layers.props[centerY].length
      ) {
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
