import express from 'express';
import { get_agents, get_agent } from '../adapters/openclaw.js';

const router = express.Router();

router.get('/', async (req, res) => {
  const result = await get_agents();
  res.setHeader('X-Data-Source', result.is_mock ? 'mock' : 'real');
  res.json(result.data);
});

router.get('/:id', async (req, res) => {
  const result = await get_agent(req.params.id);
  res.setHeader('X-Data-Source', result.is_mock ? 'mock' : 'real');
  if (!result.data) return res.status(404).json({ error: 'Not found', code: 'AGENT_NOT_FOUND', detail: 'Agent not found' });
  res.json(result.data);
});

export default router;
