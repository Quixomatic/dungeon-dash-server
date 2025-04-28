import { Room } from "colyseus";

export class BaseRoom extends Room {
  constructor() {
    super();
    this.fixedTimeStep = 16.67; // 60Hz
    this.patchRate = 16.67;     // 60Hz state updates
  }

  onCreate(options) {
    // Base setup - subclasses should call super.onCreate()
    console.log(`Room created: ${this.roomId}`);
    
    // Set up fixed simulation interval
    this.setSimulationInterval((deltaTime) => this.fixedUpdate(deltaTime), this.fixedTimeStep);
  }

  onJoin(client, options) {
    console.log(`Client ${client.id} joined room ${this.roomId}`);
  }

  onLeave(client, consented) {
    console.log(`Client ${client.id} left room ${this.roomId}`);
  }

  onDispose() {
    console.log(`Room ${this.roomId} disposing`);
  }

  fixedUpdate(deltaTime) {
    // To be implemented by subclasses
  }
}