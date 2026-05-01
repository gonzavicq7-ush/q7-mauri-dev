import { ReactNode } from 'react';

type AppShellProps = {
  activePage: string;
  onNavigate: (page: string) => void;
  connectionStatus: string;
  isConnected: boolean;
  isMockData: boolean;
  pendingApprovals: number;
  health: { health_score?: number } | null;
  children: ReactNode;
};

const navItems = [
  ['overview', 'Overview'],
  ['agents', 'Agents'],
  ['tasks', 'Tasks'],
  ['alerts', 'Alerts'],
  ['chat', 'Chat'],
  ['integrations', 'Integrations'],
  ['audit', 'Audit / Logs'],
  ['settings', 'Settings'],
];

export function AppShell({
  activePage,
  onNavigate,
  connectionStatus,
  isConnected,
  isMockData,
  pendingApprovals,
  health,
  children,
}: AppShellProps) {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="flex min-h-screen">
        <aside className="hidden w-72 shrink-0 border-r border-white/10 bg-slate-950/95 px-5 py-6 lg:block">
          <div className="mb-8">
            <div className="text-xs font-semibold uppercase tracking-[0.3em] text-teal-300">Q7 · OC</div>
            <h1 className="mt-3 text-xl font-semibold text-white">Mission Control Center</h1>
          </div>

          <nav className="space-y-2">
            {navItems.map(([key, label]) => (
              <button
                key={key}
                onClick={() => onNavigate(key)}
                className={`flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left text-sm transition ${activePage === key ? 'bg-teal-400/15 text-white' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}
              >
                <span>{label}</span>
                {key === 'alerts' && pendingApprovals > 0 ? (
                  <span className="rounded-full bg-amber-400/20 px-2 py-0.5 text-xs text-amber-200">{pendingApprovals}</span>
                ) : null}
              </button>
            ))}
          </nav>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="border-b border-white/10 bg-slate-950/80 px-5 py-4 backdrop-blur">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.25em] text-slate-500">OpenClaw Dashboard</p>
                <h2 className="mt-1 text-lg font-semibold text-white">{navItems.find(([key]) => key === activePage)?.[1]}</h2>
              </div>

              <div className="flex flex-wrap items-center gap-3 text-sm">
                <span className={`rounded-full px-3 py-1 ${isConnected ? 'bg-emerald-400/15 text-emerald-200' : 'bg-rose-400/15 text-rose-200'}`}>
                  WS {connectionStatus}
                </span>
                {isMockData ? <span className="rounded-full bg-amber-400/15 px-3 py-1 text-amber-200">datos simulados</span> : null}
                <span className="rounded-full bg-white/5 px-3 py-1 text-slate-300">aprobaciones {pendingApprovals}</span>
                <span className="rounded-full bg-white/5 px-3 py-1 text-slate-300">health {health?.health_score ?? '--'}</span>
              </div>
            </div>
          </header>

          <main className="flex-1 px-5 py-6">{children}</main>
        </div>
      </div>
    </div>
  );
}
