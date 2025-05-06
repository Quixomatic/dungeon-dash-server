// server/systems/InputHandler.js

export class InputHandler {
  constructor(room) {
    this.room = room;
    this.fixedTimestep = 16.67; // 60Hz
    this.playerInputQueues = new Map(); // Map of player ID to input queue
    this.debug = false; // Enable debug logging for input processing
    this.playerProcessedSequences = new Map(); // Map of player ID to highest processed sequence
    this.collisionSystem = null; // Reference to collision system
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

    // Handle single input (original handler)
    this.room.onMessage("playerInput", (client, message) => {
      // Get player
      const player = this.room.state.players.get(client.id);
      if (!player) return;

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
      player.position.x = Math.max(0, Math.min(player.position.x, 20000));
      player.position.y = Math.max(0, Math.min(player.position.y, 20000));

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
