export class LeaderboardSystem {
    constructor(room) {
      this.room = room;
    }
    
    updateLeaderboard() {
      // Sort players by progress
      const sortedPlayers = Object.entries(this.room.state.players)
        .sort(([, a], [, b]) => {
          // Primary sort by objectives completed
          const aObjectives = a.completedObjectives ? a.completedObjectives.length : 0;
          const bObjectives = b.completedObjectives ? b.completedObjectives.length : 0;
          const objDiff = bObjectives - aObjectives;
          
          if (objDiff !== 0) return objDiff;
          
          // Secondary sort by progress
          return (b.currentProgress || 0) - (a.currentProgress || 0);
        })
        .map(([id]) => id);
      
      // Update leaderboard in state
      this.room.state.leaderboard = sortedPlayers;
      
      // Broadcast leaderboard update
      this.room.broadcast("leaderboardUpdate", {
        leaderboard: sortedPlayers.map((id, index) => {
          const player = this.room.state.players[id];
          if (!player) {
            return {
              id: id,
              name: "Unknown",
              rank: index + 1,
              progress: 0,
              completedObjectives: []
            };
          }
          
          return {
            id: id,
            name: player.name || "Unknown",
            rank: index + 1,
            progress: player.currentProgress || 0,
            completedObjectives: player.completedObjectives || []
          };
        })
      });
    }
  }