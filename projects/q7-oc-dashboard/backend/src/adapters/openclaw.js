import { WebSocket } from 'ws';
import { config } from '../core/config.js';
import { manager } from '../core/websocket.js';

const TTL_MS = 15000;
const cache = new Map();
const pending = new Map();
const eventBuffer = [];
const MAX_EVENT_BUFFER = 200;

let ws = null;
let connected = false;
let gatewaySnapshot = null;
let reconnectDelayMs = 1000;
let reconnectTimer = null;
let connectMessageId = 0;
let connectChallengeSeen = false;
let subscriptionsSent = false;

function now() {
  return Date.now();
}

function nextId(prefix = 'req') {
  connectMessageId += 1;
  return `${prefix}-${connectMessageId}`;
}

function withMockFlag(payload, isMock = true) {
  if (Array.isArray(payload)) {
    return payload.map((item) => ({ ...item, is_mock: isMock }));
  }
  if (payload && typeof payload === 'object') {
    return { ...payload, is_mock: isMock };
  }
  return payload;
}

function getCached(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (now() - entry.timestamp > TTL_MS) {
    cache.delete(key);
    return null;
  }
  return entry.value;
}

function setCached(key, value) {
  cache.set(key, { value, timestamp: now() });
}

function clearCaches() {
  cache.clear();
}

function mapHealthAgentsFromSnapshot(snapshot) {
  const list = Array.isArray(snapshot?.health?.agents) ? snapshot.health.agents : [];
  return list.map((agent, index) => ({
    id: agent.agentId || agent.id || `agent-${index + 1}`,
    name: agent.name || agent.agentId || agent.id || `agent-${index + 1}`,
    role: agent.role || 'operator',
    status: 'active',
    current_task_id: null,
    model: agent.model || null,
    provider: agent.provider || null,
    fallback_model: agent.fallback_model || null,
    tools: Array.isArray(agent.tools) ? agent.tools : [],
    health_score: 100,
    tokens_used: 0,
    cost_estimate: 0,
    requires_approval: false,
    last_action: 'gateway snapshot',
    last_heartbeat: new Date().toISOString(),
    raw: agent,
    is_mock: false
  }));
}

function pushEvent(event) {
  eventBuffer.unshift(event);
  if (eventBuffer.length > MAX_EVENT_BUFFER) eventBuffer.length = MAX_EVENT_BUFFER;
}

function normalizeMetricUpdate(payload) {
  const base = payload && typeof payload === 'object' ? payload : {};
  return {
    id: `health-${Date.now()}`,
    health_score: base.ok === true ? 100 : 0,
    agents_active: Array.isArray(base.agents) ? base.agents.length : 0,
    agents_error: 0,
    tasks_running: Array.isArray(base.sessions?.recent) ? base.sessions.recent.length : 0,
    tasks_failed: 0,
    timestamp: new Date().toISOString(),
    raw: base,
    is_mock: false
  };
}

function mapApprovalRequested(payload) {
  const approvalId = payload?.approvalId || payload?.id || payload?.requestId || `approval-${Date.now()}`;
  return {
    id: approvalId,
    type: 'approval_pending',
    approval_id: approvalId,
    status: 'pending',
    payload,
    timestamp: new Date().toISOString(),
    is_mock: false
  };
}

function mapChatResponse(payload) {
  return {
    id: payload?.messageId || payload?.id || `chat-${Date.now()}`,
    type: 'chat_response',
    session_id: payload?.sessionKey || payload?.session_id || payload?.sessionId || null,
    payload,
    timestamp: new Date().toISOString(),
    is_mock: false
  };
}

function mapAgentUpdated(payload) {
  return {
    id: `agent-${Date.now()}`,
    type: 'agent_updated',
    payload,
    timestamp: new Date().toISOString(),
    is_mock: false
  };
}

function broadcast(type, payload) {
  manager.broadcast({ type, payload });
}

function handleGatewayEvent(event, payload) {
  if (event === 'health') {
    if (!gatewaySnapshot) gatewaySnapshot = {};
    gatewaySnapshot.health = payload;
    const mapped = normalizeMetricUpdate(payload);
    setCached('health', { data: mapped, is_mock: false });
    setCached('agents', { data: mapHealthAgentsFromSnapshot(gatewaySnapshot), is_mock: false });
    pushEvent({ id: `evt-health-${Date.now()}`, type: 'metric_update', payload: mapped, timestamp: new Date().toISOString(), is_mock: false });
    broadcast('metric_update', mapped);
    return;
  }

  if (event === 'exec.approval.requested') {
    const mapped = mapApprovalRequested(payload);
    pushEvent(mapped);
    broadcast('approval_pending', mapped);
    return;
  }

  if (event === 'session.message') {
    const mapped = mapChatResponse(payload);
    pushEvent(mapped);
    broadcast('chat_response', mapped);
    return;
  }

  if (event === 'sessions.changed') {
    const mapped = mapAgentUpdated(payload);
    clearCaches();
    pushEvent(mapped);
    broadcast('agent_updated', mapped);
    return;
  }

  if (event === 'chat') {
    const mapped = mapChatResponse(payload);
    pushEvent(mapped);
    broadcast('chat_response', mapped);
    return;
  }

  if (event === 'tick' || event === 'heartbeat' || event === 'exec.approval.resolved') {
    pushEvent({ id: `evt-${event}-${Date.now()}`, type: event, payload, timestamp: new Date().toISOString(), is_mock: false });
  }
}

