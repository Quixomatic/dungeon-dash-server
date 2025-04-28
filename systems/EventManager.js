export class EventManager {
    constructor(room) {
      this.room = room;
      this.activeEvents = new Map();
    }
    
    triggerGlobalEvent() {
      // Create a random global event that affects all players
      const eventTypes = [
        "treasure_rain", "monster_surge", "healing_pools", 
        "darkness", "extra_loot", "shop_discount"
      ];
      
      const eventType = eventTypes[Math.floor(Math.random() * eventTypes.length)];
      const eventDuration = Math.floor(Math.random() * 30) + 30; // 30-60 seconds
      const eventId = `${eventType}_${Date.now()}`;
      
      // Add event to global events
      this.room.state.globalEvents.push(eventId);
      this.activeEvents.set(eventId, {
        type: eventType,
        duration: eventDuration,
        startTime: Date.now()
      });
      
      // Broadcast event to all players
      this.room.broadcast("globalEvent", {
        id: eventId,
        type: eventType,
        duration: eventDuration,
        message: this.getEventMessage(eventType)
      });
      
      // Clear event after duration
      this.room.clock.setTimeout(() => {
        this.endEvent(eventId);
      }, eventDuration * 1000);
      
      return eventId;
    }
    
    endEvent(eventId) {
      // Remove event from state
      const index = this.room.state.globalEvents.indexOf(eventId);
      if (index !== -1) {
        this.room.state.globalEvents.splice(index, 1);
      }
      
      const eventData = this.activeEvents.get(eventId);
      if (eventData) {
        // Broadcast event ended
        this.room.broadcast("globalEventEnded", {
          id: eventId,
          type: eventData.type
        });
        
        // Remove from active events
        this.activeEvents.delete(eventId);
      }
    }
    
    getEventMessage(eventType) {
      // Return appropriate message for event type
      const messages = {
        "treasure_rain": "Treasure is raining from the sky! Extra loot for everyone!",
        "monster_surge": "Monster surge! Beware of increased enemy spawns!",
        "healing_pools": "Healing pools have appeared! Restore your health!",
        "darkness": "Darkness falls! Limited visibility ahead!",
        "extra_loot": "Extra loot from all sources!",
        "shop_discount": "Shop discount! All items are cheaper!"
      };
      
      return messages[eventType] || "A mysterious event is occurring!";
    }
    
    update(deltaTime) {
      // Process active events
      this.activeEvents.forEach((event, id) => {
        // Calculate remaining time
        const elapsed = Date.now() - event.startTime;
        const remaining = event.duration * 1000 - elapsed;
        
        // End event if duration exceeded
        if (remaining <= 0) {
          this.endEvent(id);
        }
      });
    }
  }