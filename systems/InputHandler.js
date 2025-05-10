// server/systems/InputHandler.js

export class InputHandler {
  constructor(room) {
    this.room = room;
    this.fixedTimestep = 16.67; // 60Hz
    this.playerInputQueues = new Map(); // Map of player ID to input queue
    this.debug = false; // Enable debug logging for input processing
    this.playerProcessedSequences = new Map(); // Map of player ID to highest processed sequence
    this.collisionSystem = null; // Reference to collision system

    // Dash configuration
    this.dashDistance = 120;
    this.dashDuration = 0.15; // seconds
    this.dashCooldown = 3.0; // seconds
  }

  /**
   * Set the collision system reference
   * @param {CollisionSystem} collisionSystem - Collision system instance
   */
  setCollisionSystem(collisionSystem) {
    this.collisionSystem = collisionSystem;
  }

  registerHandlers() {
    // Handle input batch
    this.room.onMessage("playerInputBatch", (client, message) => {
      // Get player
      const player = this.room.state.players.get(client.id);
      if (!player) return;

      // Initialize tracking for this player if not exists
      if (!this.playerInputQueues.has(client.id)) {
        this.playerInputQueues.set(client.id, []);
      }

      if (!this.playerProcessedSequences.has(client.id)) {
        this.playerProcessedSequences.set(client.id, -1); // Start with -1 to process sequence 0
      }

      // Get the highest processed sequence for this player
      const highestProcessedSeq = this.playerProcessedSequences.get(client.id);

      // Get current input queue
      const inputQueue = this.playerInputQueues.get(client.id);

      if (message.inputs && Array.isArray(message.inputs)) {
        this.debug &&
          console.log(
            `Received input batch from ${client.id} with ${message.inputs.length} inputs`
          );

        // Filter out already processed inputs and track seen sequences to avoid duplicates
        const existingSequences = new Set(inputQueue.map((input) => input.seq));
        const newInputs = message.inputs.filter((input) => {
          // Only accept inputs that:
          // 1. Have a valid sequence number
          // 2. Haven't been processed already
          // 3. Aren't already in the queue
          return (
            input.seq !== undefined &&
            input.seq > highestProcessedSeq &&
            !existingSequences.has(input.seq)
          );
        });

        this.debug &&
          console.log(
            `Adding ${newInputs.length} new inputs, discarding ${
              message.inputs.length - newInputs.length
            } duplicate or processed inputs`
          );

        // Add only new, unique inputs to the queue
        newInputs.forEach((input) => {
          inputQueue.push({
            ...input,
            receivedAt: Date.now(),
          });
          // Add to seen sequences set
          existingSequences.add(input.seq);
        });

        // Find the highest sequence number in the batch
        if (newInputs.length > 0) {
          const maxSeq = Math.max(...newInputs.map((input) => input.seq || 0));

          // Update player's last input sequence
          player.lastInputSeq = Math.max(player.lastInputSeq || 0, maxSeq);
        }
      }
    });

    // Handle single input
    this.room.onMessage("playerInput", (client, message) => {
      // Get player
      const player = this.room.state.players.get(client.id);
      if (!player) return;

      // Check if this is a dash input
      if (message.type === "dash") {
        this.handleDashInput(client, message);
        return;
      }

      // Initialize tracking if not exists
      if (!this.playerInputQueues.has(client.id)) {
        this.playerInputQueues.set(client.id, []);
      }

      if (!this.playerProcessedSequences.has(client.id)) {
        this.playerProcessedSequences.set(client.id, -1);
      }

      // Get the highest processed sequence
      const highestProcessedSeq = this.playerProcessedSequences.get(client.id);

      // Only queue if this input hasn't been processed yet
      if (message.seq !== undefined && message.seq > highestProcessedSeq) {
        // Queue the input
        this.playerInputQueues.get(client.id).push({
          ...message,
          timestamp: Date.now(),
        });

        // Update player's last input sequence
        player.lastInputSeq = Math.max(
          player.lastInputSeq || 0,
          message.seq || 0
        );
      } else {
        this.debug &&
          console.log(
            `Ignoring already processed input with sequence ${message.seq} from ${client.id}`
          );
      }
    });

    // Add collision report handler
    this.room.onMessage("collisionReport", (client, message) => {
      // This can be used to validate client-reported collisions
      const player = this.room.state.players.get(client.id);
      if (!player) return;

      if (this.debug) {
        console.log(
          `Collision reported by ${client.id} at (${message.x}, ${message.y})`
        );
      }

      // Optionally validate the collision
      if (this.collisionSystem) {
        const isValid = this.collisionSystem.checkCollision(
          message.x,
          message.y
        );

        if (!isValid && this.debug) {
          console.warn(`Invalid collision report from ${client.id}`);
        }
      }
    });
  }

