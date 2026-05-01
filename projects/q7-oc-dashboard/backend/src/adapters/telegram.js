import cron from 'node-cron';
import { config } from '../core/config.js';
import { db } from '../models/db.js';
import { manager } from '../core/websocket.js';
import { send_approval, send_rejection } from './openclaw.js';

const apiBase = config.telegramBotToken ? `https://api.telegram.org/bot${config.telegramBotToken}` : null;
const lastNotifications = new Map();
const grouped = new Map();
let warned = false;

function canNotify(key) {
  const last = lastNotifications.get(key) || 0;
  if (Date.now() - last < config.notifMinIntervalSec * 1000) return false;
  lastNotifications.set(key, Date.now());
  return true;
}

async function telegramCall(method, payload) {
  if (!apiBase) {
    if (!warned) {
      console.warn('[telegram] TELEGRAM_BOT_TOKEN no configurado; módulo desactivado');
      warned = true;
    }
    return { ok: false, pending: true };
  }
  const response = await fetch(`${apiBase}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  return response.json();
}

function formatMessage(type, name, detailLines) {
  return [`Openclaw · ${type} · ${name}`, ...detailLines.slice(0, 3)].join('\n');
}

export async function verifyBot() {
  if (!apiBase) return { ok: false, pending: true, reason: 'token no configurado' };
  return telegramCall('getMe', {});
}

export async function notify_error(agent_name, error_detail) {
  if (!canNotify(`error:${agent_name}`)) return { ok: false, skipped: true };
  return telegramCall('sendMessage', {
    chat_id: config.telegramChatId,
    text: formatMessage('ERROR', agent_name, [error_detail])
  });
}

export async function notify_approval_required(approval) {
  if (!canNotify(`approval:${approval.agent_id || approval.id}`)) return { ok: false, skipped: true };
  return telegramCall('sendMessage', {
    chat_id: config.telegramChatId,
    text: formatMessage('APROBACIÓN', approval.action_description || approval.id, [approval.impact_estimate || 'Pendiente de decisión']),
    reply_markup: {
      inline_keyboard: [[
        { text: 'Aprobar ✓', callback_data: `approve:${approval.id}` },
        { text: 'Rechazar ✗', callback_data: `reject:${approval.id}` },
        { text: 'Ver detalle', callback_data: `detail:${approval.id}` }
      ]]
    }
  });
}

export async function notify_task_completed(task, summary) {
  if (!canNotify(`task:${task.id}`)) return { ok: false, skipped: true };
  return telegramCall('sendMessage', {
    chat_id: config.telegramChatId,
    text: formatMessage('COMPLETADA', task.title || task.id, [summary])
  });
}

export async function notify_agent_stalled(agent, minutes) {
  if (!canNotify(`stall:${agent.id}`)) return { ok: false, skipped: true };
  return telegramCall('sendMessage', {
    chat_id: config.telegramChatId,
    text: formatMessage('ESTANCADO', agent.name || agent.id, [`Sin avanzar hace ${minutes} minutos`])
  });
}

export async function send_daily_summary(stats) {
  return telegramCall('sendMessage', {
    chat_id: config.telegramChatId,
    text: formatMessage('RESUMEN', 'Diario', [JSON.stringify(stats)])
  });
}

export async function handleTelegramWebhook(body) {
  const data = body?.callback_query;
  if (!data) return { ok: true, ignored: true };

  const [action, approvalId] = String(data.data || '').split(':');
  const approval = db.prepare('SELECT * FROM approvals WHERE id = ?').get(approvalId);
  if (!approval) return { ok: false, error: 'Approval not found' };
  if (approval.status && approval.status !== 'pending') {
    await telegramCall('answerCallbackQuery', {
      callback_query_id: data.id,
      text: 'Ya procesado'
    });
    return { ok: true, alreadyProcessed: true };
  }

  if (action === 'approve') {
    await send_approval(approvalId);
    db.prepare('UPDATE approvals SET status = ?, decided_at = ?, decided_via = ?, telegram_message_id = ?, updated_at = ? WHERE id = ?')
      .run('approved', new Date().toISOString(), 'telegram', String(data.message?.message_id || ''), new Date().toISOString(), approvalId);
    manager.broadcast({ type: 'telegram_sync', payload: { approval_id: approvalId, status: 'approved' } });
    db.prepare('INSERT INTO audit_logs (id, action, object_type, object_id, user, payload, timestamp, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run(`audit-${Date.now()}`, 'approve', 'approval', approvalId, 'telegram', JSON.stringify(body), new Date().toISOString(), new Date().toISOString(), new Date().toISOString());
    await telegramCall('answerCallbackQuery', {
      callback_query_id: data.id,
      text: `✓ Aprobado por Telegram — ${new Date().toISOString()}`
    });
    return { ok: true };
  }

  if (action === 'reject') {
    await send_rejection(approvalId, 'Rejected via Telegram');
    db.prepare('UPDATE approvals SET status = ?, decided_at = ?, decided_via = ?, telegram_message_id = ?, updated_at = ? WHERE id = ?')
      .run('rejected', new Date().toISOString(), 'telegram', String(data.message?.message_id || ''), new Date().toISOString(), approvalId);
    manager.broadcast({ type: 'telegram_sync', payload: { approval_id: approvalId, status: 'rejected' } });
    db.prepare('INSERT INTO audit_logs (id, action, object_type, object_id, user, payload, timestamp, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run(`audit-${Date.now()}`, 'reject', 'approval', approvalId, 'telegram', JSON.stringify(body), new Date().toISOString(), new Date().toISOString(), new Date().toISOString());
    await telegramCall('answerCallbackQuery', {
      callback_query_id: data.id,
      text: `✓ Rechazado por Telegram — ${new Date().toISOString()}`
    });
    return { ok: true };
  }

  return { ok: true, ignored: true };
}

if (config.telegramBotToken) {
  cron.schedule(`0 ${config.notifDailySummaryTime.split(':')[1]} ${config.notifDailySummaryTime.split(':')[0]} * * *`, async () => {
    await send_daily_summary({ note: 'summary placeholder' });
  });
} else if (!warned) {
  console.warn('[telegram] TELEGRAM_BOT_TOKEN no configurado; módulo desactivado');
  warned = true;
}
