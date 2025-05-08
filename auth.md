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
- Implement JWT-based authentication with both access and refresh tokens
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
  - Implemented JWT verification in index.js

- ✅ **Room Authentication**
  - Implemented `onAuth` method in `NormalGameRoom.js`
  - Updated `onJoin` to handle authenticated users
  - Added `savePlayerData` method for persistence
  - Updated `onLeave` to save player data when authenticated
  - Added proper JWT verification using process environment variables

- ✅ **Client-Side Authentication Integration**
  - Added authentication methods to `NetworkManager.js`
  - Implemented token storage and management
  - Fixed URL scheme issue (using HTTP for auth endpoints)
  - Added test functionality to verify auth flow
  - Implemented token refresh mechanism
  - Added token decoding functionality
  - Implemented automatic checking for token expiration
  - Added automatic token refresh interval

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

- ✅ **Authentication Flow Fixes**
  - Resolved token naming inconsistency issues
  - Disabled conflicting Colyseus built-in auth routes
  - Fixed password comparison issues with bcrypt
  - Verified both access and refresh tokens are being generated and sent

- ✅ **Token Persistence & Session Management**
  - Fixed token format inconsistency between client/server
  - Ensured both tokens (access + refresh) are being properly generated and returned
  - Implemented token refresh mechanism
  - Added automatic token refresh for long-running sessions
  - Implemented session restoration on page reload
  - Added token expiration checking

## In Progress

- 🔄 **Session Persistence Edge Cases**
  - 🔄 Improve error handling for failed token refreshes
  - 🔄 Add graceful reconnection after token refresh
  - 🔄 Optimize token refresh timing to prevent unnecessary refreshes

- 🔄 **Testing and Debugging**
  - ✅ Fix password verification with bcrypt
  - ✅ Testing basic authentication flow
  - 🔄 Comprehensive testing of token refresh scenarios
  - 🔄 Testing edge cases for authentication failures
  - 🔄 Verifying data persistence across sessions

## Pending Tasks

- 🔲 **Security Enhancements**
  - Set up rate limiting for auth endpoints
  - Implement IP-based throttling
  - Add secure HTTP headers
  - Configure proper CORS settings
  - Consider moving refresh tokens to HttpOnly cookies

- 🔲 **User Profile Features**
  - Implement full profile editing
  - Add avatar customization
  - Display game history and statistics
  - Add friend system

- 🔲 **Authentication UX Improvements**
  - Add loading indicators during authentication processes
  - Implement "Remember Me" functionality
  - Improve error messaging
  - Add password reset functionality

## Implementation Details

### Server-Side Implementation

We have implemented the following server-side components:

1. **Auth Controllers (`auth/controllers.js`)**
   - `registerUser`: Creates a new user with email/password
   - `loginUser`: Authenticates a user and returns tokens
   - `refreshToken`: Issues a new token pair
   - `validateToken`: Verifies token validity
   - `generateTokens`: Creates proper access and refresh tokens

2. **Room Authentication (`NormalGameRoom.js`)**
   - `onAuth`: Validates token and extracts user data
   - `onJoin`: Links authenticated users to their profiles
   - `savePlayerData`: Persists player data to the database
   - `onLeave`: Saves player data when authenticated users leave
   - JWT verification using environment variables

3. **Server Configuration**
   - Removed conflicting Colyseus built-in auth routes
   - Using only custom auth routes for consistent token handling
   - JWT token management with proper access and refresh tokens
   - API routes for authentication
   - Integrated with Prisma for database operations

### Client-Side Implementation

We have implemented the following client-side components:

1. **Network Manager (`NetworkManager.js`)**
   - `login`: Authenticates with email/password
   - `register`: Creates a new user account
   - `logout`: Clears authentication state
   - `refreshToken`: Updates tokens when expired
   - `checkExistingAuth`: Verifies existing tokens on startup
   - `decodeToken`: Parses JWT token payload
   - `refreshTokenIfNeeded`: Automatically refreshes tokens before expiry
   - `fetchUserData`: Retrieves complete user profile data
   - Token storage in localStorage
   - Automatic token refresh interval
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
   - Authentication status change events

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

We've successfully implemented robust session persistence:

1. **Token Management**:
   - Fixed naming inconsistencies between client and server
   - Both access and refresh tokens are correctly generated and stored
   - Implemented proper JWT decoding to check expiration

2. **Automatic Token Refresh**:
   - Added interval-based token refresh mechanism (checks every minute)
   - Implemented token expiration checking
   - Proactive refresh when tokens are about to expire (5 minutes before expiry)

