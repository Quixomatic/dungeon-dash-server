// server/schemas/Position.js
import { Schema, type } from "@colyseus/schema";

export class Position extends Schema {
  constructor(x = 0, y = 0) {
    super();
    this.x = x;
    this.y = y;
  }
}

type(Position, {
  x: "number",
  y: "number"
});