import { useEffect, useRef, useState } from 'react';
import { useAgentsStore } from '../store/agentsStore';
import { useAppStore } from '../store/appStore';
import { useTasksStore } from '../store/tasksStore';
import { useChatStore } from '../store/chatStore';

const WS_BASE_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:3001';

export function useWebSocket(token?: string) {
  const [isConnected, setIsConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState<unknown>(null);
  const retryRef = useRef(1000);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    let ws: WebSocket | null = null;
    let cancelled = false;

    const connect = () => {
      if (cancelled) return;
      const url = token ? `${WS_BASE_URL}/ws?token=${encodeURIComponent(token)}` : `${WS_BASE_URL}/ws`;
      ws = new WebSocket(url);

      ws.onopen = () => {
        setIsConnected(true);
        useAppStore.getState().setConnected(true);
        retryRef.current = 1000;
      };

      ws.onmessage = (event) => {
        const payload = JSON.parse(event.data);
        setLastEvent(payload);

        if (payload?.type === 'snapshot') {
          useAgentsStore.getState().replaceAgents(payload.payload?.agents || []);
          useTasksStore.getState().replaceTasks(payload.payload?.tasks || []);
          useAppStore.getState().setHealth(payload.payload?.health || null);
          useAppStore.getState().setMockData(Boolean(payload.payload?.is_mock));
        }

        if (payload?.type === 'metric_update') {
          useAppStore.getState().setHealth(payload.payload || null);
        }

        if (payload?.type === 'agent_updated' && payload.payload) {
          const raw = payload.payload?.payload || payload.payload;
          const normalized = {
            id: raw.id || raw.agentId || `agent-${Date.now()}`,
            name: raw.name || raw.agentId || raw.id || 'agent',
            role: raw.role || 'operator',
            status: raw.status || 'active',
            current_task_id: raw.current_task_id || raw.currentTaskId || null,
            model: raw.model || null,
            provider: raw.provider || null,
            fallback_model: raw.fallback_model || null,
            tools: Array.isArray(raw.tools) ? raw.tools : [],
            health_score: raw.health_score || 100,
            tokens_used: raw.tokens_used || 0,
            cost_estimate: raw.cost_estimate || 0,
            requires_approval: Boolean(raw.requires_approval),
            last_action: raw.last_action || 'gateway update',
            last_heartbeat: raw.last_heartbeat || new Date().toISOString(),
            is_mock: false,
            raw,
          };
          useAgentsStore.getState().upsertAgent(normalized);
        }

        if (payload?.type === 'task_updated' && payload.payload) {
          useTasksStore.getState().upsertTask(payload.payload);
        }

        if (payload?.type === 'approval_pending') {
          useAppStore.getState().incrementPendingApprovals();
        }

        if (payload?.type === 'chat_response') {
          const sessionId = payload.payload?.session_id || payload.payload?.sessionKey || payload.session_id || 'agent:main:telegram:direct:8646271102';
          const content = payload.payload?.content || payload.payload?.payload?.content || JSON.stringify(payload.payload);
          useChatStore.getState().appendMessage(sessionId, {
            role: 'assistant',
            content,
            session_id: sessionId,
            timestamp: payload.payload?.timestamp || new Date().toISOString(),
          });
        }
      };

      ws.onclose = () => {
        setIsConnected(false);
        useAppStore.getState().setConnected(false);
        timerRef.current = window.setTimeout(connect, retryRef.current);
        retryRef.current = Math.min(retryRef.current * 2, 30000);
      };

      ws.onerror = () => {
        ws?.close();
      };
    };

    connect();

    return () => {
      cancelled = true;
      if (timerRef.current) window.clearTimeout(timerRef.current);
      ws?.close();
    };
  }, [token]);

  return { isConnected, lastEvent };
}
