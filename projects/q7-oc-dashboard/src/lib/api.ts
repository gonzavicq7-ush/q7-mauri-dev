const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export type Agent = {
  id: string;
  name: string;
  role: string;
  status: string;
  current_task_id?: string | null;
  model?: string | null;
  provider?: string | null;
  fallback_model?: string | null;
  tools?: string[];
  health_score?: number;
  tokens_used?: number;
  cost_estimate?: number;
  requires_approval?: boolean;
  last_action?: string;
  last_heartbeat?: string;
  is_mock?: boolean;
  raw?: unknown;
};

export type Task = {
  id: string;
  title: string;
  status: string;
  priority: string;
  progress_pct: number;
  eta?: string;
  started_at?: string;
  blocked_reason?: string;
  next_step?: string;
  partial_result?: string;
  agent_id?: string;
  is_mock?: boolean;
};

export type Alert = {
  id: string;
  title: string;
  severity: string;
  source?: string;
  time?: string;
  status?: string;
  payload?: unknown;
  is_mock?: boolean;
};

export type Approval = {
  id: string;
  approval_id?: string;
  status?: string;
  payload?: unknown;
  timestamp?: string;
  is_mock?: boolean;
};

export type Health = {
  id?: string;
  health_score?: number;
  agents_active?: number;
  agents_error?: number;
  tasks_running?: number;
  tasks_failed?: number;
  timestamp?: string;
  raw?: unknown;
  is_mock?: boolean;
};

export type EventItem = {
  id: string;
  type: string;
  payload?: unknown;
  timestamp?: string;
  is_mock?: boolean;
};

export type ChatMessage = {
  id?: string;
  role: string;
  content: string;
  session_id?: string | null;
  timestamp?: string;
  payload?: unknown;
  is_mock?: boolean;
};

type ApiOptions = RequestInit & { auth?: boolean };

type MockListener = (value: boolean) => void;
const mockListeners = new Set<MockListener>();
let isMockDataFlag = false;

export function subscribeMockFlag(listener: MockListener) {
  mockListeners.add(listener);
  listener(isMockDataFlag);
  return () => mockListeners.delete(listener);
}

export function setMockDataFlag(value: boolean) {
  isMockDataFlag = value;
  for (const listener of mockListeners) listener(value);
}

export function getMockDataFlag() {
  return isMockDataFlag;
}

export async function apiFetch<T = unknown>(path: string, options: ApiOptions = {}): Promise<T> {
  const headers = new Headers(options.headers || {});
  headers.set('Content-Type', 'application/json');
  const token = localStorage.getItem('q7oc_token');
  if (options.auth !== false && token) headers.set('Authorization', `Bearer ${token}`);

  const response = await fetch(`${API_URL}${path}`, { ...options, headers });
  const dataSource = response.headers.get('X-Data-Source');
  if (dataSource === 'mock') setMockDataFlag(true);

  if (response.status === 401) {
    window.dispatchEvent(new CustomEvent('auth:unauthorized'));
    throw new Error('unauthorized');
  }

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) throw new Error(data?.detail || data?.error || 'request failed');
  return data as T;
}

export const api = {
  async login(username: string, password: string): Promise<{ access_token: string; token_type?: string }> {
    return apiFetch('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
      auth: false,
    });
  },

  async getHealth(): Promise<Health> {
    return apiFetch('/api/health');
  },

  async getAgents(filters?: Record<string, string | undefined>): Promise<Agent[]> {
    const query = new URLSearchParams();
    Object.entries(filters || {}).forEach(([key, value]) => {
      if (value) query.set(key, value);
    });
    const suffix = query.toString() ? `?${query.toString()}` : '';
    return apiFetch(`/api/agents${suffix}`);
  },

  async getTasks(filters?: Record<string, string | undefined>): Promise<Task[]> {
    const query = new URLSearchParams();
    Object.entries(filters || {}).forEach(([key, value]) => {
      if (value) query.set(key, value);
    });
    const suffix = query.toString() ? `?${query.toString()}` : '';
    return apiFetch(`/api/tasks${suffix}`);
  },

  async getAlerts(): Promise<Alert[]> {
    try {
      return await apiFetch('/api/alerts');
    } catch {
      return [];
    }
  },

  async getApprovals(): Promise<Approval[]> {
    return apiFetch('/api/approvals?status=pending');
  },

  async getCosts(): Promise<Record<string, unknown>> {
    try {
      return await apiFetch('/api/costs');
    } catch {
      return {};
    }
  },

  async getEvents(limit = 50): Promise<EventItem[]> {
    try {
      return await apiFetch(`/api/events?limit=${limit}`);
    } catch {
      return [];
    }
  },

  async sendChatMessage(sessionId: string, message: string, context?: unknown): Promise<unknown> {
    return apiFetch('/api/chat/message', {
      method: 'POST',
      body: JSON.stringify({ sessionId, message, context }),
    });
  },

  async getChatHistory(sessionId: string): Promise<ChatMessage[]> {
    try {
      return await apiFetch(`/api/chat/history/${sessionId}`);
    } catch {
      return [];
    }
  },

  async taskAction(taskId: string, action: string, params?: unknown): Promise<unknown> {
    return apiFetch(`/api/tasks/${taskId}/actions`, {
      method: 'POST',
      body: JSON.stringify({ action, params }),
    });
  },

  async approveAction(approvalId: string): Promise<unknown> {
    return apiFetch(`/api/approvals/${approvalId}/approve`, { method: 'POST' });
  },

  async rejectAction(approvalId: string, reason: string): Promise<unknown> {
    return apiFetch(`/api/approvals/${approvalId}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  },
};
