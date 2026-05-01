import express from 'express';
import { get_tasks, get_task } from '../adapters/openclaw.js';

const router = express.Router();

router.get('/', async (_req, res) => {
  const result = await get_tasks();
  res.setHeader('X-Data-Source', result.is_mock ? 'mock' : 'real');
  res.json(result.data);
});

router.get('/:id', async (req, res) => {
  const result = await get_task(req.params.id);
  res.setHeader('X-Data-Source', result.is_mock ? 'mock' : 'real');
  if (!result.data) return res.status(404).json({ error: 'Not found', code: 'TASK_NOT_FOUND', detail: 'Task not found' });
  res.json(result.data);
});

export default router;
