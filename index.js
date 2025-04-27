// server/index.js
import { Server } from "colyseus";
import { createServer } from "http";
import express from "express";
import { monitor } from "@colyseus/monitor";
import { NormalGameRoom } from "./rooms/NormalGameRoom.js";

const port = process.env.PORT || 2567;
const app = express();

// Create server and WebSocket server
const server = createServer(app);
const gameServer = new Server({
  server,
});

// Register room handlers
gameServer.define("normal", NormalGameRoom, {
  maxPlayers: 100,
  maxWaitTime: 30 * 1000,
  minPlayers: 2,
  metadata: {
    gameMode: "normal"
  }
});

// Register colyseus monitor
app.use("/colyseus", monitor());

// Start the server
gameServer.listen(port).then(() => {
  console.log(`🎮 Dungeon Dash Royale server running on port ${port}`);
});