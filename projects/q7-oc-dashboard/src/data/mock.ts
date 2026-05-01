import type { LucideIcon } from 'lucide-react';
import {
  Activity,
  BellRing,
  Bot,
  Cable,
  CheckCircle2,
  CircleAlert,
  Clock3,
  Cpu,
  FileSearch,
  LayoutDashboard,
  MessageSquareText,
  Radar,
  Settings2,
  Shield,
  Siren,
} from 'lucide-react';

export type NavItem = {
  id: string;
  label: string;
  icon: LucideIcon;
  badge?: string;
};

export const navItems: NavItem[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'agents', label: 'Agents', icon: Bot, badge: '24' },
  { id: 'tasks', label: 'Tasks', icon: Radar, badge: '187' },
  { id: 'alerts', label: 'Alerts', icon: Siren, badge: '7' },
  { id: 'chat', label: 'Chat', icon: MessageSquareText },
  { id: 'integrations', label: 'Integrations', icon: Cable },
  { id: 'audit', label: 'Audit / Logs', icon: FileSearch },
  { id: 'settings', label: 'Settings', icon: Settings2 },
];

export const kpis = [
  { label: 'Active agents', value: '24', delta: '+3', detail: '18 healthy · 4 busy · 2 degraded', icon: Bot },
  { label: 'Tasks throughput', value: '1.28k', delta: '+12%', detail: 'rolling 24h execution volume', icon: Activity },
  { label: 'Critical alerts', value: '07', delta: '-2', detail: 'gateway + auth anomaly cluster', icon: BellRing },
  { label: 'Mission SLA', value: '99.94%', delta: '+0.08%', detail: 'last 30 days availability', icon: Shield },
];

export const agentCards = [
  { name: 'ops-gateway-01', role: 'Gateway Orchestrator', status: 'Healthy', latency: '43 ms', region: 'eu-west-1', load: 68 },
  { name: 'sec-audit-x', role: 'Security Analyst', status: 'Busy', latency: '71 ms', region: 'edge-madrid', load: 82 },
  { name: 'db-recoverer', role: 'Recovery Specialist', status: 'Healthy', latency: '58 ms', region: 'core-db', load: 54 },
  { name: 'field-mobile', role: 'Device Pairing Agent', status: 'Degraded', latency: '151 ms', region: 'tailnet', load: 93 },
];

export const taskRows = [
  { id: 'TSK-9142', name: 'Rotate node bootstrap tokens', owner: 'ops-gateway-01', priority: 'High', state: 'Running', eta: '04m' },
  { id: 'TSK-9138', name: 'Audit sudoers drift', owner: 'sec-audit-x', priority: 'Critical', state: 'Queued', eta: '12m' },
  { id: 'TSK-9131', name: 'Collect mobile pairing diagnostics', owner: 'field-mobile', priority: 'Medium', state: 'Blocked', eta: '--' },
  { id: 'TSK-9124', name: 'Summarize overnight incidents', owner: 'ops-gateway-01', priority: 'Low', state: 'Completed', eta: 'done' },
];

export const alerts = [
  { title: 'Unauthorized pairing attempts spike', severity: 'Critical', source: 'publicUrl edge', time: '2m ago' },
  { title: 'Gateway bind fallback detected', severity: 'High', source: 'gateway.remote.url', time: '14m ago' },
  { title: 'Task queue lag above baseline', severity: 'Medium', source: 'scheduler', time: '31m ago' },
  { title: 'Tailnet packet loss recovered', severity: 'Resolved', source: 'tailscale', time: '46m ago' },
];

export const chatMessages = [
  { author: 'Victor', role: 'Commander', time: '13:02', text: 'Necesito visión rápida del estado de nodos y alertas críticas.' },
  { author: 'Mauri', role: 'Mission AI', time: '13:02', text: 'Hay 24 agentes activos, 7 alertas críticas y degradación localizada en field-mobile por pairing remoto.' },
  { author: 'System', role: 'Telemetry', time: '13:05', text: 'Nuevo evento correlacionado: anomalía de auth + incremento de intents en borde público.' },
];

export const integrations = [
  { name: 'Tailscale', state: 'Connected', detail: 'Mesh latency stable · 14 peers' },
  { name: 'Slack Relay', state: 'Syncing', detail: '2 delayed outbound events' },
  { name: 'GitHub', state: 'Connected', detail: 'Webhooks verified · 5 repos' },
  { name: 'SIEM Export', state: 'Attention', detail: 'Retry budget 63% consumed' },
];

export const auditRows = [
  { time: '13:21:04', actor: 'sec-audit-x', action: 'Policy diff generated', target: 'prod-gateway-02', outcome: 'Success' },
  { time: '13:18:39', actor: 'Victor', action: 'Requested mission summary', target: 'dashboard', outcome: 'Success' },
  { time: '13:16:11', actor: 'field-mobile', action: 'Pairing retried', target: 'ios-node-17', outcome: 'Denied' },
  { time: '13:10:55', actor: 'ops-gateway-01', action: 'Gateway hot-reload', target: 'eu-edge-a', outcome: 'Success' },
];

export const settingsGroups = [
  {
    title: 'Command Center',
    items: [
      ['Theme', 'Dark / OLED'],
      ['Density', 'Comfortable'],
      ['Live refresh', '15 seconds'],
    ],
  },
  {
    title: 'Governance',
    items: [
      ['Approval mode', 'Human-in-the-loop'],
      ['Audit retention', '365 days'],
      ['Alert escalation', 'P1 immediate'],
    ],
  },
];

export const timeline = [
  { label: 'Threat level', value: 'Elevated', icon: CircleAlert },
  { label: 'Queue drift', value: '2.4x baseline', icon: Clock3 },
  { label: 'Compute headroom', value: '31%', icon: Cpu },
  { label: 'Containment', value: 'Stable', icon: CheckCircle2 },
];
