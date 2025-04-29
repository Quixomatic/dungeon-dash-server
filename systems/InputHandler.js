// server/systems/InputHandler.js

export class InputHandler {
  constructor(room) {
    this.room = room;
    this.fixedTimestep = 16.67; // 60Hz
    this.playerInputQueues = new Map(); // Map of player ID to input queue
  }
  
  /**
   * Register input message handlers
   */
  registerHandlers() {
    // Handle player input
    this.room.onMessage("playerInput", (client, message) => {
      // Get player
      const player = this.room.state.players[client.id];
      if (!player) return;
      
      // Add to player's input queue
      if (!this.playerInputQueues.has(client.id)) {
        this.playerInputQueues.set(client.id, []);
      }
      
      // Queue the input
      this.playerInputQueues.get(client.id).push({
        ...message,
        timestamp: Date.now()
      });
      
      // Update player's last input sequence
      player.lastInputSeq = Math.max(player.lastInputSeq || 0, message.seq || 0);
    });
  }
  
  /**
   * Process all player inputs (called on fixed update)
   * @param {number} deltaTime - Time since last update in ms
   */
  processAllInputs(deltaTime) {
    // Process inputs for each player
    for (const [clientId, inputQueue] of this.playerInputQueues.entries()) {
      // Skip if no inputs
      if (inputQueue.length === 0) continue;
      
      // Get player
      const player = this.room.state.players[clientId];
      if (!player) continue;
      
      // Process all queued inputs
      const processedInput = this.processPlayerInputs(player, inputQueue, deltaTime);
      
      // Send acknowledgement to client
      if (processedInput) {
        const client = this.room.clients.find(c => c.id === clientId);
        if (client) {
          client.send("inputAck", {
            seq: processedInput.seq,
            x: player.position.x,
            y: player.position.y
          });
        }
      }
      
      // Clear processed inputs
      this.playerInputQueues.set(clientId, []);
    }
  }
  
  /**
   * Process inputs for a specific player
   * @param {Object} player - Player state
   * @param {Array} inputQueue - Queue of input commands
   * @param {number} deltaTime - Time since last update in ms
   * @returns {Object} - Last processed input
   */
  processPlayerInputs(player, inputQueue, deltaTime) {
    if (!inputQueue || inputQueue.length === 0) return null;
    
    let lastProcessedInput = null;
    
    // Speed calculation
    const speedPerMs = player.moveSpeed / 1000; // Convert units/second to ms
    
    // Process all inputs
    for (const input of inputQueue) {
      // Apply movement based on input
      if (input.left) {
        player.position.x -= speedPerMs * deltaTime;
      } else if (input.right) {
        player.position.x += speedPerMs * deltaTime;
      }
      
      if (input.up) {
        player.position.y -= speedPerMs * deltaTime;
      } else if (input.down) {
        player.position.y += speedPerMs * deltaTime;
      }
      
      // Keep track of last processed input
      lastProcessedInput = input;
    }
    
    // Apply boundary constraints
    player.position.x = Math.max(0, Math.min(player.position.x, 800));
    player.position.y = Math.max(0, Math.min(player.position.y, 600));
    
    // If player moved, broadcast to other clients
    if (lastProcessedInput) {
      player.lastMoveTime = Date.now();
      
      this.room.broadcast("playerMoved", {
        id: player.id,
        x: player.position.x,
        y: player.position.y,
        name: player.name,
        seq: lastProcessedInput.seq,
        timestamp: Date.now()
      }, { except: this.room.clients.find(c => c.id === player.id) });
    }
    
    return lastProcessedInput;
  }
}