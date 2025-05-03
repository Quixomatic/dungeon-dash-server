// server/schemas/PlayerState.js
import { Schema, ArraySchema, defineTypes } from "@colyseus/schema";
import { Position } from "./Position.js";
import { Item } from "./Item.js";
import { Ability } from "./Ability.js";
import { StatsSchema } from "./StatsSchema.js";

export class PlayerState extends Schema {
  constructor() {
    super();
    this.id = "";
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
    this.gauntletId = null;
    this.mapLoaded = false; // New flag for map loading status

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
  moveSpeed: "number", // Keep directly on PlayerState
  gauntletId: "string",
  mapLoaded: "boolean", // Define the new property type
});