  /**
   * Handle dash input from client
   * @param {Client} client - Colyseus client
   * @param {Object} message - Dash input message
   */
  handleDashInput(client, message) {
    // Get player
    const player = this.room.state.players.get(client.id);
    if (!player) return;

    // Initialize dash charges if they don't exist
    if (!player.dashCharges) {
      player.dashCharges = [
        { available: true, cooldownEndTime: 0 },
        { available: true, cooldownEndTime: 0 },
      ];
    }

    // Check if dash charge is available
    if (!this.playerHasDashCharge(player)) {
      // Send charge update to client
      client.send("dashUpdate", {
        charges: player.dashCharges,
        seq: message.seq,
      });
      return;
    }

    // Normalize direction vector
    const direction = message.direction;
    const magnitude = Math.sqrt(
      direction.x * direction.x + direction.y * direction.y
    );
    if (magnitude > 0) {
      direction.x /= magnitude;
      direction.y /= magnitude;
    }

    // Calculate dash movement
    const startPos = {
      x: player.position.x,
      y: player.position.y,
    };

    // Calculate the full dash target position
    const fullDashTarget = {
      x: startPos.x + direction.x * this.dashDistance,
      y: startPos.y + direction.y * this.dashDistance,
    };

    // Find furthest valid position
    let finalPos = { ...fullDashTarget };
    let hitWall = false;

    if (this.collisionSystem) {
      // Check points along the dash path
      const steps = 10; // Number of points to check
      for (let i = 1; i <= steps; i++) {
        // Calculate position at this step
        const progress = i / steps;
        const checkX = startPos.x + direction.x * this.dashDistance * progress;
        const checkY = startPos.y + direction.y * this.dashDistance * progress;

        // Check collision at this position
        if (this.collisionSystem.checkCollision(checkX, checkY)) {
          hitWall = true;

          // Use the previous valid position
          const prevProgress = (i - 1) / steps;
          finalPos = {
            x: startPos.x + direction.x * this.dashDistance * prevProgress,
            y: startPos.y + direction.y * this.dashDistance * prevProgress,
          };

          break;
        }
      }
    }

    // Consume dash charge
    this.consumeDashCharge(player);

    // Update player position
    player.position.x = finalPos.x;
    player.position.y = finalPos.y;

    // Broadcast dash to other clients with start and end positions for smooth visualization
    this.room.broadcast(
      "playerDashed",
      {
        id: client.id,
        startX: startPos.x,
        startY: startPos.y,
        endX: finalPos.x,
        endY: finalPos.y,
        direction: direction,
        hitWall: hitWall,
        seq: message.seq, // Include input sequence number for ordering!
      },
      { except: client }
    );

    // Send acknowledgment to client
    client.send("inputAck", {
      seq: message.seq,
      x: finalPos.x,
      y: finalPos.y,
      dashCharges: player.dashCharges,
      hitWall: hitWall,
    });

    // Update processed sequence
    this.playerProcessedSequences.set(client.id, message.seq);
  }

  /**
   * Check if player has a dash charge
   * @param {Object} player - Player state object
   * @returns {boolean} - True if player has available dash charge
   */
  playerHasDashCharge(player) {
    if (!player.dashCharges) return false;

    // Check all charges to see if any are available
    for (let i = 0; i < player.dashCharges.length; i++) {
      if (player.dashCharges[i].available) {
        return true;
      }
    }
    return false;
  }

  /**
   * Consume a dash charge and start cooldown
   * @param {Object} player - Player state object
   */
  consumeDashCharge(player) {
    if (!player.dashCharges) return;

    // Find the first available charge
    for (let i = 0; i < player.dashCharges.length; i++) {
      if (player.dashCharges[i].available) {
        player.dashCharges[i].available = false;
        player.dashCharges[i].cooldownEndTime =
          Date.now() + this.dashCooldown * 1000;

        // Set timeout to restore this specific charge
        this.startChargeCooldown(player, i);

        // Exit after consuming one charge
        break;
      }
    }
  }

