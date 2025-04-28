export class InputHandler {
    constructor(room) {
      this.room = room;
    }
    
    registerHandlers() {
      // Register player input handler
      this.room.onMessage("playerInput", (client, inputData) => {
        const player = this.room.state.players[client.id];
        if (!player) return;
        
        // Add sequence number for reconciliation
        const input = {
          ...inputData,
          timestamp: Date.now(),
          seq: inputData.seq || 0
        };
        
        // Add to player's input queue
        player.inputQueue.push(input);
        
        // Store last input sequence
        if (input.seq > player.lastInputSeq) {
          player.lastInputSeq = input.seq;
        }
      });
      
      // Player ready handler
      this.room.onMessage("ready", (client, message) => {
        const player = this.room.state.players[client.id];
        if (!player) return;
        
        player.ready = true;
        
        // Check if all players are ready
        this.room.phaseManager.checkAllPlayersReady();
      });
      
      // Chat message handler
      this.room.onMessage("chat", (client, message) => {
        const player = this.room.state.players[client.id];
        if (!player) return;
        
        // Broadcast chat message to all clients
        this.room.broadcast("chatMessage", {
          senderId: client.id,
          senderName: player.name,
          message: message.text.substring(0, 200) // Limit message length
        });
      });
    }
    
    processAllInputs(deltaTime) {
      for (const id in this.room.state.players) {
        const player = this.room.state.players[id];
        
        // Skip players without inputs
        if (!player.inputQueue || player.inputQueue.length === 0) continue;
        
        // Process all inputs in the queue
        this.processPlayerInputs(player, deltaTime);
        
        // Send input acknowledgement to client
        const client = this.room.clients.find(c => c.id === id);
        if (client) {
          client.send("inputAck", {
            seq: player.lastInputSeq,
            position: {
              x: player.position.x,
              y: player.position.y
            }
          });
        }
      }
    }
    
    processPlayerInputs(player, deltaTime) {
      if (!player.inputQueue || player.inputQueue.length === 0) return false;
      
      let moved = false;
      const speedPerMs = player.moveSpeed / 1000; // Convert units/second to ms
      const moveDist = speedPerMs * deltaTime;
      
      // Process all queued inputs
      player.inputQueue.forEach(input => {
        // Apply movement based on input
        if (input.left) {
          player.position.x -= moveDist;
          moved = true;
        } else if (input.right) {
          player.position.x += moveDist;
          moved = true;
        }
        
        if (input.up) {
          player.position.y -= moveDist;
          moved = true;
        } else if (input.down) {
          player.position.y += moveDist;
          moved = true;
        }
      });
      
      // Apply boundary constraints
      player.position.x = Math.max(0, Math.min(player.position.x, 800));
      player.position.y = Math.max(0, Math.min(player.position.y, 600));
      
      // Clear the queue after processing
      player.inputQueue = [];
      
      // If player moved, broadcast it for immediate feedback
      if (moved) {
        player.lastMoveTime = Date.now();
        
        // Broadcast movement to all clients
        this.room.broadcast("playerMoved", {
          id: player.id,
          x: player.position.x,
          y: player.position.y,
          seq: player.lastInputSeq
        });
      }
      
      return moved;
    }
  }