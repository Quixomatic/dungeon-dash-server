// auth/controllers.js
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma.js';
import { validateEmail, validatePassword } from '../lib/validators.js';

// Environment variables (should be in .env)
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';
const REFRESH_SECRET = process.env.REFRESH_SECRET || 'dev-refresh-secret';
const ACCESS_TOKEN_EXPIRY = '15m'; // 15 minutes
const REFRESH_TOKEN_EXPIRY = '7d'; // 7 days

export async function registerUser(req, res) {
  try {
    const { email, password, username, displayName } = req.body;
    
    // Validate input
    if (!email || !password || !username) {
      return res.status(400).json({ error: 'Email, password and username are required' });
    }
    
    if (!validateEmail(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }
    
    if (!validatePassword(password)) {
      return res.status(400).json({ 
        error: 'Password must be at least 8 characters and include a number and special character' 
      });
    }
    
    // Check if user already exists
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { email },
          { username }
        ]
      }
    });
    
    if (existingUser) {
      return res.status(409).json({ error: 'User already exists' });
    }
    
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Create user with profile in a transaction
    const user = await prisma.$transaction(async (prisma) => {
      // Create user
      const newUser = await prisma.user.create({
        data: {
          email,
          password: hashedPassword,
          username,
          playerProfile: {
            create: {
              displayName: displayName || username,
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
      
      return newUser;
    });
    
    // Generate tokens
    const tokens = generateTokens(user);
    
    // Return user data and tokens
    return res.status(201).json({
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        displayName: user.playerProfile.displayName
      },
      ...tokens
    });
  } catch (error) {
    console.error('Registration error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

export async function loginUser(req, res) {
  try {
    const { email, username, password } = req.body;
    
    // Require either email or username
    if (!email && !username) {
      return res.status(400).json({ error: 'Email or username is required' });
    }
    
    if (!password) {
      return res.status(400).json({ error: 'Password is required' });
    }
    
    // Find user
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { email },
          { username }
        ]
      },
      include: {
        playerProfile: true
      }
    });
    
    if (!user || !user.password) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    // Verify password
    const passwordValid = await bcrypt.compare(password, user.password);
    if (!passwordValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    // Generate tokens
    const tokens = generateTokens(user);
    
    // Return user data and tokens
    return res.status(200).json({
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        displayName: user.playerProfile.displayName
      },
      ...tokens
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

export async function refreshToken(req, res) {
  try {
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
      return res.status(400).json({ error: 'Refresh token is required' });
    }
    
    // Verify refresh token
    let decoded;
    try {
      decoded = jwt.verify(refreshToken, REFRESH_SECRET);
    } catch (error) {
      return res.status(401).json({ error: 'Invalid refresh token' });
    }
    
    // Find user
    const user = await prisma.user.findUnique({
      where: { id: decoded.sub },
      include: {
        playerProfile: true
      }
    });
    
    if (!user) {
      return res.status(401).json({ error: 'Invalid refresh token' });
    }
    
    // Generate new tokens
    const tokens = generateTokens(user);
    
    return res.status(200).json(tokens);
  } catch (error) {
    console.error('Token refresh error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

export async function validateToken(req, res) {
  try {
    const { token } = req.body;
    
    if (!token) {
      return res.status(400).json({ error: 'Token is required' });
    }
    
    // Verify token
    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (error) {
      return res.status(401).json({ error: 'Invalid token' });
    }
    
    // Find user
    const user = await prisma.user.findUnique({
      where: { id: decoded.sub }
    });
    
    if (!user) {
      return res.status(401).json({ error: 'Invalid token' });
    }
    
    // Return successful validation
    return res.status(200).json({ valid: true, userId: user.id });
  } catch (error) {
    console.error('Token validation error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// Helper function to generate tokens
function generateTokens(user) {
  // Access token payload
  const accessPayload = {
    sub: user.id,
    email: user.email,
    username: user.username
  };
  
  // Refresh token payload (minimal)
  const refreshPayload = {
    sub: user.id
  };
  
  // Generate tokens
  const accessToken = jwt.sign(accessPayload, JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRY });
  const refreshToken = jwt.sign(refreshPayload, REFRESH_SECRET, { expiresIn: REFRESH_TOKEN_EXPIRY });
  
  return {
    accessToken,
    refreshToken,
    expiresIn: ACCESS_TOKEN_EXPIRY
  };
}