function scheduleReconnect() {
  if (reconnectTimer) return;
  const delay = reconnectDelayMs;
  reconnectDelayMs = Math.min(reconnectDelayMs * 2, 30000);
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connectGateway();
  }, delay);
}

function cleanupSocket() {
  if (ws) {
    try {
      ws.removeAllListeners();
      ws.terminate();
    } catch {}
  }
  ws = null;
  connected = false;
  connectChallengeSeen = false;
  subscriptionsSent = false;
  for (const [, request] of pending.entries()) {
    clearTimeout(request.timeout);
    request.reject(new Error('gateway disconnected'));
  }
  pending.clear();
}

function sendFrame(frame) {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    throw new Error('gateway not connected');
  }
  ws.send(JSON.stringify(frame));
}

function request(method, params = {}) {
  return new Promise((resolve, reject) => {
    if (!ws || ws.readyState !== WebSocket.OPEN || !connected) {
      reject(new Error(`gateway not connected for method ${method}`));
      return;
    }
    const id = nextId(method.replace(/[^a-z0-9]+/gi, '-').toLowerCase());
    const timeout = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`timeout waiting for ${method}`));
    }, 15000);
    pending.set(id, { resolve, reject, timeout, method });
    sendFrame({ type: 'req', id, method, params });
  });
}

function subscribeEvents() {
  if (subscriptionsSent || !connected) return;
  subscriptionsSent = true;
  const events = [
    'tick',
    'health',
    'exec.approval.requested',
    'exec.approval.resolved',
    'session.message',
    'chat',
    'sessions.changed',
    'heartbeat'
  ];
  for (const eventName of events) {
    request('sessions.subscribe', { event: eventName }).catch(() => {});
  }
}

function sendConnectFrame() {
  const token = process.env.OPENCLAW_GATEWAY_TOKEN || process.env.OPENCLAW_GATEWAY_AUTH_TOKEN || '';
  sendFrame({
    type: 'req',
    id: nextId('connect'),
    method: 'connect',
    params: {
      minProtocol: 3,
      maxProtocol: 3,
      client: {
        id: 'gateway-client',
        version: '1.0.0',
        platform: 'linux',
        mode: 'backend'
      },
      role: 'operator',
      scopes: ['operator.admin', 'operator.read', 'operator.write'],
      caps: [],
      auth: { token }
    }
  });
}

function handleMessage(raw) {
  let msg;
  try {
    msg = JSON.parse(raw.toString());
  } catch {
    return;
  }

  if (msg?.type === 'event' && msg.event === 'connect.challenge') {
    connectChallengeSeen = true;
    sendConnectFrame();
    return;
  }

  if (msg?.type === 'res') {
    if (msg.ok === true && msg.payload?.type === 'hello-ok') {
      gatewaySnapshot = msg.payload?.snapshot || null;
      connected = true;
      reconnectDelayMs = 1000;
      setCached('health', { data: normalizeMetricUpdate(msg.payload?.snapshot?.health || { ok: true }), is_mock: false });
      setCached('agents', { data: mapHealthAgentsFromSnapshot(gatewaySnapshot), is_mock: false });
      subscribeEvents();
      return;
    }

    const pendingRequest = pending.get(msg.id);
    if (pendingRequest) {
      pending.delete(msg.id);
      clearTimeout(pendingRequest.timeout);
      if (msg.ok) pendingRequest.resolve(msg.payload);
      else pendingRequest.reject(new Error(msg.error?.message || `gateway error on ${pendingRequest.method}`));
      return;
    }
  }

  if (msg?.type === 'event') {
    handleGatewayEvent(msg.event, msg.payload);
  }
}

function connectGateway() {
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return;

  const url = process.env.OPENCLAW_WS_URL || 'ws://127.0.0.1:18789/';
  ws = new WebSocket(url);
  connected = false;
  connectChallengeSeen = false;
  subscriptionsSent = false;

  ws.on('open', () => {
    reconnectDelayMs = 1000;
  });

  ws.on('message', handleMessage);

  ws.on('close', () => {
    cleanupSocket();
    scheduleReconnect();
  });

  ws.on('error', () => {
    cleanupSocket();
    scheduleReconnect();
  });

  setTimeout(() => {
    if (!connected && ws && connectChallengeSeen === false) {
      try {
        ws.close();
      } catch {}
    }
  }, 15000).unref?.();
}

