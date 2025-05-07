# Dungeon Dash Royale: Authentication Implementation Guide

This document outlines the process of implementing authentication for the Dungeon Dash Royale multiplayer game, using Colyseus, Prisma, and PostgreSQL.

## Table of Contents
- [Overview](#overview)
- [Completed Steps](#completed-steps)
- [Pending Tasks](#pending-tasks)
- [Implementation Details](#implementation-details)
  - [Server-Side Implementation](#server-side-implementation)
  - [Client-Side Implementation](#client-side-implementation)
  - [Database Schema](#database-schema)
- [Testing Procedure](#testing-procedure)
- [Security Considerations](#security-considerations)

## Overview

The authentication system for Dungeon Dash Royale will:
- Allow players to register and login with email/password
- Store user data securely using Prisma and PostgreSQL
- Implement JWT-based authentication
- Link player profiles with game progress and statistics
- Provide a secure, persistent experience across sessions

## Completed Steps

- ✅ **Database Setup**
  - PostgreSQL database set up
  - Prisma schema defined with User, AuthProvider, PlayerProfile models
  - Schema migrations created

- ✅ **Basic Auth Integration**
  - Installed necessary packages (`@colyseus/auth`, `@prisma/client`, etc.)
  - Created Prisma client instance in `lib/prisma.js`
  - Set up auth controllers in `auth/controllers.js`
  - Created auth routes in `auth/routes.js`

- ✅ **Server Configuration**
  - Updated `index.js` to properly import and configure `auth` object
  - Set up auth middleware and routes
  - Connected Prisma with the auth module via callbacks
  - Added monitor with basic authentication

## Pending Tasks

- 🔲 **Complete Room Authentication**
  - Implement static `onAuth` method in `NormalGameRoom.js`
  - Add token validation logic
  - Connect authenticated user data to player state

- 🔲 **Client-Side Authentication**
  - Update `NetworkManager.js` to handle authentication
  - Implement login/registration UI
  - Store and send JWT tokens with requests
  - Add token refresh mechanism

- 🔲 **Database Persistence**
  - Run Prisma migrations on production database
  - Implement saving player stats to profiles
  - Add connection between User and PlayerState

- 🔲 **Error Handling & User Experience**
  - Add comprehensive error handling
  - Provide user feedback for auth operations
  - Implement loading states during auth operations

- 🔲 **Security Enhancements**
  - Set up rate limiting for auth endpoints
  - Implement IP-based throttling
  - Add secure HTTP headers
  - Configure proper CORS settings

## Implementation Details

### Server-Side Implementation

#### 1. Basic Server Setup (index.js)

The updated `index.js` file includes:
- Import of `auth` object from `@colyseus/auth`
- Configuration of auth settings for Prisma integration
- Auth routes mounting
- Protected route example
- Server initialization

```javascript
// Abbreviated example - see full implementation in your server code
import { auth } from '@colyseus/auth';
import { prisma } from './lib/prisma.js';

// Configure auth with Prisma
auth.settings.onFindUserByEmail = async (email) => {
  return await prisma.user.findUnique({ 
    where: { email },
    include: { playerProfile: true }
  });
};

// Mount auth routes
app.use(auth.prefix, auth.routes());
```

#### 2. Room Authentication (NormalGameRoom.js)

The `NormalGameRoom` class needs to include a static `onAuth` method:

```javascript
// To be implemented
static async onAuth(token, request) {
  // Validate JWT token
  // Extract user data
  // Return authenticated user info or reject
}
```

#### 3. Auth Controllers (auth/controllers.js)

The auth controllers need to handle:
- User registration
- User login
- Token validation
- Token refresh

### Client-Side Implementation

#### 1. NetworkManager Updates

The `NetworkManager.js` needs to be updated to:
- Store authentication tokens
- Send tokens with requests
- Handle login/register operations
- Manage token refresh

#### 2. User Interface

Authentication UI components need to be created for:
- Login form
- Registration form
- Profile management

### Database Schema

The current Prisma schema includes:

- **User**: Core user authentication entity
  - id, email, password, username
  - AuthProviders (one-to-many)
  - PlayerProfile (one-to-one)

- **AuthProvider**: For federated login (optional)
  - provider, providerId, providerData
  - userId (foreign key)

- **PlayerProfile**: Game-specific user data
  - displayName, level, currency, etc.
  - User (relation)
  - PlayerStats (one-to-one)
  - InventoryItems (one-to-many)
  - PlayerAchievements (one-to-many)

- **PlayerStats**: Game statistics
  - gamesPlayed, gamesWon, killCount, etc.
  - ProfileId (foreign key)

## Testing Procedure

To test the authentication implementation:

1. **Registration Flow**
   - Submit registration form with email/password
   - Verify user creation in database
   - Check authentication token is returned

2. **Login Flow**
   - Submit login form with credentials
   - Verify token is received and stored
   - Check protected routes are accessible

3. **Game Session Authentication**
   - Login and join game
   - Verify player is authenticated in room
   - Check player data is linked to profile

4. **Token Refresh**
   - Let access token approach expiration
   - Trigger refresh mechanism
   - Verify new token is issued

5. **Error Handling**
   - Test invalid credentials
   - Test expired tokens
   - Test malformed requests

## Security Considerations

- JWT Secret Management
  - Store in environment variables
  - Use different secrets for development/production
  - Rotate secrets periodically

- Password Security
  - Use bcrypt for password hashing
  - Enforce strong password policies
  - Implement account lockout after failed attempts

- Token Management
  - Short-lived access tokens (15-60 mins)
  - HTTP-only cookies for refresh tokens
  - Implement token revocation for logout

- Rate Limiting
  - Limit login/registration attempts
  - Apply IP-based throttling
  - Monitor for suspicious activity

## Next Steps

The immediate next steps to complete the authentication implementation are:

1. Implement the static `onAuth` method in `NormalGameRoom.js`
2. Update client-side `NetworkManager.js` to handle auth operations
3. Create simple login/registration UI components
4. Test the complete auth flow from registration to in-game authentication
5. Add token refresh mechanism to maintain sessions

Once these core elements are working, we can proceed to enhance security, improve the user experience, and implement more advanced features like social login and account management.