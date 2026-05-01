import { db } from './db.js';

const now = "strftime('%Y-%m-%dT%H:%M:%fZ','now')";

const statements = [
  `CREATE TABLE IF NOT EXISTS agents (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    role TEXT,
    status TEXT,
    current_task_id TEXT,
    model TEXT,
    provider TEXT,
    fallback_model TEXT,
    tools TEXT,
    health_score REAL DEFAULT 0,
    tokens_used INTEGER DEFAULT 0,
    cost_estimate REAL DEFAULT 0,
    requires_approval INTEGER DEFAULT 0,
    last_action TEXT,
    last_heartbeat TEXT,
    created_at TEXT DEFAULT (${now}),
    updated_at TEXT DEFAULT (${now})
  )`,
  `CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    priority TEXT,
    status TEXT,
    agent_id TEXT,
    progress_pct REAL DEFAULT 0,
    eta TEXT,
    started_at TEXT,
    blocked_reason TEXT,
    next_step TEXT,
    partial_result TEXT,
    created_at TEXT DEFAULT (${now}),
    updated_at TEXT DEFAULT (${now})
  )`,
  `CREATE TABLE IF NOT EXISTS alerts (
    id TEXT PRIMARY KEY,
    severity TEXT,
    type TEXT,
    cause TEXT,
    impact TEXT,
    object_id TEXT,
    object_type TEXT,
    recommendation TEXT,
    resolved_at TEXT,
    created_at TEXT DEFAULT (${now}),
    updated_at TEXT DEFAULT (${now})
  )`,
  `CREATE TABLE IF NOT EXISTS model_usage (
    id TEXT PRIMARY KEY,
    agent_id TEXT,
    model TEXT,
    provider TEXT,
    tokens_in INTEGER DEFAULT 0,
    tokens_out INTEGER DEFAULT 0,
    cost REAL DEFAULT 0,
    timestamp TEXT,
    created_at TEXT DEFAULT (${now}),
    updated_at TEXT DEFAULT (${now})
  )`,
  `CREATE TABLE IF NOT EXISTS events (
    id TEXT PRIMARY KEY,
    type TEXT,
    agent_id TEXT,
    task_id TEXT,
    payload TEXT,
    timestamp TEXT,
    created_at TEXT DEFAULT (${now}),
    updated_at TEXT DEFAULT (${now})
  )`,
  `CREATE TABLE IF NOT EXISTS approvals (
    id TEXT PRIMARY KEY,
    agent_id TEXT,
    task_id TEXT,
    action_description TEXT,
    impact_estimate TEXT,
    status TEXT,
    decided_at TEXT,
    decided_via TEXT,
    telegram_message_id TEXT,
    created_at TEXT DEFAULT (${now}),
    updated_at TEXT DEFAULT (${now})
  )`,
  `CREATE TABLE IF NOT EXISTS chat_sessions (
    id TEXT PRIMARY KEY,
    mode TEXT,
    context_type TEXT,
    context_id TEXT,
    started_at TEXT,
    created_at TEXT DEFAULT (${now}),
    updated_at TEXT DEFAULT (${now})
  )`,
  `CREATE TABLE IF NOT EXISTS chat_messages (
    id TEXT PRIMARY KEY,
    session_id TEXT,
    role TEXT,
    content TEXT,
    model_used TEXT,
    agent_id TEXT,
    message_type TEXT,
    timestamp TEXT,
    created_at TEXT DEFAULT (${now}),
    updated_at TEXT DEFAULT (${now})
  )`,
  `CREATE TABLE IF NOT EXISTS integration_status (
    id TEXT PRIMARY KEY,
    name TEXT,
    status TEXT,
    last_check TEXT,
    error_detail TEXT,
    created_at TEXT DEFAULT (${now}),
    updated_at TEXT DEFAULT (${now})
  )`,
  `CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    action TEXT,
    object_type TEXT,
    object_id TEXT,
    user TEXT,
    payload TEXT,
    timestamp TEXT,
    created_at TEXT DEFAULT (${now}),
    updated_at TEXT DEFAULT (${now})
  )`,
  `CREATE TABLE IF NOT EXISTS system_health (
    id TEXT PRIMARY KEY,
    health_score REAL DEFAULT 0,
    agents_active INTEGER DEFAULT 0,
    agents_error INTEGER DEFAULT 0,
    tasks_running INTEGER DEFAULT 0,
    tasks_failed INTEGER DEFAULT 0,
    timestamp TEXT,
    created_at TEXT DEFAULT (${now}),
    updated_at TEXT DEFAULT (${now})
  )`,
  `CREATE TABLE IF NOT EXISTS cost_metrics (
    id TEXT PRIMARY KEY,
    date TEXT,
    total_tokens INTEGER DEFAULT 0,
    total_cost REAL DEFAULT 0,
    breakdown_by_model TEXT,
    created_at TEXT DEFAULT (${now}),
    updated_at TEXT DEFAULT (${now})
  )`
];

export function initSchema() {
  for (const sql of statements) db.exec(sql);
}
