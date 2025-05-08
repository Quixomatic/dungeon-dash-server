// index.js
import express from 'express';
import http from 'http';
import { Server } from 'colyseus';
import { monitor } from '@colyseus/monitor';
import { auth } from '@colyseus/auth';
import jwt from 'jsonwebtoken';
import cors from 'cors';
import { NormalGameRoom } from './rooms/NormalGameRoom.js';
import { prisma } from './lib/prisma.js';
import basicAuthPackage from 'express-basic-auth';

const port = process.env.PORT || 2567;
const app = express();

app.use(cors({
  origin: ['http://localhost:5173', 'http://127.0.0.1:5173'], // Add your client URLs
  credentials: true
}));

// JSON parsing middleware
app.use(express.json());

// Configure Colyseus Auth with Prisma integration
auth.settings.onFindUserByEmail = async (email) => {
  return await prisma.user.findUnique({ 
    where: { email },
    include: { playerProfile: true }
  });
};

auth.settings.onRegisterWithEmailAndPassword = async (email, password, options) => {
  console.log(options);

  // Password is already hashed by auth module
  return await prisma.user.create({
    data: {
      email,
      password,
      username: options.username || email.split('@')[0],
      playerProfile: {
        create: {
          displayName: options.displayName || options.username || email.split('@')[0],
          playerStats: {
            create: {}
          }
        }
      }
    },
    include: {
      playerProfile: true
    }
  });
};

// Custom token generation that adds refresh tokens
auth.settings.onGenerateToken = async function(userData) {
  const jwtSecret = process.env.JWT_SECRET || 'your-jwt-secret-for-development';
  const refreshSecret = process.env.REFRESH_TOKEN_SECRET || 'refresh-token-secret';

  // Generate the main access token using Colyseus's built-in JWT
  const accessToken = jwt.sign(
    {
      id: userData.id,
      email: userData.email,
      username: userData.username,
      type: 'access'
    },
    jwtSecret,
    { expiresIn: auth.settings.jwt.expiresIn || '15m' }
  );
  
  // Generate a refresh token with longer expiry
  const refreshToken = jwt.sign(
    { 
      id: userData.id,
      type: 'refresh' 
    },
    refreshSecret,
    { expiresIn: '7d' }
  );
  
  // Store refresh token info in database
  try {
    await prisma.authProvider.upsert({
      where: {
        provider_providerId: {
          provider: 'refresh_token',
          providerId: userData.id.toString(),
        },
      },
      update: {
        providerData: { 
          lastRefresh: new Date().toISOString()
        },
        lastLogin: new Date()
      },
      create: {
        provider: 'refresh_token',
        providerId: userData.id.toString(),
        providerData: { 
          lastRefresh: new Date().toISOString()
        },
        userId: userData.id
      }
    });
  } catch (error) {
    console.error("Error storing refresh token:", error);
  }
  
  // Return both tokens
  return {
    token: accessToken,
    refreshToken: refreshToken
  };
};

// JWT settings - shorter expiration for better security
auth.settings.jwt = {
  secret: process.env.JWT_SECRET || 'your-jwt-secret-for-development',
  expiresIn: '15m' // 15 minutes
};

// Use auth routes
app.use(auth.prefix, auth.routes());

// Add refresh token endpoint
app.post('/auth/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
      return res.status(400).json({ error: 'Refresh token required' });
    }
    
    // Verify refresh token
    let decoded;
    try {
      decoded = jwt.verify(
        refreshToken, 
        process.env.REFRESH_TOKEN_SECRET || 'refresh-token-secret'
      );
    } catch (error) {
      return res.status(401).json({ error: 'Invalid refresh token' });
    }
    
    // Check token type
    if (decoded.type !== 'refresh') {
      return res.status(401).json({ error: 'Invalid token type' });
    }
    
    // Find user
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      include: { playerProfile: true }
    });
    
    if (!user) {
      return res.status(401).json({ error: 'Invalid refresh token' });
    }
    
    // Generate both tokens using our custom generator
    const tokens = await auth.settings.onGenerateToken(user);
    
    // Return new tokens
    return res.status(200).json({
      token: tokens.token,
      refreshToken: tokens.refreshToken,
      expiresIn: auth.settings.jwt.expiresIn || '15m'
    });
  } catch (error) {
    console.error('Refresh token error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Create HTTP server
const server = http.createServer(app);

// Create Colyseus server
const gameServer = new Server({
  server,
  // Pass auth presence
  presence: auth.presence
});

// Register room handlers
gameServer.define('normal', NormalGameRoom, {
  maxPlayers: 100,
  maxWaitTime: 30 * 1000,
  minPlayers: 2,
  metadata: {
    gameMode: 'normal'
  }
});

// Register Colyseus monitor with auth protection
const basicAuth = basicAuthPackage({
  users: { 
    "admin": "admin" 
  },
  challenge: true
});
app.use('/colyseus', basicAuth, monitor());

// Add a protected route example using auth middleware
app.get('/profile', auth.middleware(), (req, res) => {
  res.json(req.auth);
});

// Start the server
gameServer.listen(port).then(() => {
  console.log(`🎮 Dungeon Dash Royale server running on port ${port}`);
  console.log(`Monitor available at http://localhost:${port}/colyseus`);
  
  // Log authentication endpoints
  console.log(`Auth endpoints available at: `);
  console.log(`- POST ${auth.prefix}/register - Register new user`);
  console.log(`- POST ${auth.prefix}/login - Login user`);
  console.log(`- POST /auth/refresh - Refresh token`);
  
  if (process.env.NODE_ENV !== 'production') {
    console.log(`\nRunning in development mode with JWT_SECRET: ${process.env.JWT_SECRET ? 'Set from env' : 'Using fallback (unsafe)'}`);
  }
});