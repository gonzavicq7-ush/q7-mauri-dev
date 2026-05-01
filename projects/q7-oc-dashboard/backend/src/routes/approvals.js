import express from 'express';
import { db } from '../models/db.js';
import { send_approval, send_rejection } from '../adapters/openclaw.js';

const router = express.Router();

router.get('/', (req, res) => {
  const status = req.query.status || 'pending';
  const rows = db.prepare('SELECT * FROM approvals WHERE status = ?').all(status);
  res.setHeader('X-Data-Source', 'mock');
  res.json(rows);
});

router.post('/:id/approve', async (req, res) => {
  await send_approval(req.params.id);
  res.json({ ok: true });
});

router.post('/:id/reject', async (req, res) => {
  await send_rejection(req.params.id, req.body?.reason || 'Rejected');
  res.json({ ok: true });
});

export default router;
