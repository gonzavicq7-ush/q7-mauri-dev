import { useEffect, useMemo, useState } from 'react';
import { AppShell } from './layout/AppShell';
import { useWebSocket } from './lib/useWebSocket';
import { api } from './lib/api';
import { useAppStore } from './store/appStore';
import { OverviewPage, AgentsPage, TasksPage, AlertsPage, ChatPage, IntegrationsPage, AuditPage, SettingsPage } from './pages/pages';
import { useAgentsStore } from './store/agentsStore';
import { useTasksStore } from './store/tasksStore';
import { useAlertsStore } from './store/alertsStore';
import { useChatStore } from './store/chatStore';

const pageMap = {
  overview: OverviewPage,
  agents: AgentsPage,
  tasks: TasksPage,
  alerts: AlertsPage,
  chat: ChatPage,
  integrations: IntegrationsPage,
  audit: AuditPage,
  settings: SettingsPage,
};

export default function App() {
  const [activePage, setActivePage] = useState<keyof typeof pageMap>('overview');
  const [token, setToken] = useState<string | null>(localStorage.getItem('q7oc_token'));
  const { isConnected } = useWebSocket(token || undefined);

  const isMockData = useAppStore((state) => state.isMockData);
  const pendingApprovals = useAppStore((state) => state.pendingApprovals);
  const health = useAppStore((state) => state.health);
  const setPendingApprovals = useAppStore((state) => state.setPendingApprovals);
  const fetchHealth = useAppStore((state) => state.fetchHealth);

  const fetchAgents = useAgentsStore((state) => state.fetchAgents);
  const fetchTasks = useTasksStore((state) => state.fetchTasks);
  const fetchAlerts = useAlertsStore((state) => state.fetchAlerts);
  const loadHistory = useChatStore((state) => state.loadHistory);

  useEffect(() => {
    if (!token) {
      api.login('admin', 'admin').then((result) => {
        localStorage.setItem('q7oc_token', result.access_token);
        setToken(result.access_token);
      }).catch(() => undefined);
    }
  }, [token]);

  useEffect(() => {
    if (!token) return;
    fetchHealth().catch(() => undefined);
    fetchAgents().catch(() => undefined);
    fetchTasks().catch(() => undefined);
    fetchAlerts().catch(() => undefined);
    loadHistory('agent:main:telegram:direct:8646271102').catch(() => undefined);
    api.getApprovals().then((rows) => setPendingApprovals(rows.length)).catch(() => undefined);
  }, [token, fetchHealth, fetchAgents, fetchTasks, fetchAlerts, loadHistory, setPendingApprovals]);

  const CurrentPage = useMemo(() => pageMap[activePage], [activePage]);

  return (
    <AppShell
      activePage={activePage}
      onNavigate={(page) => setActivePage(page as keyof typeof pageMap)}
      connectionStatus={isConnected ? 'connected' : 'disconnected'}
      isConnected={isConnected}
      isMockData={isMockData}
      pendingApprovals={pendingApprovals}
      health={health}
    >
      <CurrentPage />
    </AppShell>
  );
}
