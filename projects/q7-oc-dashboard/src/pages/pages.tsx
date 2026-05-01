import { KpiCard, MiniStat, Pill, SectionHeader, Surface, DrawerMock } from '../components/ui';
import { useAgentsStore } from '../store/agentsStore';
import { useTasksStore } from '../store/tasksStore';
import { useChatStore } from '../store/chatStore';
import { useAlertsStore } from '../store/alertsStore';
import { useAppStore } from '../store/appStore';
import { Activity, Bot, CheckCircle2, ShieldAlert } from 'lucide-react';

export function OverviewPage() {
  const agents = useAgentsStore((state) => state.agents);
  const tasks = useTasksStore((state) => state.tasks);
  const pendingApprovals = useAppStore((state) => state.pendingApprovals);
  const health = useAppStore((state) => state.health);

  return (
    <div className="space-y-6">
      <SectionHeader title="Overview" description="Estado global, KPIs y resumen ejecutivo del sistema." />
      <div className="grid gap-4 md:grid-cols-4">
        <KpiCard icon={Bot} label="Agentes activos" value={String(agents.length)} delta="live" detail="agentes detectados desde gateway" />
        <KpiCard icon={Activity} label="Tareas en ejecución" value={String(tasks.length)} delta="live" detail="pipeline actual del backend" />
        <KpiCard icon={ShieldAlert} label="Aprobaciones pendientes" value={String(pendingApprovals)} delta="atención" detail="acciones esperando decisión" />
        <KpiCard icon={CheckCircle2} label="Health score" value={String(health?.health_score ?? '--')} delta="estable" detail="estado global reportado por backend" />
      </div>
      <Surface>
        <div className="grid gap-4 md:grid-cols-3 p-5">
          <MiniStat icon={Bot} label="Agentes conectados" value={String(agents.length)} />
          <MiniStat icon={Activity} label="Tasks running" value={String(health?.tasks_running ?? 0)} />
          <MiniStat icon={CheckCircle2} label="Errores activos" value={String(health?.agents_error ?? 0)} />
        </div>
      </Surface>
    </div>
  );
}

