# Movement and Dash System Implementation Guide

## Table of Contents
- [Overview](#overview)
- [Basic Movement System](#basic-movement-system)
- [Dash/Dodge Ability](#dash-dodge-ability)
- [Implementation Steps](#implementation-steps)
- [Client-Side Implementation](#client-side-implementation)
- [Server-Side Implementation](#server-side-implementation)
- [Visual and Audio Feedback](#visual-and-audio-feedback)
- [Testing Procedures](#testing-procedures)
- [Best Practices and Tuning](#best-practices-and-tuning)

## Overview

This guide outlines the implementation of movement and dash/dodge abilities for Dungeon Dash Royale. The movement system combines standard directional control with a quick dash ability that gives players additional mobility options during gameplay.

## Basic Movement System

The existing movement system has the following characteristics:

- **Direction Control**: WASD and arrow keys for 8-directional movement
- **Movement Speed**: 300 pixels per second (default)
- **Input Processing**: Inputs are queued and processed with timestamps
- **Client Prediction**: Client predicts movement before server confirmation
- **Server Reconciliation**: Client adjusts position based on server validation
- **Collision Detection**: Both client and server check for wall collisions
- **Normalization**: Diagonal movement is normalized to prevent faster movement

## Dash/Dodge Ability

The dash/dodge ability provides players with a quick burst of movement:

### Core Mechanics

- **Quick Movement Burst**: Rapid movement in a specific direction
- **Charge-Based System**: Limited uses (initially 1 charge)
- **Cooldown**: Each charge recovers independently
- **Direction Control**: 
  - Uses current movement direction when moving
  - Uses last movement direction when standing still
  - Falls back to default direction if no prior movement

### Dash Properties

- **Activation**: Spacebar keypress
- **Distance**: 120 pixels (configurable)
- **Duration**: 0.15 seconds (configurable)
- **Cooldown**: 3.0 seconds per charge (configurable)
- **Initial Charges**: 1 (expandable)
- **Animation**: Smooth interpolation with ease-out function

## Implementation Steps

### 1. Extend Control System

1. Add spacebar input detection to the controls module
2. Track last movement direction for stationary dashes
3. Implement a dash charge tracking system

### 2. Client-Side Dash Mechanics

1. Add dash property tracking to InputHandler
2. Implement dash execution logic with collision checking
3. Create interpolation for smooth dash movement
4. Set up cooldown timers for charge recovery
5. Add feedback effects (visual/audio)

### 3. Server-Side Validation

1. Add dash input handling to server's InputHandler
2. Implement identical collision resolution logic
3. Track dash charges and cooldowns on the server
4. Validate all dash requests
5. Send authoritative position updates

### 4. Networking and Reconciliation

1. Extend input message format to include dash data
2. Update server acknowledgment messages with dash status
3. Implement client reconciliation for dash positions
4. Add dash events for other players to see

## Client-Side Implementation

### InputHandler.js Updates

```javascript
// Add to constructor
constructor(scene) {
  // Existing code...
  
  // Dash properties
  this.dashCharges = [{ available: true, cooldownEndTime: 0 }];
  this.dashDistance = 120;
  this.dashDuration = 0.15; // seconds
  this.dashCooldown = 3.0; // seconds
  this.isDashing = false;
  this.dashStartTime = 0;
  this.dashEndTime = 0;
  this.dashDirection = { x: 0, y: 0 };
  this.dashStartPosition = { x: 0, y: 0 };
  this.dashTargetPosition = { x: 0, y: 0 };
  this.lastMovementDirection = { x: 0, y: 1 }; // Default down
}

// Add spacebar detection to controls
setUpControls() {
  // Existing control setup...
  
  // Add spacebar for dash
  this.dashKey = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
  this.dashKey.on('down', this.handleDashKeyDown.bind(this));
}

// Handle dash key press
handleDashKeyDown() {
  // Check if currently dashing
  if (this.isDashing) return;
  
  // Get direction
  let direction;
  if (this.controls.isMoving()) {
    // Use current movement direction
    direction = this.controls.getDirectionVector();
  } else {
    // Use last movement direction if stationary
    direction = this.lastMovementDirection;
  }
  
  // Execute dash
  this.executeDash(direction);
}

// Execute dash
executeDash(direction) {
  // Check if dash is available
  if (!this.hasDashCharge()) return false;
  
  // Set dashing state
  this.isDashing = true;
  this.dashStartTime = Date.now();
  this.dashEndTime = this.dashStartTime + (this.dashDuration * 1000);
  
  // Calculate dash vector
  this.dashDirection = direction;
  this.dashStartPosition = this.playerManager.getPlayerPosition();
  this.dashTargetPosition = {
    x: this.dashStartPosition.x + direction.x * this.dashDistance,
    y: this.dashStartPosition.y + direction.y * this.dashDistance
  };
  
  // Check for collision at end point and adjust if needed
  if (this.collisionSystem && this.collisionSystem.checkCollision(
      this.dashTargetPosition.x, this.dashTargetPosition.y)) {
    // Resolve to find furthest valid position
    this.dashTargetPosition = this.collisionSystem.resolveCollision(
      this.dashStartPosition.x, this.dashStartPosition.y,
      this.dashTargetPosition.x, this.dashTargetPosition.y
    );
  }
  
  // Consume dash charge
  this.consumeDashCharge();
  
  // Play dash effect
  this.playDashEffect();
  
  // Send dash input to server
  this.networkHandler.sendInput({
    type: 'dash',
    direction: direction,
    seq: this.inputSequence++,
    timestamp: this.dashStartTime
  });
  
  return true;
}

// Update method - modify to handle ongoing dash
update(deltaTime) {
  // If currently dashing
  if (this.isDashing) {
    const now = Date.now();
    
    if (now < this.dashEndTime) {
      // Calculate dash progress (0 to 1)
      const progress = (now - this.dashStartTime) / (this.dashDuration * 1000);
      
      // Use ease-out function for smooth dash
      const easeOutProgress = 1 - Math.pow(1 - progress, 2);
      
      // Interpolate position
      const position = {
        x: this.dashStartPosition.x + (this.dashTargetPosition.x - this.dashStartPosition.x) * easeOutProgress,
        y: this.dashStartPosition.y + (this.dashTargetPosition.y - this.dashStartPosition.y) * easeOutProgress
      };
      
      // Update player position
      this.playerManager.setPlayerPosition(position.x, position.y);
    } else {
      // Dash completed
      this.isDashing = false;
      this.playerManager.setPlayerPosition(this.dashTargetPosition.x, this.dashTargetPosition.y);
    }
    
    // Don't process regular movement while dashing
    return false;
  }
  
  // Track direction for future dashes
  if (this.controls.isMoving()) {
    const direction = this.controls.getDirectionVector();
    if (direction.x !== 0 || direction.y !== 0) {
      this.lastMovementDirection = { ...direction };
    }
  }
  
  // Normal movement processing
  // ...existing movement code...
}

// Check if dash charge is available
hasDashCharge() {
  for (const charge of this.dashCharges) {
    if (charge.available) {
      return true;
    }
  }
  return false;
}

// Consume a dash charge
consumeDashCharge() {
  for (let i = 0; i < this.dashCharges.length; i++) {
    if (this.dashCharges[i].available) {
      this.dashCharges[i].available = false;
      this.dashCharges[i].cooldownEndTime = Date.now() + (this.dashCooldown * 1000);
      
      // Start cooldown timer
      this.startChargeCooldown(i);
      break;
    }
  }
}

// Start cooldown for a specific charge
startChargeCooldown(chargeIndex) {
  setTimeout(() => {
    if (chargeIndex < this.dashCharges.length) {
      this.dashCharges[chargeIndex].available = true;
      this.dashCharges[chargeIndex].cooldownEndTime = 0;
      
      // Play charge refill effect/sound
      this.playChargeRefillEffect();
    }
  }, this.dashCooldown * 1000);
}

// Play visual effect for dash
playDashEffect() {
  // If we have a player sprite
  if (this.playerManager && this.playerManager.localPlayer) {
    // Add motion blur or trail effect
    // This would be implemented based on your specific visual style
    
    // Example: alpha flash
    this.scene.tweens.add({
      targets: this.playerManager.localPlayer,
      alpha: 0.7,
      duration: 50,
      yoyo: true
    });
  }
  
  // Play dash sound
  // this.scene.sound.play('dash_sound');
}

// Play visual effect for charge refill
playChargeRefillEffect() {
  // Visual notification that dash is available again
  // this.scene.sound.play('charge_ready');
}

// Update dash charges from server
updateDashCharges(chargesData) {
  // Update charge state from server
  this.dashCharges = chargesData;
}
```

### Controls.js Updates

```javascript
// Add to createControls function
export function createControls(scene) {
  // Existing code...
  
  // Add spacebar for dash
  const dashKey = scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
  
  return {
    // Existing properties...
    dashKey,
    
    // Add dash key check
    isDashKeyDown() {
      return dashKey.isDown;
    }
  };
}
```

## Server-Side Implementation

### InputHandler.js Updates

```javascript
// Add to constructor
constructor(room) {
  // Existing code...
  
  // Dash configuration
  this.dashDistance = 120;
  this.dashCooldown = 3.0; // seconds
}

// Add to registerHandlers method
registerHandlers() {
  // Existing code...
  
  // Handle dash input
  this.room.onMessage("playerInput", (client, message) => {
    // Check if this is a dash input
    if (message.type === 'dash') {
      this.handleDashInput(client, message);
      return;
    }
    
    // Existing input handling...
  });
}

// Add new method for handling dash inputs
handleDashInput(client, message) {
  // Get player
  const player = this.room.state.players.get(client.id);
  if (!player) return;
  
  // Initialize dash charges if not exists
  if (!player.dashCharges) {
    player.dashCharges = [{ available: true, cooldownEndTime: 0 }];
  }
  
  // Check if dash charge is available
  if (!this.playerHasDashCharge(player)) {
    // Send charge update to client
    client.send("dashUpdate", {
      charges: player.dashCharges,
      seq: message.seq
    });
    return;
  }
  
  // Normalize direction vector
  const direction = message.direction;
  const magnitude = Math.sqrt(direction.x * direction.x + direction.y * direction.y);
  if (magnitude > 0) {
    direction.x /= magnitude;
    direction.y /= magnitude;
  }
  
  // Calculate dash movement
  const startPos = {
    x: player.position.x,
    y: player.position.y
  };
  
  const targetPos = {
    x: startPos.x + direction.x * this.dashDistance,
    y: startPos.y + direction.y * this.dashDistance
  };
  
  // Check for collisions
  let finalPos = targetPos;
  if (this.collisionSystem) {
    // Check end position
    if (this.collisionSystem.checkCollision(targetPos.x, targetPos.y)) {
      // Resolve collision
      finalPos = this.collisionSystem.resolveCollision(
        startPos.x, startPos.y,
        targetPos.x, targetPos.y
      );
    }
  }
  
  // Consume dash charge
  this.consumeDashCharge(player);
  
  // Update player position
  player.position.x = finalPos.x;
  player.position.y = finalPos.y;
  
  // Broadcast dash to other clients
  this.room.broadcast("playerDashed", {
    id: client.id,
    x: finalPos.x,
    y: finalPos.y,
    direction: direction
  }, { except: client });
  
  // Send acknowledgment to client
  client.send("inputAck", {
    seq: message.seq,
    x: finalPos.x,
    y: finalPos.y,
    dashCharges: player.dashCharges
  });
}

// Check if player has a dash charge
playerHasDashCharge(player) {
  if (!player.dashCharges) return false;
  
  for (const charge of player.dashCharges) {
    if (charge.available) {
      return true;
    }
  }
  return false;
}

// Consume a dash charge and start cooldown
consumeDashCharge(player) {
  if (!player.dashCharges) return;
  
  for (let i = 0; i < player.dashCharges.length; i++) {
    if (player.dashCharges[i].available) {
      player.dashCharges[i].available = false;
      player.dashCharges[i].cooldownEndTime = Date.now() + (this.dashCooldown * 1000);
      
      // Set timeout to restore charge
      this.startChargeCooldown(player, i);
      break;
    }
  }
}

// Start cooldown for a specific charge
startChargeCooldown(player, chargeIndex) {
  setTimeout(() => {
    // Make sure player still exists
    if (!this.room.state.players.has(player.id)) return;
    
    // Restore charge
    if (chargeIndex < player.dashCharges.length) {
      player.dashCharges[chargeIndex].available = true;
      player.dashCharges[chargeIndex].cooldownEndTime = 0;
      
      // Notify player
      const client = this.room.clients.find(c => c.id === player.id);
      if (client) {
        client.send("dashChargeRestored", {
          chargeIndex: chargeIndex
        });
      }
    }
  }, this.dashCooldown * 1000);
}
```

### PlayerState.js Updates

```javascript
// Add to constructor
constructor() {
  // Existing code...
  
  // Dash properties
  this.dashCharges = new ArraySchema();
  this.dashCharges.push({ available: true, cooldownEndTime: 0 });
}

// Add to defineTypes
defineTypes(PlayerState, {
  // Existing types...
  dashCharges: ["object"],
});
```

## Visual and Audio Feedback

### Visual Feedback

1. **Dash Trail Effect**
   - Create a trail effect behind the player during dash
   - Trail should be semi-transparent and fade quickly
   - Color could match player color or be a contrasting color

2. **Flash Effect**
   - Quick flash or highlight of the player at dash start
   - Can be a simple alpha or tint change

3. **Dust Particles**
   - Small particles at dash start point
   - Additional particles if dash hits a wall

4. **UI Indicators**
   - Clear visual indicator for available dash charges
   - Cooldown animation (circular timer or fill effect)

### Audio Feedback

1. **Dash Sound**
   - Quick "whoosh" sound effect when dash is activated
   - Should be distinct but not too loud or jarring

2. **Cooldown Completion**
   - Subtle "ready" sound when a dash charge is restored
   - Should be noticeable but not disruptive

3. **Wall Collision**
   - Impact sound if dash hits a wall
   - Different from normal movement collision sounds

## Testing Procedures

1. **Basic Functionality**
   - Test dash activation with spacebar
   - Verify dash movement is correct distance and duration
   - Confirm cooldown timer works correctly
   - Test charge system works as expected

2. **Edge Cases**
   - Test dash at map boundaries
   - Test dash into corners and walls
   - Test rapid dash key presses
   - Test dash during other actions

3. **Networking**
   - Test with artificial latency
   - Verify server reconciliation works correctly
   - Test interaction with other moving players

4. **Visual Verification**
   - Confirm dash looks smooth and responsive
   - Verify visual feedback is clear and helpful
   - Check that cooldown indicators are accurate

## Best Practices and Tuning

### Movement Feel

- Dash should feel quick and responsive
- Duration should be brief (0.1-0.2 seconds)
- Use easing functions for smooth animation
- Lock other movement during dash but continue reading inputs
- Transition smoothly back to normal movement after dash

### Balance Considerations

- Dash distance: 100-150 pixels works well for most games
- Cooldown: 2-5 seconds depending on game pace
- Number of charges: Start with 1, can increase with progression
- Consider environmental hazards that might make dash more/less powerful

### Performance Optimization

- Use efficient collision detection for dash path
- Limit particle effects if performance is a concern
- Consider reducing effects on lower-end devices
- Pre-load all dash-related sounds and effects

### Accessibility

- Add visual indicators for audio cues
- Consider allowing key rebinding for dash activation
- Make cooldown indicators color-blind friendly

### Bug Prevention

- Validate all dash inputs on server
- Handle edge cases for dash during scene transitions
- Ensure proper cleanup of dash-related timers and tweens