// server/schemas/StatsSchema.js
import { Schema, defineTypes } from "@colyseus/schema";

export class StatsSchema extends Schema {
  constructor() {
    super();
    this.health = 100;
    this.maxHealth = 100;
    this.level = 1;
    this.experience = 0;
    this.damage = 10;
    this.defense = 5;
    this.critChance = 0.05; // 5% base crit chance
    this.critMultiplier = 1.5; // 150% damage on crit
  }
}

defineTypes(StatsSchema, {
  health: "number",
  maxHealth: "number",
  level: "number",
  experience: "number",
  damage: "number",
  defense: "number",
  critChance: "number",
  critMultiplier: "number"
});