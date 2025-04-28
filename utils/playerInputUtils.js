// server/utils/playerInputUtils.js

/**
 * Process player movement inputs
 * @param {Object} player - Player state object
 * @param {number} deltaTime - Time since last update in ms
 * @returns {boolean} - True if player moved
 */
export function processPlayerInputs(player, deltaTime) {
  if (!player._inputQueue || player._inputQueue.length === 0) return false;

  let moved = false;
  const speedPerMs = player.moveSpeed / 1000; // Convert units/second to ms

  // Process all queued inputs
  player._inputQueue.forEach((input) => {
    // Apply movement based on input
    if (input.left) {
      player.position.x -= speedPerMs * deltaTime;
      moved = true;
    } else if (input.right) {
      player.position.x += speedPerMs * deltaTime;
      moved = true;
    }

    if (input.up) {
      player.position.y -= speedPerMs * deltaTime;
      moved = true;
    } else if (input.down) {
      player.position.y += speedPerMs * deltaTime;
      moved = true;
    }

    // Save the last input state
    player._currentInput = {
      left: input.left || false,
      right: input.right || false,
      up: input.up || false,
      down: input.down || false,
    };
  });

  // Apply boundary constraints
  player.position.x = Math.max(0, Math.min(player.position.x, 800));
  player.position.y = Math.max(0, Math.min(player.position.y, 600));

  // Clear the queue after processing all inputs
  player._inputQueue = [];

  return moved;
}

/**
 * Add input to player's queue
 * @param {Object} player - Player state object
 * @param {Object} input - Input state
 */
export function addPlayerInput(player, input) {
  if (!player._inputQueue) player._inputQueue = [];

  // Queue the input with timestamp
  player._inputQueue.push({
    ...input,
    timestamp: Date.now(),
  });
}

/**
 * Clear player's input queue
 * @param {Object} player - Player state object
 */
export function clearInputQueue(player) {
  if (!player._inputQueue) player._inputQueue = [];
  player._inputQueue = [];
}