3. **Session Restoration**:
   - Authentication state is properly restored on page reload
   - Existing tokens are validated on startup
   - Failed validation triggers token refresh as fallback

Current implementation for session persistence:

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

// Automatically check existing authentication on startup
async checkExistingAuth() {
  const token = localStorage.getItem("auth_token");
  if (!token) return;

  try {
    // Try to parse payload from token
    const payload = this.decodeToken(token);
    if (payload) {
      const now = Date.now() / 1000;

      // Check if token is expired
      if (payload.exp && payload.exp < now) {
        console.log("Stored token is expired, trying refresh token");
        // Try to refresh token
        const refreshed = await this.refreshToken();
        if (refreshed) {
          // If token was refreshed successfully, re-run auth check
          return this.checkExistingAuth();
        } else {
          // Failed to refresh, clear tokens
          localStorage.removeItem("auth_token");
          localStorage.removeItem("refresh_token");
          this.isAuthenticated = false;
          this.userData = null;
          return;
        }
      } else {
        // Token is still valid, set user data
        this.userData = {
          id: payload.id,
          username: payload.username,
          email: payload.email,
        };
        this.isAuthenticated = true;

        // Fetch complete user data
        try {
          await this.fetchUserData();
        } catch (error) {
          console.warn(
            "Could not fetch complete user data, using token data instead:",
            error
          );
        }

        // Trigger auth status changed event
        window.dispatchEvent(
          new CustomEvent("authStatusChanged", {
            detail: {
              isAuthenticated: true,
              user: this.userData,
            },
          })
        );
      }
    }
  } catch (error) {
    // Try to validate token with server or refresh if needed
    // [Implementation details...]
  }
}

// Check if token needs refreshing
async refreshTokenIfNeeded() {
  if (!this.isAuthenticated) return;

  const token = localStorage.getItem("auth_token");
  if (!token) return;

  // Check if token is about to expire
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

// Token decoding functionality
decodeToken(token) {
  try {
    const base64Url = token.split(".")[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => {
          return "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2);
        })
        .join("")
    );

    return JSON.parse(jsonPayload);
  } catch (error) {
    console.error("Error decoding token:", error);
    return {};
  }
}
```

Areas still needing improvement:
- Better error handling for network failures during token refresh
- More graceful fallback mechanisms when authentication fails
- Enhanced security for token storage

## Testing Procedure

To test the authentication implementation:

1. **Registration Flow**
   - Open the game and see the auth overlay
   - Go to the Register tab
   - Fill in username, email, and password
   - Submit the form
   - Verify successful login and UI update
   - Check localStorage for both token types

2. **Login Flow**
   - Open the game after logging out
   - Enter email and password
   - Submit the login form
   - Verify successful login and UI update
   - Check localStorage for both token types

3. **Session Persistence**
   - Login to the game
   - Reload the page
   - Verify that authentication is maintained
   - Check that the UI reflects the logged-in state

4. **Token Refresh**
   - Login to the game
   - Let the session run for longer than the token expiry time (or modify token to expire sooner for testing)
   - Verify that the token is refreshed automatically
   - Check that the session remains active
   - Look for refresh events in browser console

5. **Expiration Handling**
   - Manually modify the token expiration in localStorage to be in the past
   - Reload the page
   - Verify that refresh token is used to obtain a new access token
   - Check that authentication is recovered

6. **Game Session Authentication**
   - Login and connect to a game
   - Verify the authentication state is preserved
   - Check player data is linked to profile

7. **Player Data Persistence**
   - Complete a game session as authenticated user
   - Verify player stats are saved to database
   - Check stats are loaded on next login

8. **Guest Mode**
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

1. **Token Format Issues**
   - Inconsistent property names between server and client
   - Missing or invalid token format
   - Token expiration not properly handled

2. **Auth System Conflicts**
   - Multiple auth systems running simultaneously (Colyseus + custom)
   - Inconsistent routing leading to unexpected endpoints
   - Middleware conflicts affecting response format

3. **Password Verification**
   - bcrypt compare returning false despite correct credentials
   - Database field length insufficient for full hash
   - Hash format incompatibilities between systems

4. **React-Phaser Integration**
   - JSX configuration issues
   - Component rendering problems
   - Event propagation issues between React and Phaser

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

1. Improve error handling for token refresh failures
2. Add rate limiting for authentication endpoints 
3. Implement "Remember Me" functionality for longer sessions
4. Add password reset capabilities
5. Enhance security with proper CSRF protection
6. Complete user profile editing features