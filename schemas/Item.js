// server/schemas/Item.js
import { Schema, defineTypes, type } from "@colyseus/schema";

export class Item extends Schema {
  constructor() {
    super();
    this.id = "";
    this.name = "";
    this.type = "";
    this.rarity = "";
    this.stats = {};
  }
}

defineTypes(Item, {
  id: "string",
  name: "string",
  type: "string",
  rarity: "string",
  stats: "object"
});