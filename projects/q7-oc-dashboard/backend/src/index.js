import express from 'express';
import { WebSocketServer } from 'ws';
import jwt from 'jsonwebtoken';
import { config } from './core/config.js';
import { initSchema } from './models/schema.js';
import './models/db.js';
import authRoutes from './routes/auth.js';
import agentsRoutes from './routes/agents.js';
import tasksRoutes from './routes/tasks.js';
import approvalsRoutes from './routes/approvals.js';
import { authenticate } from './core/auth.js';
import { get_health, get_snapshot } from './adapters/openclaw.js';
import { manager } from './core/websocket.js';
import { handleTelegramWebhook, verifyBot } from './adapters/telegram.js';
import crypto from 'node:crypto';

initSchema();

const app = express();
app.use(express.json());

app.get('/api/health', authenticate, async (_req, res) => {
  const result = await get_health();
  res.setHeader('X-Data-Source', result.is_mock ? 'mock' : 'real');
  res.json(result.data);
});

app.post('/telegram/webhook', async (req, res) => {
  const result = await handleTelegramWebhook(req.body);
  res.json(result);
});

app.use('/auth', authRoutes);
app.use('/api/agents', authenticate, agentsRoutes);
app.use('/api/tasks', authenticate, tasksRoutes);
app.use('/api/approvals', authenticate, approvalsRoutes);

const server = app.listen(config.port, '0.0.0.0', async () => {
  console.log(`Server running on port ${config.port}`);
  const bot = await verifyBot();
  if (bot?.ok) console.log('Telegram bot OK');
});

const wss = new WebSocketServer({ server, path: '/ws' });

wss.on('connection', async (ws, req) => {
  const token = new URL(req.url, `http://localhost:${config.port}`).searchParams.get('token');
  if (token) {
    try {
      jwt.verify(token, config.jwtSecret);
    } catch {
      ws.close();
      return;
    }
  }

  const clientId = crypto.randomUUID();
  manager.add(clientId, ws);

  try {
    const snapshot = await get_snapshot();
    ws.send(JSON.stringify({
      type: 'snapshot',
      payload: snapshot.data
    }));
  } catch (error) {
    ws.send(JSON.stringify({
      type: 'snapshot',
      payload: {
        agents: [],
        health: { health_score: 0, timestamp: new Date().toISOString(), is_mock: true },
        tasks: [],
        is_mock: true,
        error: error?.message || 'snapshot error'
      }
    }));
  }

  ws.on('close', () => manager.remove(clientId));
});

setInterval(async () => {
  const result = await get_health();
  manager.broadcast({ type: 'metric_update', payload: result.data });
}, 15000);
