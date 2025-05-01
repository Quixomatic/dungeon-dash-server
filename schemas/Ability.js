// server/schemas/Ability.js
import { Schema, defineTypes, type } from "@colyseus/schema";

export class Ability extends Schema {
  constructor() {
    super();
    this.id = "";
    this.name = "";
    this.cooldown = 0;
    this.effect = "";
  }
}

defineTypes(Ability, {
  id: "string",
  name: "string",
  cooldown: "number",
  effect: "string"
});