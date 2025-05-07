// index.js
import express from 'express';
import http from 'http';
import { Server } from 'colyseus';
import { monitor } from '@colyseus/monitor';
import { auth } from '@colyseus/auth';
import { NormalGameRoom } from './rooms/NormalGameRoom.js';
import { prisma } from './lib/prisma.js';
import authRoutes from './auth/routes.js';
import basicAuthPackage from 'express-basic-auth';

const port = process.env.PORT || 2567;
const app = express();

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

auth.settings.onLoginWithEmailAndPassword = async (email, password) => {
  // Auth module handles password verification
  const user = await prisma.user.findUnique({
    where: { email },
    include: { playerProfile: true }
  });
  
  return user;
};

// JWT settings - Make sure JWT_SECRET is in your .env file
auth.settings.jwt = {
  secret: process.env.JWT_SECRET || 'your-jwt-secret-for-development',
  expiresIn: '7d'
};

// Use auth routes
app.use(auth.prefix, auth.routes());

// Use custom auth routes (if needed)
app.use('/auth', authRoutes);

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
  
  if (process.env.NODE_ENV !== 'production') {
    console.log(`\nRunning in development mode with JWT_SECRET: ${process.env.JWT_SECRET ? 'Set from env' : 'Using fallback (unsafe)'}`);
  }
});