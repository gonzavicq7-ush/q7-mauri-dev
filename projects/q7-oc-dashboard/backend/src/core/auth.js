import jwt from 'jsonwebtoken';
import { config } from './config.js';

const devUsers = {
  admin: { username: 'admin', password: 'admin', role: 'admin' },
  viewer: { username: 'viewer', password: 'viewer', role: 'viewer' }
};

export function signToken(user) {
  return jwt.sign({ sub: user.username, role: user.role }, config.jwtSecret, { expiresIn: '12h' });
}

export function authenticate(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Unauthorized', code: 'AUTH_REQUIRED', detail: 'Missing bearer token' });
  try {
    req.user = jwt.verify(token, config.jwtSecret);
    next();
  } catch {
    return res.status(401).json({ error: 'Unauthorized', code: 'AUTH_INVALID', detail: 'Invalid token' });
  }
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden', code: 'FORBIDDEN', detail: 'Insufficient role' });
    }
    next();
  };
}

export function loginDev(username, password) {
  const user = devUsers[username];
  if (!user || user.password !== password) return null;
  return { username: user.username, role: user.role };
}
