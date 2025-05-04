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
    return tilemap.map((row) => {
      return [...row];
    });
  }