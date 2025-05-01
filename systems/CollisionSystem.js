export class CollisionSystem {
    constructor(room) {
      this.room = room;
    }
    
    update(deltaTime) {
      // During dungeon phase, check player-object collisions
      if (this.room.state.phase === this.room.phaseManager.PHASES.DUNGEON) {
        this.checkPlayerObjectCollisions();
      }
      
      // During gauntlet phase, check player-player collisions
      if (this.room.state.phase === this.room.phaseManager.PHASES.GAUNTLET) {
        this.checkPlayerPlayerCollisions();
      }
    }
    
    checkPlayerObjectCollisions() {
      // To be implemented with dungeon objects
    }
    
    checkPlayerPlayerCollisions() {
      return;
      // For simple collision detection between players
      const players = Object.values(this.room.state.players);
      
      for (let i = 0; i < players.length; i++) {
        const player1 = players[i];
        
        for (let j = i + 1; j < players.length; j++) {
          const player2 = players[j];
          
          // Skip players in different gauntlets
          if (player1.gauntletId !== player2.gauntletId) continue;
          
          // Simple circle collision
          const dx = player1.position.x - player2.position.x;
          const dy = player1.position.y - player2.position.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          
          // If colliding, push players apart
          const playerRadius = 20; // Adjust based on your sprite size
          if (distance < playerRadius * 2) {
            // Calculate push direction
            const pushX = dx / distance;
            const pushY = dy / distance;
            
            // Push distance
            const pushDistance = playerRadius * 2 - distance;
            
            // Apply push
            player1.position.x += pushX * pushDistance / 2;
            player1.position.y += pushY * pushDistance / 2;
            player2.position.x -= pushX * pushDistance / 2;
            player2.position.y -= pushY * pushDistance / 2;
          }
        }
      }
    }
  }