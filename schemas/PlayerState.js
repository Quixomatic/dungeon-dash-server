// server/schemas/PlayerState.js
import { Schema, ArraySchema, defineTypes } from "@colyseus/schema";
import { Position } from "./Position.js";
import { Item } from "./Item.js";
import { Ability } from "./Ability.js";
import { StatsSchema } from "./StatsSchema.js";

// Create a simple schema for dash charges
class DashCharge extends Schema {
  constructor() {
    super();
    this.available = true;
    this.cooldownEndTime = 0;
  }
}
defineTypes(DashCharge, {
  available: "boolean",
  cooldownEndTime: "number"
});

export class PlayerState extends Schema {
  constructor() {
    super();
    this.id = "";
    this.userId = ""; // Add user ID for persistence
    this.name = "";
    this.ready = false;
    this.position = new Position();
    this.stats = new StatsSchema(); // Nested schema for most stats
    this.items = new ArraySchema();
    this.abilities = new ArraySchema();
    this.currentProgress = 0;
    this.isAlive = true;
    this.completedObjectives = new ArraySchema();
    this.joinTime = Date.now();
    this.lastMoveTime = 0;
    this.moveSpeed = 300; // Keep moveSpeed directly on PlayerState
    this.gauntletId = null; // We'll keep this property but not track it in the schema
    this.mapLoaded = false; // New flag for map loading status
    
    // Dash properties - use the proper DashCharge schema
    this.dashCharges = new ArraySchema();
    
    // Initialize with one dash charge
    this.dashCharges.push(new DashCharge());
    this.dashCharges.push(new DashCharge());

    // These are not synchronized - server side only
    this._inputQueue = [];
    this._currentInput = {
      left: false,
      right: false,
      up: false,
      down: false,
    };
  }
}

defineTypes(PlayerState, {
  id: "string",
  userId: "string",
  name: "string",
  ready: "boolean",
  position: Position,
  stats: StatsSchema,
  items: [Item],
  abilities: [Ability],
  currentProgress: "number",
  isAlive: "boolean",
  completedObjectives: ["string"],
  joinTime: "number",
  lastMoveTime: "number",
  moveSpeed: "number",
  mapLoaded: "boolean",
  dashCharges: [DashCharge], // Use the DashCharge schema as the type
  // gauntletId is removed from the schema but still exists as a property
});