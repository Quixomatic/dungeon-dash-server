# Dungeon Dash Royale: Authentication Implementation Guide

## Table of Contents
- [Overview](#overview)
- [Completed Steps](#completed-steps)
- [In Progress](#in-progress)
- [Pending Tasks](#pending-tasks)
- [Implementation Details](#implementation-details)
  - [Server-Side Implementation](#server-side-implementation)
  - [Client-Side Implementation](#client-side-implementation)
  - [Database Schema](#database-schema)
- [Session Persistence](#session-persistence)
- [Testing Procedure](#testing-procedure)
- [Security Considerations](#security-considerations)
- [Troubleshooting](#troubleshooting)

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
  - Configured CORS to allow cross-origin requests from the client

- ✅ **Room Authentication**
  - Implemented `onAuth` method in `NormalGameRoom.js`
  - Updated `onJoin` to handle authenticated users
  - Added `savePlayerData` method for persistence
  - Updated `onLeave` to save player data when authenticated

- ✅ **Client-Side Authentication Integration**
  - Added authentication methods to `NetworkManager.js`
  - Implemented token storage and management
  - Fixed URL scheme issue (using HTTP for auth endpoints)
  - Added test functionality to verify auth flow

- ✅ **UI for Authentication**
  - Set up React integration with Phaser
  - Fixed JSX configuration issues
  - Connected React auth components to the game
  - Added login/logout functionality
  - Updated LobbyScene to integrate auth flow

- ✅ **Player Profile Management**
  - Created PlayerProfileManager to handle user profiles
  - Added profile data fetching and updating
  - Connected profile management with auth system

## In Progress

- 🔄 **Token Persistence & Session Management**
  - Implement proper token refresh mechanism
  - Fix session persistence across page reloads
  - Add automatic token refresh for long-running sessions
  - Improve token storage security

- 🔄 **Testing and Debugging**
  - Testing the end-to-end authentication flow
  - Verifying token validation and user data connection
  - Testing persistence of player data

## Pending Tasks

- 🔲 **Security Enhancements**
  - Set up rate limiting for auth endpoints
  - Implement IP-based throttling
  - Add secure HTTP headers
  - Configure proper CORS settings

- 🔲 **User Profile Features**
  - Implement full profile editing
  - Add avatar customization
  - Display game history and statistics
  - Add friend system

## Implementation Details

### Server-Side Implementation

We have implemented the following server-side components:

1. **Auth Controllers (`auth/controllers.js`)**
   - `registerUser`: Creates a new user with email/password
   - `loginUser`: Authenticates a user and returns tokens
   - `refreshToken`: Issues a new token pair
   - `validateToken`: Verifies token validity

2. **Room Authentication (`NormalGameRoom.js`)**
   - `onAuth`: Validates token and extracts user data
   - `onJoin`: Links authenticated users to their profiles
   - `savePlayerData`: Persists player data to the database
   - `onLeave`: Saves player data when authenticated users leave

3. **Server Configuration**
   - CORS support for handling cross-origin requests
   - JWT token management
   - API routes for authentication

### Client-Side Implementation

We have implemented the following client-side components:

1. **Network Manager (`NetworkManager.js`)**
   - `login`: Authenticates with email/password
   - `register`: Creates a new user account
   - `logout`: Clears authentication state
   - `refreshToken`: Updates tokens when expired
   - Fixed URL scheme issue for authentication endpoints
   - Token storage in localStorage
   - Authentication state management

2. **React UI Components**
   - `LoginForm`: Handles user login
   - `RegisterForm`: Handles new user registration
   - `AuthContainer`: Manages authentication forms
   - `ReactPhaserBridge`: Integrates React components with Phaser

3. **Player Profile Management**
   - `PlayerProfileManager`: Manages player profiles
   - Profile data fetching and updating
   - Integration with authentication system
   - Guest profile handling

### Database Schema

Our Prisma schema includes:

- **User**: Core user authentication entity
  - id, email, password, username
  - AuthProviders (one-to-many)
  - PlayerProfile (one-to-one)

- **PlayerProfile**: Game-specific user data
  - displayName, level, currency, etc.
  - User (relation)
  - PlayerStats (one-to-one)
  - InventoryItems (one-to-many)
  - PlayerAchievements (one-to-many)

## Session Persistence

Currently, we store authentication tokens in localStorage, but we're facing an issue where users need to log in again after page reloads. This happens because:

1. While the token is stored in localStorage, we need to properly restore the authentication state on page load
2. We need to implement a token refresh mechanism to handle token expiration
3. The Colyseus client needs to be initialized with the token before connecting

To fix this, we need to:

1. Update the NetworkManager to check for existing tokens on initialization
2. Add a token refresh mechanism that runs periodically
3. Ensure tokens are properly restored and validated on page reloads
4. Implement proper error handling for invalid or expired tokens

### Planned Implementation for Session Persistence

```javascript
// In NetworkManager.js
constructor() {
  // Existing code...
  
  // Check for existing token on initialization
  this.checkExistingAuth();
  
  // Set up token refresh interval
  this.tokenRefreshInterval = setInterval(() => {
    this.refreshTokenIfNeeded();
  }, 60000); // Check every minute
}

// Check for existing auth token and restore state
async checkExistingAuth() {
  const token = localStorage.getItem("auth_token");
  if (!token) return;
  
  try {
    // Validate token
    const response = await fetch(`${this.httpServerUrl}/auth/validate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ token }),
    });
    
    if (!response.ok) {
      // Token is invalid, remove it
      localStorage.removeItem("auth_token");
      this.isAuthenticated = false;
      return;
    }
    
    // Token is valid, restore auth state
    const data = await response.json();
    
    this.isAuthenticated = true;
    this.userData = data.user;
    
    console.log("Authentication restored from saved token");
  } catch (error) {
    console.error("Error validating saved token:", error);
    localStorage.removeItem("auth_token");
  }
}

// Check if token needs refresh
async refreshTokenIfNeeded() {
  if (!this.isAuthenticated) return;
  
  const token = localStorage.getItem("auth_token");
  if (!token) return;
  
  // Check if token is about to expire
  // (We'd need to decode the JWT to check expiration)
  try {
    const tokenData = this.decodeToken(token);
    const now = Date.now() / 1000;
    
    // If token expires in less than 5 minutes, refresh it
    if (tokenData.exp && tokenData.exp - now < 300) {
      await this.refreshToken();
    }
  } catch (error) {
    console.error("Error checking token expiration:", error);
  }
}

// Helper to decode JWT token
decodeToken(token) {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(atob(base64).split('').map(c => {
      return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
    
    return JSON.parse(jsonPayload);
  } catch (error) {
    console.error("Error decoding token:", error);
    return {};
  }
}
```

### Connection with Authentication Token

To ensure the Colyseus client uses the authentication token:

```javascript
async connect(options = {}) {
  try {
    if (!this.client) {
      this.client = new Client(this.serverUrl);
    }

    // Set token on client if available
    const token = localStorage.getItem("auth_token");
    if (token) {
      this.client.auth.token = token;
    }

    // Join or create room
    this.room = await this.client.joinOrCreate(this.roomType, options);
    this.connected = true;
    
    // Rest of the method...
  } catch (error) {
    // Handle error...
  }
}
```

## Testing Procedure

To test the authentication implementation:

1. **Registration Flow**
   - Open the game and see the auth overlay
   - Go to the Register tab
   - Fill in username, email, and password
   - Submit the form
   - Verify successful login and UI update

2. **Login Flow**
   - Open the game after logging out
   - Enter email and password
   - Submit the login form
   - Verify successful login and UI update

3. **Session Persistence**
   - Login to the game
   - Reload the page
   - Verify that authentication is maintained
   - Check that the UI reflects the logged-in state

4. **Token Refresh**
   - Login to the game
   - Let the session run for longer than the token expiry time
   - Verify that the token is refreshed automatically
   - Check that the session remains active

5. **Game Session Authentication**
   - Login and connect to a game
   - Verify the authentication state is preserved
   - Check player data is linked to profile

6. **Player Data Persistence**
   - Complete a game session as authenticated user
   - Verify player stats are saved to database
   - Check stats are loaded on next login

7. **Guest Mode**
   - Click "Continue as Guest" on the auth overlay
   - Verify you can play without authentication
   - Check that data is not persisted between sessions

## Security Considerations

1. **Token Storage**
   - Tokens are currently stored in localStorage, which is vulnerable to XSS attacks
   - Consider using HttpOnly cookies for refresh tokens (requires server-side changes)
   - Keep access tokens in memory only where possible

2. **Token Validation**
   - Always validate tokens with the server
   - Check token expiration before use
   - Implement proper error handling for invalid tokens

3. **CSRF Protection**
   - Add CSRF tokens to sensitive operations
   - Validate origin of requests
   - Use proper CORS configuration

4. **Password Security**
   - Enforce strong password policies
   - Rate limit authentication attempts
   - Implement account lockout after failed attempts

## Troubleshooting

### Common Issues

1. **Session Persistence Issues**
   - Token not being saved properly in localStorage
   - Token not being restored on page reload
   - Missing token refresh mechanism
   - Token validation failures

2. **CORS Errors**
   - Make sure the server has CORS properly configured
   - Add the correct client origins to the CORS configuration
   - Enable credentials if using cookies

3. **URL Scheme Issues**
   - Ensure you're using the correct URL scheme for different operations:
   - WebSocket URL (`ws://`) for game connections
   - HTTP URL (`http://`) for authentication API calls

4. **React-Phaser Integration Issues**
   - Make sure JSX is properly enabled in your build configuration
   - Use the modern React 18 API with createRoot() for rendering
   - Set proper z-index and pointer-events CSS properties

5. **Token Validation Issues**
   - Check that tokens are properly stored in localStorage
   - Verify token format and expiration
   - Check for correct token transmission in requests

### Debugging Authentication

When debugging authentication issues:

1. Check browser console for errors
2. Verify network requests in Developer Tools
3. Ensure tokens are properly stored in localStorage
4. Validate token format and expiration
5. Check server logs for validation errors
6. Verify CORS headers in responses
7. Test authentication endpoints directly with tools like Postman

## Next Steps

Our immediate next steps are:

1. Implement token refresh mechanism
2. Fix session persistence across page reloads
3. Add automatic token refresh for long-running sessions
4. Complete thorough testing of the auth flow
5. Add security enhancements
6. Implement more advanced profile features