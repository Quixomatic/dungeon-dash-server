// server/schemas/PlayerState.js
import { Schema, type, ArraySchema, defineTypes } from "@colyseus/schema";
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
      down: false,
    };
  }
}

defineTypes(PlayerState, {
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
  gauntletId: "string",
});
