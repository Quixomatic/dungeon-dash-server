export class PhaseManager {
    constructor(room) {
      this.room = room;
      this.waitingForPlayersTimeout = null;
      this.gameStartCountdown = null;
      this.phaseEndTimeout = null;
      
      this.PHASES = {
        LOBBY: "lobby",
        DUNGEON: "dungeon",
        GAUNTLET: "gauntlet",
        RESULTS: "results"
      };
      
      // Game configuration
      this.gameDuration = 10 * 60 * 1000; // 10 minutes
      this.minPlayersToStart = 2;
      this.countdownDuration = 10; // seconds
      this.dungeonPhaseDuration = 5 * 60 * 1000; // 5 minutes
      this.gauntletPhaseDuration = 2 * 60 * 1000; // 2 minutes
    }
    
    setPhase(phase) {
      this.room.state.phase = phase;
      console.log(`Room ${this.room.roomId} phase set to: ${phase}`);
    }
    
    update(deltaTime) {
      // Update based on current phase
      switch (this.room.state.phase) {
        case this.PHASES.LOBBY:
          // Nothing to update in lobby phase
          break;
        case this.PHASES.DUNGEON:
          this.updateDungeonPhase(deltaTime);
          break;
        case this.PHASES.GAUNTLET:
          this.updateGauntletPhase(deltaTime);
          break;
        case this.PHASES.RESULTS:
          // Nothing to update in results phase
          break;
      }
    }
    
    waitForPlayers() {
      console.log(`Waiting for players in room ${this.room.roomId}...`);
      
      // Set timeout for room if no players join
      this.waitingForPlayersTimeout = setTimeout(() => {
        if (Object.keys(this.room.state.players).length === 0) {
          console.log(`No players joined room ${this.room.roomId}, disposing...`);
          this.room.disconnect();
        }
      }, 5 * 60 * 1000); // 5 minutes
    }
    
    checkGameStart() {
      console.log(`Checking game start conditions in room ${this.room.roomId}...`);
      console.log(`Current players: ${this.room.state.players.size}`);
    
      // Check if all players have loaded the map
      const allPlayersMapLoaded = Array.from(this.room.state.players.values())
        .every(player => player.mapLoaded);
      
      if (!allPlayersMapLoaded) {
        console.log("Waiting for all players to load the map...");
        return;
      }
    
      // If enough players AND map is loaded by all, start countdown
      if (this.room.state.players.size >= this.minPlayersToStart) {
        this.startGameCountdown();
      }
    }
    
    checkAllPlayersReady() {
      // Check if all players are ready
      const allReady = Object.values(this.room.state.players)
        .every(p => p.ready === true);
      
      // If all players are ready, start the game immediately
      if (allReady && Object.keys(this.room.state.players).length >= this.minPlayersToStart) {
        this.startGame();
      }
    }
    
    startGameCountdown() {
      // If countdown already started or game already started, return
      if (this.gameStartCountdown || this.room.state.gameStarted) return;
      
      console.log(`Starting game countdown in room ${this.room.roomId}...`);
      
      // Set initial countdown value
      this.room.state.countdown = this.countdownDuration;
      
      // Broadcast countdown started
      this.room.broadcast("countdownStarted", { 
        seconds: this.countdownDuration 
      });
      
      // Start countdown interval
      this.gameStartCountdown = setInterval(() => {
        this.room.state.countdown--;
        
        // Broadcast countdown update
        this.room.broadcast("countdownUpdate", { 
          seconds: this.room.state.countdown 
        });
        
        // If countdown reached zero, start the game
        if (this.room.state.countdown <= 0) {
          clearInterval(this.gameStartCountdown);
          this.gameStartCountdown = null;
          this.startGame();
        }
      }, 1000);
    }
    
    resetGameCountdown() {
      console.log(`Resetting game countdown in room ${this.room.roomId}...`);
      
      // Clear countdown interval
      if (this.gameStartCountdown) {
        clearInterval(this.gameStartCountdown);
        this.gameStartCountdown = null;
      }
      
      // Reset countdown value
      this.room.state.countdown = 0;
      
      // Broadcast countdown cancelled
      this.room.broadcast("countdownCancelled", {
        reason: "Not enough players"
      });
    }
    
    startGame() {
      console.log(`Starting game in room ${this.room.roomId}...`);
      
      // Clear any pending timeouts/intervals
      if (this.waitingForPlayersTimeout) clearTimeout(this.waitingForPlayersTimeout);
      if (this.gameStartCountdown) clearInterval(this.gameStartCountdown);
      
      // Set game state
      this.room.state.gameStarted = true;
      this.room.state.gameEnded = false;
      this.room.state.timeRemaining = this.gameDuration;
      
      // Start first dungeon phase
      this.startDungeonPhase();
      
      // Set game end timeout
      this.room.clock.setTimeout(() => {
        this.endGame("timeUp");
      }, this.gameDuration);
      
      // Update time remaining every second
      this.room.clock.setInterval(() => {
        this.room.state.timeRemaining -= 1000;
        
        // Every 30 seconds, update leaderboard
        if (this.room.state.timeRemaining % 30000 === 0) {
          this.room.leaderboardSystem.updateLeaderboard();
        }
        
        // Every 60 seconds, trigger a global event
        if (this.room.state.timeRemaining % 60000 === 0) {
          this.room.eventManager.triggerGlobalEvent();
        }
      }, 1000);
    }
    
    startDungeonPhase() {
      console.log(`Starting dungeon phase in room ${this.room.roomId}`);
      
      // Set phase
      this.setPhase(this.PHASES.DUNGEON);
      this.room.state.phaseEndTime = Date.now() + this.dungeonPhaseDuration;
      
      // Generate dungeons for players using MapManager instead of the old DungeonGenerator
      if (this.room.mapManager) {
        // If this is the first dungeon phase, the map is already generated
        // For subsequent phases, generate a new floor
        if (this.room.mapManager.floorLevel > 1 || !this.room.mapManager.currentMap) {
          this.room.mapManager.generateNextFloor();
        }
      } else {
        console.error("MapManager not available!");
      }
      
      // Broadcast phase change
      this.room.broadcast("phaseChange", {
        phase: this.room.state.phase,
        duration: this.dungeonPhaseDuration,
        endTime: this.room.state.phaseEndTime
      });
      
      // Schedule gauntlet phase
      this.phaseEndTimeout = this.room.clock.setTimeout(() => {
        this.startGauntletPhase();
      }, this.dungeonPhaseDuration);
    }
    
    startGauntletPhase() {
      console.log(`Starting gauntlet phase in room ${this.room.roomId}`);
      
      // Set phase
      this.setPhase(this.PHASES.GAUNTLET);
      this.room.state.phaseEndTime = Date.now() + this.gauntletPhaseDuration;
      
      // Create gauntlet groups
      const gauntlets = this.createGauntlets();
      
      // Broadcast phase change
      this.room.broadcast("phaseChange", {
        phase: this.room.state.phase,
        duration: this.gauntletPhaseDuration,
        endTime: this.room.state.phaseEndTime,
        gauntletsCount: gauntlets.length
      });
      
      // Schedule next phase
      this.phaseEndTimeout = this.room.clock.setTimeout(() => {
        this.resolveGauntlets();
        
        // If only one player remains, end the game
        const alivePlayers = Object.values(this.room.state.players)
          .filter(player => player.isAlive);
        
        if (alivePlayers.length <= 1) {
          this.endGame(alivePlayers.length === 1 ? "winner" : "timeUp");
        } else {
          this.startDungeonPhase();
        }
      }, this.gauntletPhaseDuration);
    }
    
    updateDungeonPhase(deltaTime) {
      // Implement dungeon phase specific updates
    }
    
    updateGauntletPhase(deltaTime) {
      // Implement gauntlet phase specific updates
    }
    
    createGauntlets() {
      const alivePlayers = Object.entries(this.room.state.players)
        .filter(([_, player]) => player.isAlive)
        .map(([id, _]) => id);
      
      // Shuffle players for random grouping
      this.shuffleArray(alivePlayers);
      
      // Group into gauntlets of 4-5 players
      const gauntlets = [];
      const gauntletSize = alivePlayers.length <= 10 ? 2 : 
                          alivePlayers.length <= 20 ? 3 : 
                          alivePlayers.length <= 50 ? 4 : 5;
      
      for (let i = 0; i < alivePlayers.length; i += gauntletSize) {
        const gauntlet = alivePlayers.slice(i, i + gauntletSize);
        if (gauntlet.length >= 2) { // Need at least 2 players for a gauntlet
          gauntlets.push(gauntlet);
        } else if (gauntlets.length > 0) {
          // Add remaining players to the last gauntlet
          gauntlets[gauntlets.length - 1].push(...gauntlet);
        }
      }
      
      // Broadcast gauntlet assignments
      gauntlets.forEach((gauntlet, index) => {
        const gauntletId = `gauntlet_${index}`;
        
        // Inform players of their gauntlet assignments
        gauntlet.forEach(playerId => {
          // Make sure player exists
          if (this.room.state.players[playerId]) {
            // Assign gauntlet ID to player
            this.room.state.players[playerId].gauntletId = gauntletId;
            
            // Send message to player
            const client = this.room.clients.find(c => c.id === playerId);
            if (client) {
              client.send("gauntletAssigned", {
                gauntletId,
                players: gauntlet.map(id => ({
                  id,
                  name: this.room.state.players[id].name,
                  level: this.room.state.players[id].level
                }))
              });
            }
          }
        });
      });
      
      return gauntlets;
    }
    
    resolveGauntlets() {
      // Get all gauntlets by looking at player.gauntletId
      const gauntlets = new Map();
      
      for (const playerId in this.room.state.players) {
        const player = this.room.state.players[playerId];
        if (player.gauntletId && player.isAlive) {
          if (!gauntlets.has(player.gauntletId)) {
            gauntlets.set(player.gauntletId, []);
          }
          gauntlets.get(player.gauntletId).push(playerId);
        }
      }
      
      // For each gauntlet, determine a winner randomly
      for (const [gauntletId, players] of gauntlets.entries()) {
        if (players.length > 1) {
          // Pick random winner
          const winnerIndex = Math.floor(Math.random() * players.length);
          const winnerId = players[winnerIndex];
          
          // Mark other players as eliminated
          players.forEach(playerId => {
            if (playerId !== winnerId) {
              this.room.state.players[playerId].isAlive = false;
              
              // Notify player of elimination
              const client = this.room.clients.find(c => c.id === playerId);
              if (client) {
                client.send("eliminated", {
                  gauntletId,
                  winnerId,
                  winnerName: this.room.state.players[winnerId].name
                });
              }
            }
          });
          
          // Notify winner
          const winnerClient = this.room.clients.find(c => c.id === winnerId);
          if (winnerClient) {
            winnerClient.send("gauntletVictory", {
              gauntletId,
              eliminatedPlayers: players.filter(id => id !== winnerId).map(id => ({
                id,
                name: this.room.state.players[id].name
              }))
            });
          }
          
          // Broadcast gauntlet result
          this.room.broadcast("gauntletResult", {
            gauntletId,
            winnerId,
            winnerName: this.room.state.players[winnerId].name,
            players: players.length
          });
        }
      }
      
      // Clear gauntlet assignments
      for (const playerId in this.room.state.players) {
        this.room.state.players[playerId].gauntletId = null;
      }
    }
    
    endGame(reason = "normal") {
      console.log(`Ending game in room ${this.room.roomId}. Reason: ${reason}`);
      
      // Set game state
      this.room.state.gameStarted = false;
      this.room.state.gameEnded = true;
      this.setPhase(this.PHASES.RESULTS);
      
      // Determine winner
      this.room.leaderboardSystem.updateLeaderboard();
      this.room.state.winner = this.room.state.leaderboard[0] || null;
      
      // Broadcast game ended
      this.room.broadcast("gameEnded", {
        reason: reason,
        winner: this.room.state.winner ? {
          id: this.room.state.winner,
          name: this.room.state.players[this.room.state.winner]?.name || "Unknown"
        } : null,
        leaderboard: this.room.state.leaderboard.map(id => {
          const player = this.room.state.players[id];
          if (!player) {
            return {
              id: id,
              name: "Unknown",
              progress: 0,
              completedObjectives: []
            };
          }
          
          return {
            id: id,
            name: player.name || "Unknown",
            progress: player.currentProgress || 0,
            completedObjectives: player.completedObjectives || []
          };
        })
      });
      
      // Lock the room to prevent new players from joining
      this.room.lock();
      
      // Close room after results are shown
      this.room.clock.setTimeout(() => {
        this.room.disconnect();
      }, 30 * 1000); // 30 seconds
    }
    
    handlePlayerLeave() {
      // If not enough players and game hasn't started, reset countdown
      if (Object.keys(this.room.state.players).length < this.minPlayersToStart && !this.room.state.gameStarted) {
        this.resetGameCountdown();
      }
      
      // If game is in progress and all players left, end the game
      if (this.room.state.gameStarted && Object.keys(this.room.state.players).length === 0) {
        this.endGame();
      }
    }
    
    // Helper methods
    shuffleArray(array) {
      for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
      }
      return array;
    }
  }