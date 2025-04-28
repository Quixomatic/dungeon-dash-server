// server/schemas/Ability.js
import { Schema, type } from "@colyseus/schema";

export class Ability extends Schema {
  constructor() {
    super();
    this.id = "";
    this.name = "";
    this.cooldown = 0;
    this.effect = "";
  }
}

type(Ability, {
  id: "string",
  name: "string",
  cooldown: "number",
  effect: "string"
});