// server/schemas/GameRoomState.js
import { Schema, type, MapSchema, ArraySchema } from "@colyseus/schema";
import { PlayerState } from "./PlayerState.js";

export class GameRoomState extends Schema {
  constructor() {
    super();
    // Map of all players by client ID
    this.players = new MapSchema();
    // Game state
    this.gameStarted = false;
    this.gameEnded = false;
    this.timeRemaining = 0;
    this.countdown = 0;
    this.winner = null;
    this.leaderboard = new ArraySchema();
    this.globalEvents = new ArraySchema();
    this.phase = "lobby"; // Current game phase: lobby, dungeon, gauntlet, results
    this.phaseEndTime = 0; // Timestamp when current phase ends
  }
}

type(GameRoomState, {
  players: { map: PlayerState },
  gameStarted: "boolean",
  gameEnded: "boolean",
  timeRemaining: "number",
  countdown: "number",
  winner: "string",
  leaderboard: ["string"],
  globalEvents: ["string"],
  phase: "string",
  phaseEndTime: "number"
});