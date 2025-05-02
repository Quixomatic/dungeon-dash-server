// Optimized schema for binary transmission
import { Schema, defineTypes } from "@colyseus/schema";

export class DungeonSchema extends Schema {
    constructor() {
      super();
      // Room data in compact format
      // [x, y, width, height, type] instead of {x, y, width, height, type}
      this.rooms = new ArraySchema();
      
      // Corridors as point pairs instead of objects
      this.corridors = new ArraySchema();
      
      // Lookup tables
      this.types = new ArraySchema(); // ["normal", "spawn", "treasure", "boss"]
      
      // Efficient size representation
      this.width = 0;
      this.height = 0;
      this.seed = "";
    }
  }
  
  // Define types for schema
  defineTypes(DungeonSchema, {
    rooms: ["number[]"], // Array of [x, y, width, height, typeIndex]
    corridors: ["number[]"], // Array of [startX, startY, endX, endY]
    types: ["string"],
    width: "number",
    height: "number",
    seed: "string"
  });