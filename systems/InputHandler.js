// server/systems/InputHandler.js

export class InputHandler {
  constructor(room) {
    this.room = room;
    this.fixedTimestep = 16.67; // 60Hz
    this.playerInputQueues = new Map(); // Map of player ID to input queue
    
    // NEW: Track the highest processed sequence number for each player
    this.playerProcessedSequences = new Map(); // Map of player ID to highest processed sequence
  }
  
  registerHandlers() {
    // Handle input batch
    this.room.onMessage("playerInputBatch", (client, message) => {
      // Get player
      const player = this.room.state.players[client.id];
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
        console.log(`Received input batch from ${client.id} with ${message.inputs.length} inputs`);
        
        // Filter out already processed inputs and track seen sequences to avoid duplicates
        const existingSequences = new Set(inputQueue.map(input => input.seq));
        const newInputs = message.inputs.filter(input => {
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
        
        console.log(`Adding ${newInputs.length} new inputs, discarding ${message.inputs.length - newInputs.length} duplicate or processed inputs`);
        
        // Add only new, unique inputs to the queue
        newInputs.forEach(input => {
          inputQueue.push({
            ...input,
            receivedAt: Date.now()
          });
          // Add to seen sequences set
          existingSequences.add(input.seq);
        });
        
        // Find the highest sequence number in the batch
        if (newInputs.length > 0) {
          const maxSeq = Math.max(...newInputs.map(input => input.seq || 0));
          
          // Update player's last input sequence
          player.lastInputSeq = Math.max(player.lastInputSeq || 0, maxSeq);
        }
      }
    });
    
    // Handle single input (original handler)
    this.room.onMessage("playerInput", (client, message) => {
      // Get player
      const player = this.room.state.players[client.id];
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
          timestamp: Date.now()
        });
        
        // Update player's last input sequence
        player.lastInputSeq = Math.max(player.lastInputSeq || 0, message.seq || 0);
      } else {
        console.log(`Ignoring already processed input with sequence ${message.seq} from ${client.id}`);
      }
    });
  }
  
  processAllInputs(deltaTime) {
    // Process inputs for each player
    for (const [clientId, inputQueue] of this.playerInputQueues.entries()) {
      // Skip if no inputs
      if (inputQueue.length === 0) continue;
      
      // Get player
      const player = this.room.state.players[clientId];
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
      
      console.log(`Processing ${uniqueInputs.length} unique inputs for player ${clientId}`);
      
      // Process the unique, sorted inputs
      const processedInput = this.processPlayerInputs(clientId, player, uniqueInputs, deltaTime);
      
      // Clear processed inputs
      this.playerInputQueues.set(clientId, []);
      
      // Send acknowledgement to client
      if (processedInput && processedInput.seq !== undefined) {
        const client = this.room.clients.find(c => c.id === clientId);
        if (client) {
          client.send("inputAck", {
            seq: processedInput.seq,
            x: player.position.x,
            y: player.position.y
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
    
    console.log(`Processing ${inputQueue.length} inputs for player ${clientId}`);
    
    // Process each input
    for (const input of inputQueue) {
      //console.log(input.seq, input.delta, player.position.x, player.position.y);
      
      // Calculate movement amount
      const moveAmount = (player.moveSpeed * (input.delta || deltaTime)) / 1000;
      
      // Apply movement based on input
      if (input.left) player.position.x -= moveAmount;
      if (input.right) player.position.x += moveAmount;
      if (input.up) player.position.y -= moveAmount;
      if (input.down) player.position.y += moveAmount;
      
      // Apply boundary constraints
      player.position.x = Math.max(0, Math.min(player.position.x, 800));
      player.position.y = Math.max(0, Math.min(player.position.y, 600));

      console.log(input.seq, input.delta, moveAmount, player.position.x, player.position.y);
      
      // Keep track of last processed input
      lastProcessedInput = input;
    }
    
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