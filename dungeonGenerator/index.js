// server/dungeonGenerator/index.js

import { generate, createTree, computeTilesMask } from './dungeon.js';
import * as types from './types.js';
import * as utils from './utils.js';

export default {
  generate,
  createTree,
  computeTilesMask,
  ...types,
  ...utils
};

export * from './types.js';
export * from './utils.js';
export { generate, createTree, computeTilesMask } from './dungeon.js';