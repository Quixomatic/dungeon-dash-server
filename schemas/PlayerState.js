// server/schemas/PlayerState.js
import { Schema, type, ArraySchema } from "@colyseus/schema";
import { Position } from "./Position.js";
import { Item } from "./Item.js";
import { Ability } from "./Ability.js";

export class PlayerState extends Schema {
  constructor() {
    super();
    this.id = "";
    this.name = "";
    this.ready = false;
    this.position = new Position();
    this.health = 100;
    this.maxHealth = 100;
    this.level = 1;
    this.items = new ArraySchema();
    this.abilities = new ArraySchema();
    this.currentProgress = 0;
    this.isAlive = true;
    this.completedObjectives = new ArraySchema();
    this.joinTime = Date.now();
    this.lastMoveTime = 0;
    this.moveSpeed = 300; // units per second
    this.gauntletId = null;
    
    // These are not synchronized - server side only
    this._inputQueue = [];
    this._currentInput = {
      left: false,
      right: false,
      up: false,
      down: false
    };
  }
  
  // Method to add input to the queue
  addInput(input) {
    this._inputQueue.push({
      ...input,
      timestamp: Date.now()
    });
  }
  
  // Method to clear the input queue
  clearInputQueue() {
    this._inputQueue = [];
  }
  
  // Method to process inputs
  processInputs(deltaTime) {
    if (this._inputQueue.length === 0) return false;
    
    let moved = false;
    const speedPerMs = this.moveSpeed / 1000; // Convert units/second to units/ms
    
    // Process all inputs in the queue
    this._inputQueue.forEach(input => {
      // Apply movement based on input
      if (input.left) {
        this.position.x -= speedPerMs * deltaTime;
        moved = true;
      } else if (input.right) {
        this.position.x += speedPerMs * deltaTime;
        moved = true;
      }
      
      if (input.up) {
        this.position.y -= speedPerMs * deltaTime;
        moved = true;
      } else if (input.down) {
        this.position.y += speedPerMs * deltaTime;
        moved = true;
      }
    });
    
    // Apply boundary constraints
    this.position.x = Math.max(0, Math.min(this.position.x, 800));
    this.position.y = Math.max(0, Math.min(this.position.y, 600));
    
    // Store the most recent input as current
    if (this._inputQueue.length > 0) {
      const latestInput = this._inputQueue[this._inputQueue.length - 1];
      this._currentInput = {
        left: latestInput.left,
        right: latestInput.right,
        up: latestInput.up,
        down: latestInput.down
      };
    }
    
    // Clear the queue after processing
    this.clearInputQueue();
    
    return moved;
  }
}

type(PlayerState, {
  id: "string",
  name: "string",
  ready: "boolean",
  position: Position,
  health: "number",
  maxHealth: "number",
  level: "number",
  items: [Item],
  abilities: [Ability],
  currentProgress: "number",
  isAlive: "boolean",
  completedObjectives: ["string"],
  joinTime: "number",
  lastMoveTime: "number",
  moveSpeed: "number",
  gauntletId: "string"
});