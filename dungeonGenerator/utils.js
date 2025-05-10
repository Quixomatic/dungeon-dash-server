// server/dungeonGenerator/utils.js

/**
 * Create an empty tilemap of specified size
 * @param {number} width - Width of the tilemap
 * @param {number} height - Height of the tilemap
 * @param {number} value - Default value for all tiles
 * @returns {Array} - 2D array representing the tilemap
 */
export function createTilemap(width, height, value) {
  const tilemap = [];

  for (let y = 0; y < height; y++) {
    tilemap[y] = [];
    for (let x = 0; x < width; x++) {
      tilemap[y][x] = value;
    }
  }

  return tilemap;
}

/**
 * Resize a tilemap to new dimensions
 * @param {Array} tilemap - Original tilemap
 * @param {number} width - New width
 * @param {number} height - New height
 * @returns {Array} - Resized tilemap
 */
export function resizeTileMap(tilemap, width, height) {
  const result = [];

  for (let y = 0; y < height; y++) {
    result[y] = [];
    for (let x = 0; x < width; x++) {
      let value = 0;

      if (y < tilemap.length && x < tilemap[y].length) {
        value = tilemap[y][x];
      }

      result[y][x] = value;
    }
  }

  return result;
}

/**
 * Shuffle an array's entries into a new one
 * @param {Array} array - Original array
 * @returns {Array} - Shuffled array
 */
export function shuffleArray(array) {
  const newArray = [...array];

  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }

  return newArray;
}

/**
 * Generate a random number between min and max
 * @param {number} min - Minimum value
 * @param {number} max - Maximum value
 * @returns {number} - Random number
 */
export function random(min, max) {
  return Math.floor(Math.random() * (max - min + 1) + min);
}

/**
 * Return one of the values matching the randomly selected weight
 * @param {Array} weights - Array of weights
 * @param {Array} values - Array of values
 * @returns {any} - Selected value
 */
export function randomWeights(weights, values) {
  const num = Math.random();
  let s = 0;
  let lastIndex = weights.length - 1;

  for (var i = 0; i < lastIndex; ++i) {
    s += weights[i];
    if (num < s) {
      return values[i];
    }
  }

  return values[lastIndex];
}

/**
 * Return one of the values randomly
 * @param {Array} values - Array of values
 * @returns {any} - Selected value
 */
export function randomChoice(values) {
  return values[Math.floor(Math.random() * values.length)];
}

/**
 * Return true if probability is matched
 * @param {number} probability - Probability (0-1)
 * @returns {boolean} - True if matched
 */
export function randomProbability(probability) {
  return Math.random() > 1 - probability;
}

/**
 * Create and return a deep copy of a tilemap
 * @param {Array} tilemap - Original tilemap
 * @returns {Array} - Deep copy of tilemap
 */
export function duplicateTilemap(tilemap) {
  if (!tilemap || !Array.isArray(tilemap) || tilemap.length === 0) {
    console.warn("Invalid tilemap passed to duplicateTilemap", tilemap);
    return createEmptyTilemap(100, 100); // Fallback to a safe default
  }

  const height = tilemap.length;
  const width = Math.max(...tilemap.map((row) => (row ? row.length : 0)));

  // Ensure we create a proper 2D array with all rows and columns initialized
  const result = [];
  for (let y = 0; y < height; y++) {
    result[y] = [];
    for (let x = 0; x < width; x++) {
      if (tilemap[y] && typeof tilemap[y][x] !== "undefined") {
        result[y][x] = tilemap[y][x];
      } else {
        result[y][x] = 0; // Default value for missing elements
      }
    }
  }

  return result;
}

export function createEmptyTilemap(width, height, defaultValue = 0) {
  const tilemap = [];
  for (let y = 0; y < height; y++) {
    tilemap[y] = [];
    for (let x = 0; x < width; x++) {
      tilemap[y][x] = defaultValue;
    }
  }
  return tilemap;
}

/**
 * Safely set a value in a 2D array, ensuring all indices exist
 * @param {Array} array - 2D array to modify
 * @param {number} y - Y coordinate
 * @param {number} x - X coordinate
 * @param {any} value - Value to set
 * @returns {boolean} - True if set successfully
 */
export function safeSet2DArrayValue(array, y, x, value) {
  if (!array) return false;

  // Ensure array[y] exists
  if (y >= 0 && y < array.length) {
    if (!array[y]) {
      array[y] = [];
    }

    // Ensure array[y][x] can be set
    if ((x >= 0 && x < array[y].length) || x >= array[y].length) {
      array[y][x] = value;
      return true;
    }
  }

  return false;
}

/**
 * Safely get a value from a 2D array
 * @param {Array} array - 2D array to read from
 * @param {number} y - Y coordinate
 * @param {number} x - X coordinate
 * @param {any} defaultValue - Default value if position doesn't exist
 * @returns {any} - Value at position or default
 */
export function safeGet2DArrayValue(array, y, x, defaultValue = 0) {
  if (!array) return defaultValue;

  if (y >= 0 && y < array.length && array[y] && x >= 0 && x < array[y].length) {
    return array[y][x];
  }

  return defaultValue;
}