  /**
   * Start cooldown for a specific charge
   * @param {Object} player - Player state object
   * @param {number} chargeIndex - Index of the charge
   */
  startChargeCooldown(player, chargeIndex) {
    // Store the player ID and charge index to handle player disconnection
    const playerId = player.id;

    setTimeout(() => {
      // Check if player still exists in the room
      if (!this.room.state.players.has(playerId)) return;

      // Get the current player reference (might have changed)
      const currentPlayer = this.room.state.players.get(playerId);

      // Check if charge index is valid
      if (
        !currentPlayer.dashCharges ||
        chargeIndex >= currentPlayer.dashCharges.length
      )
        return;

      // Restore the charge
      currentPlayer.dashCharges[chargeIndex].available = true;
      currentPlayer.dashCharges[chargeIndex].cooldownEndTime = 0;

      // Notify player about restored charge
      const client = this.room.clients.find((c) => c.id === playerId);
      if (client) {
        client.send("dashChargeRestored", {
          chargeIndex: chargeIndex,
        });
      }

      console.log(`Restored dash charge ${chargeIndex} for player ${playerId}`);
    }, this.dashCooldown * 1000);
  }

  processAllInputs(deltaTime) {
    // Process inputs for each player
    for (const [clientId, inputQueue] of this.playerInputQueues.entries()) {
      // Skip if no inputs
      if (inputQueue.length === 0) continue;

      // Get player
      const player = this.room.state.players.get(clientId);
      if (!player) continue;

      // Filter out duplicate sequence numbers (keep only the most recent for each seq)
      const uniqueInputs = [];
      const processedSeqs = new Set();

      // Process in reverse order, so we get the most recent input for each sequence
      for (let i = inputQueue.length - 1; i >= 0; i--) {
        const input = inputQueue[i];
        if (!processedSeqs.has(input.seq)) {
          uniqueInputs.unshift(input); // Add to front to maintain order
          processedSeqs.add(input.seq);
        }
      }

      // Sort by sequence number
      uniqueInputs.sort((a, b) => (a.seq || 0) - (b.seq || 0));

      this.debug &&
        console.log(
          `Processing ${uniqueInputs.length} unique inputs for player ${clientId}`
        );

      // Process the unique, sorted inputs
      const processedInput = this.processPlayerInputs(
        clientId,
        player,
        uniqueInputs,
        deltaTime
      );

      // Clear processed inputs
      this.playerInputQueues.set(clientId, []);

      // Send acknowledgement to client
      if (processedInput && processedInput.seq !== undefined) {
        const client = this.room.clients.find((c) => c.id === clientId);
        if (client) {
          // Add a collided flag to the input ack
          client.send("inputAck", {
            seq: processedInput.seq,
            x: player.position.x,
            y: player.position.y,
            collided: processedInput.collided, // Add collision flag
            dashCharges: player.dashCharges, // Include dash charges in ack
          });

          // Update the highest processed sequence
          this.playerProcessedSequences.set(clientId, processedInput.seq);
        }
      }
    }
  }

  processPlayerInputs(clientId, player, inputQueue, deltaTime) {
    if (!inputQueue || inputQueue.length === 0) return null;

    let lastProcessedInput = null;
    let hasCollided = false; // Track if any collision occurred

    // Process each input
    for (const input of inputQueue) {
      // Skip if this is a dash input (handled separately)
      if (input.type === "dash") continue;

      // Calculate movement amount
      const moveAmount = (player.moveSpeed * (input.delta || deltaTime)) / 1000;

      // Calculate target position
      let targetX = player.position.x;
      let targetY = player.position.y;

      if (input.left) targetX -= moveAmount;
      if (input.right) targetX += moveAmount;
      if (input.up) targetY -= moveAmount;
      if (input.down) targetY += moveAmount; // FIXED: Changed from -= to +=

      // Apply collision detection if system is available
      if (this.collisionSystem) {
        // Check and resolve collisions
        if (this.collisionSystem.checkCollision(targetX, targetY)) {
          hasCollided = true; // Mark that a collision occurred

          const resolvedPosition = this.collisionSystem.resolveCollision(
            player.position.x,
            player.position.y,
            targetX,
            targetY
          );

          targetX = resolvedPosition.x;
          targetY = resolvedPosition.y;
        }
      }

      // Update player position
      player.position.x = targetX;
      player.position.y = targetY;

      // Apply boundary constraints
      player.position.x = Math.max(0, Math.min(player.position.x, 32768));
      player.position.y = Math.max(0, Math.min(player.position.y, 32768));

      // Keep track of last processed input
      lastProcessedInput = input;
    }

    // If player moved, broadcast to other clients
    if (lastProcessedInput) {
      player.lastMoveTime = Date.now();

      // Add collision flag to the last processed input
      lastProcessedInput.collided = hasCollided;

      // Broadcast the movement to other clients
      this.room.broadcast(
        "playerMoved",
        {
          id: player.id,
          x: player.position.x,
          y: player.position.y,
          name: player.name,
          seq: lastProcessedInput.seq,
          timestamp: Date.now(),
        },
        { except: this.room.clients.find((c) => c.id === player.id) }
      );
    }

    return lastProcessedInput;
  }
}
