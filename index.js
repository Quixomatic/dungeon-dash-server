// index.js
import express from 'express';
import http from 'http';
import { Server } from 'colyseus';
import { monitor } from '@colyseus/monitor';
import { auth } from '@colyseus/auth';
import { NormalGameRoom } from './rooms/NormalGameRoom.js';
import { prisma } from './lib/prisma.js';

const port = process.env.PORT || 2567;
const app = express();

// JSON parsing middleware
app.use(express.json());

// Setup Colyseus Auth
const authOptions = {
  // Custom storage implementation for Prisma
  storage: {
    async findUserByEmail(email) {
      return await prisma.user.findUnique({ 
        where: { email },
        include: { playerProfile: true }
      });
    },
    async findUserById(id) {
      return await prisma.user.findUnique({ 
        where: { id: parseInt(id) },
        include: { playerProfile: true }
      });
    },
    async findUserByUsername(username) {
      return await prisma.user.findUnique({ 
        where: { username },
        include: { playerProfile: true }
      });
    },
    async saveUser(user) {
      // If user has ID, update, otherwise create
      if (user.id) {
        return await prisma.user.update({
          where: { id: user.id },
          data: {
            email: user.email,
            username: user.username,
            password: user.password,
            // Update other fields as needed
          }
        });
      } else {
        return await prisma.user.create({
          data: {
            email: user.email,
            username: user.username,
            password: user.password,
            playerProfile: {
              create: {
                displayName: user.username || user.email,
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
      }
    }
  },
  // JWT settings
  jwtKey: process.env.JWT_SECRET || 'your-jwt-secret',
  // Cookie settings for web clients
  cookie: {
    name: 'ddash_token',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    path: '/',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production'
  },
  // Routes configuration
  routes: {
    login: '/auth/login',
    register: '/auth/register',
    logout: '/auth/logout',
    verifyEmail: '/auth/verify-email',
    resetPassword: '/auth/reset-password'
  }
};

// Initialize auth
const authMiddleware = auth(authOptions);
app.use(authMiddleware);

// Create HTTP server
const server = http.createServer(app);

// Create Colyseus server with auth integration
const gameServer = new Server({
  server,
  // Add authentication to Colyseus
  presence: authMiddleware.presence
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

// Register Colyseus monitor
app.use('/colyseus', monitor());

// Start the server
gameServer.listen(port).then(() => {
  console.log(`🎮 Dungeon Dash Royale server running on port ${port}`);
});