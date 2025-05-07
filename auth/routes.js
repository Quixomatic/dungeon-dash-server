// auth/routes.js
import express from 'express';
import { registerUser, loginUser, refreshToken, validateToken } from './controllers.js';

const router = express.Router();

// Registration endpoint
router.post('/register', registerUser);

// Login endpoint
router.post('/login', loginUser);

// Token refresh endpoint
router.post('/refresh', refreshToken);

// Token validation endpoint (for WebSocket auth)
router.post('/validate', validateToken);

export default router;