connectGateway();

const mock = {
  agents: [
    {
      id: 'agent-main', name: 'Mauri', role: 'operator', status: 'active', current_task_id: 'task-001',
      model: 'openai-codex/gpt-5.4', provider: 'openai', fallback_model: 'google/gemini-2.5-flash',
      tools: ['exec', 'read', 'write'], health_score: 92, tokens_used: 12444, cost_estimate: 3.12,
      requires_approval: false, last_action: 'dashboard build', last_heartbeat: new Date().toISOString(), is_mock: true
    }
  ],
  health: {
    id: 'health-001', health_score: 0, agents_active: 0, agents_error: 1, tasks_running: 0, tasks_failed: 0, timestamp: new Date().toISOString(), is_mock: true
  }
};

async function getOrFetch(key, producer, fallback) {
  const cached = getCached(key);
  if (cached) return cached;
  try {
    const data = await producer();
    const result = { data: withMockFlag(data, false), is_mock: false };
    setCached(key, result);
    return result;
  } catch (error) {
    console.error('[DEBUG agents.list ERROR]', error?.message, error?.stack);
    const result = { data: withMockFlag(fallback, true), is_mock: true };
    setCached(key, result);
    return result;
  }
}

function mapAgentsList(payload) {
  const list = Array.isArray(payload) ? payload : Array.isArray(payload?.agents) ? payload.agents : [];
  return list.map((agent, index) => ({
    id: agent.agentId || agent.id || `agent-${index + 1}`,
    name: agent.name || agent.agentId || agent.id || `agent-${index + 1}`,
    role: agent.role || 'operator',
    status: agent.status || 'unknown',
    current_task_id: agent.currentTaskId || agent.current_task_id || null,
    model: agent.model || null,
    provider: agent.provider || null,
    fallback_model: agent.fallback_model || null,
    tools: Array.isArray(agent.tools) ? agent.tools : [],
    health_score: typeof agent.health_score === 'number' ? agent.health_score : 0,
    tokens_used: typeof agent.tokens_used === 'number' ? agent.tokens_used : 0,
    cost_estimate: typeof agent.cost_estimate === 'number' ? agent.cost_estimate : 0,
    requires_approval: Boolean(agent.requires_approval),
    last_action: agent.last_action || '',
    last_heartbeat: agent.last_heartbeat || new Date().toISOString(),
    raw: agent,
    is_mock: false
  }));
}

export async function get_agents() {
  if (connected) {
    const cached = getCached('agents');
    if (cached) return cached;
    const data = mapHealthAgentsFromSnapshot(gatewaySnapshot);
    const result = { data, is_mock: false };
    setCached('agents', result);
    return result;
  }
  return { data: withMockFlag(mock.agents, true), is_mock: true };
}

export async function get_agent(id) {
  const result = await get_agents();
  return { data: result.data.find((a) => a.id === id) || null, is_mock: result.is_mock };
}

export async function get_tasks() {
  return { data: [], is_mock: !connected };
}

export async function get_task(id) {
  const result = await get_tasks();
  return { data: result.data.find((t) => t.id === id) || null, is_mock: result.is_mock };
}

export async function get_events(limit = 50) {
  return { data: eventBuffer.slice(0, limit).map((item) => ({ ...item, is_mock: false })), is_mock: !connected };
}

export async function get_snapshot() {
  const agents = await get_agents();
  const health = await get_health();
  const tasks = await get_tasks();
  return {
    data: {
      agents: agents.data,
      health: health.data,
      tasks: tasks.data,
      is_mock: Boolean(agents.is_mock || health.is_mock || tasks.is_mock)
    },
    is_mock: Boolean(agents.is_mock || health.is_mock || tasks.is_mock)
  };
}

export async function get_model_usage() {
  return { data: [], is_mock: !connected };
}

export async function get_costs_summary() {
  return { data: { total_tokens: 0, total_cost: 0, breakdown_by_model: {}, is_mock: !connected }, is_mock: !connected };
}

export async function send_approval(approval_id) {
  await request('exec.approval.resolve', { approvalId: approval_id, decision: 'approve' });
  return { data: true, is_mock: false };
}

export async function send_rejection(approval_id, reason) {
  await request('exec.approval.resolve', { approvalId: approval_id, decision: 'reject', reason });
  return { data: true, is_mock: false };
}

export async function send_chat_message(session_id, message, context) {
  const payload = await request('sessions.send', {
    sessionKey: session_id,
    message,
    context
  });
  return { data: payload, is_mock: false };
}

export async function get_health() {
  const cached = getCached('health');
  if (cached) return cached;
  if (connected) {
    const data = normalizeMetricUpdate({ ok: true });
    const result = { data, is_mock: false };
    setCached('health', result);
    return result;
  }
  return { data: mock.health, is_mock: true };
}

export function is_openclaw_connected() {
  return connected;
}
