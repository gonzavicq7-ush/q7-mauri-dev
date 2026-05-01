import express from 'express';
import { loginDev, signToken, authenticate } from '../core/auth.js';

const router = express.Router();

router.post('/login', (req, res) => {
  const { username, password } = req.body || {};
  const user = loginDev(username, password);
  if (!user) return res.status(401).json({ error: 'Unauthorized', code: 'LOGIN_FAILED', detail: 'Invalid credentials' });
  return res.json({ access_token: signToken(user), token_type: 'bearer' });
});

router.get('/me', authenticate, (req, res) => {
  res.json({ username: req.user.sub, role: req.user.role });
});

export default router;