export function AgentsPage() {
  const { agents, filters, setFilter } = useAgentsStore();
  const filtered = agents.filter((agent) => {
    if (filters.status && agent.status !== filters.status) return false;
    if (filters.model && agent.model !== filters.model) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      <SectionHeader title="Agents" description="Estado de agentes, modelos y herramientas habilitadas." />
      <div className="flex gap-3">
        <select className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm" onChange={(e) => setFilter('status', e.target.value || undefined)}>
          <option value="">Todos los estados</option>
          <option value="active">active</option>
        </select>
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        {filtered.map((agent) => (
          <Surface key={agent.id}>
            <div className="flex items-start justify-between gap-4 p-5">
              <div>
                <h3 className="text-lg font-semibold text-white">{agent.name}</h3>
                <p className="text-sm text-slate-400">{agent.role}</p>
              </div>
              <Pill tone={agent.status === 'active' ? 'emerald' : agent.requires_approval ? 'amber' : 'default'}>
                {agent.status}
              </Pill>
            </div>
            <div className="px-5 pb-5 grid gap-3 text-sm text-slate-300 md:grid-cols-2">
              <div>Modelo: {agent.model || '--'}</div>
              <div>Provider: {agent.provider || '--'}</div>
              <div>Fallback: {agent.fallback_model || '--'}</div>
              <div>Health: {agent.health_score ?? '--'}</div>
            </div>
          </Surface>
        ))}
      </div>
    </div>
  );
}

export function TasksPage() {
  const { tasks } = useTasksStore();
  return (
    <div className="space-y-6">
      <SectionHeader title="Tasks" description="Seguimiento de tareas, estado y próximos pasos." />
      <Surface>
        <div className="overflow-x-auto p-5">
          <table className="min-w-full text-left text-sm text-slate-300">
            <thead className="text-slate-500">
              <tr>
                <th className="pb-3">Título</th>
                <th className="pb-3">Estado</th>
                <th className="pb-3">Prioridad</th>
                <th className="pb-3">Avance</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((task) => (
                <tr key={task.id} className="border-t border-white/5">
                  <td className="py-3">{task.title}</td>
                  <td className="py-3">{task.status}</td>
                  <td className="py-3">{task.priority}</td>
                  <td className="py-3">{task.progress_pct}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Surface>
      <DrawerMock title="Task detail" subtitle="Panel lateral para detalle, logs resumidos y acciones." />
    </div>
  );
}

export function AlertsPage() {
  const { alerts } = useAlertsStore();
  return (
    <div className="space-y-6">
      <SectionHeader title="Alerts" description="Feed priorizado con contexto, impacto y acciones." />
      <div className="grid gap-4">
        {(alerts.length ? alerts : [{ id: 'no-alerts', title: 'Sin alertas activas', severity: 'Resolved', source: 'backend' }]).map((alert) => (
          <Surface key={alert.id}>
            <div className="flex items-center justify-between gap-4 p-5">
              <div>
                <h3 className="font-semibold text-white">{alert.title}</h3>
                <p className="mt-1 text-sm text-slate-400">{alert.source || 'sin fuente'}</p>
              </div>
              <Pill tone={alert.severity === 'Critical' ? 'red' : alert.severity === 'High' ? 'amber' : 'emerald'}>{alert.severity}</Pill>
            </div>
          </Surface>
        ))}
      </div>
    </div>
  );
}

export function ChatPage() {
  const sessions = useChatStore((state) => state.sessions);
  const messagesBySession = useChatStore((state) => state.messages);
  const sendMessage = useChatStore((state) => state.sendMessage);
  const sessionId = sessions[0]?.id || 'agent:main:telegram:direct:8646271102';
  const messages = messagesBySession[sessionId] || [];

  return (
    <div className="space-y-6">
      <SectionHeader title="Chat" description="Consola unificada general y contextual." />
      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <Surface>
          <div className="space-y-4 p-5">
            {(messages.length ? messages : [{ role: 'system', content: 'Sesión inicial lista para integrar backend real.' }]).map((message, index) => (
              <div key={index} className="rounded-2xl border border-white/8 bg-slate-950/60 px-4 py-3 text-sm text-slate-200">
                <div className="mb-1 text-xs uppercase tracking-[0.2em] text-teal-300">{message.role}</div>
                <div>{message.content}</div>
              </div>
            ))}
            <button className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm" onClick={() => sendMessage(sessionId, 'Ping desde dashboard')}>Enviar ping</button>
          </div>
        </Surface>
        <DrawerMock title="Chat contextual" subtitle="Panel lateral para agente, tarea o alerta específica." />
      </div>
    </div>
  );
}

export function IntegrationsPage() {
  return (
    <div className="space-y-6">
      <SectionHeader title="Integrations" description="Estado de OpenClaw, Telegram y conectores externos." />
      <div className="grid gap-4 md:grid-cols-3">
        <Surface><div className="font-semibold text-white p-5">OpenClaw<div className="mt-2 text-sm text-slate-400">Conectado al backend real.</div></div></Surface>
        <Surface><div className="font-semibold text-white p-5">Telegram<div className="mt-2 text-sm text-slate-400">Bot verificado y chat ID configurado.</div></div></Surface>
        <Surface><div className="font-semibold text-white p-5">LLM Insights<div className="mt-2 text-sm text-slate-400">Lectura desde OpenClaw gateway.</div></div></Surface>
      </div>
    </div>
  );
}

export function AuditPage() {
  return (
    <div className="space-y-6">
      <SectionHeader title="Audit / Logs" description="Trazabilidad de acciones, eventos y cambios manuales." />
      <Surface>
        <div className="space-y-3 text-sm text-slate-300 p-5">
          <div className="rounded-2xl border border-white/8 bg-slate-950/60 px-4 py-3">Streaming audit pendiente de integración completa en Fase 6.</div>
        </div>
      </Surface>
    </div>
  );
}

export function SettingsPage() {
  return (
    <div className="space-y-6">
      <SectionHeader title="Settings" description="Configuración de notificaciones, umbrales y preferencias operativas." />
      <div className="grid gap-4 xl:grid-cols-2">
        <Surface>
          <h3 className="font-semibold text-white p-5">Telegram<p className="mt-2 text-sm text-slate-400">Bot token, chat id y verificación de conectividad.</p></h3>
        </Surface>
        <Surface>
          <h3 className="font-semibold text-white p-5">Umbrales<p className="mt-2 text-sm text-slate-400">SLA, agentes estancados, costo y alertas.</p></h3>
        </Surface>
      </div>
    </div>
  );
}
