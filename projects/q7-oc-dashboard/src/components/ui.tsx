import type { PropsWithChildren, ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { ChevronRight, Search } from 'lucide-react';

export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

export function Surface({ children, className = '' }: PropsWithChildren<{ className?: string }>) {
  return (
    <div className={cn('rounded-3xl border border-white/10 bg-white/5 shadow-[0_0_0_1px_rgba(255,255,255,0.02),0_30px_80px_rgba(0,0,0,0.35)] backdrop-blur-xl', className)}>
      {children}
    </div>
  );
}

export function SectionHeader({ title, eyebrow, action }: { title: string; eyebrow?: string; action?: ReactNode }) {
  return (
    <div className="mb-5 flex items-start justify-between gap-4">
      <div>
        {eyebrow ? <p className="mb-2 text-xs font-semibold uppercase tracking-[0.24em] text-cyan-300/70">{eyebrow}</p> : null}
        <h2 className="text-xl font-semibold text-white">{title}</h2>
      </div>
      {action}
    </div>
  );
}

export function Pill({ children, tone = 'default' }: PropsWithChildren<{ tone?: 'default' | 'cyan' | 'amber' | 'emerald' | 'red' }>) {
  const tones = {
    default: 'border-white/10 bg-white/5 text-slate-200',
    cyan: 'border-cyan-400/20 bg-cyan-400/10 text-cyan-200',
    amber: 'border-amber-400/20 bg-amber-400/10 text-amber-200',
    emerald: 'border-emerald-400/20 bg-emerald-400/10 text-emerald-200',
    red: 'border-red-400/20 bg-red-400/10 text-red-200',
  } as const;

  return <span className={cn('inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium', tones[tone])}>{children}</span>;
}

export function KpiCard({ icon: Icon, label, value, delta, detail }: { icon: LucideIcon; label: string; value: string; delta: string; detail: string }) {
  return (
    <Surface className="p-5">
      <div className="mb-5 flex items-center justify-between">
        <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-400/10 text-cyan-300">
          <Icon size={20} />
        </span>
        <Pill tone={delta.startsWith('+') ? 'emerald' : delta.startsWith('-') ? 'amber' : 'cyan'}>{delta}</Pill>
      </div>
      <div className="space-y-1">
        <p className="text-sm text-slate-400">{label}</p>
        <h3 className="text-3xl font-semibold tracking-tight text-white">{value}</h3>
        <p className="text-sm text-slate-400">{detail}</p>
      </div>
    </Surface>
  );
}

export function SearchInput() {
  return (
    <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-400">
      <Search size={16} className="text-slate-500" />
      <input
        className="w-full bg-transparent outline-none placeholder:text-slate-500"
        placeholder="Search agents, tasks, alerts..."
      />
    </label>
  );
}

export function MiniStat({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/8 bg-black/20 p-4">
      <div className="mb-3 flex items-center gap-3 text-slate-400">
        <Icon size={15} className="text-cyan-300" />
        <span className="text-sm">{label}</span>
      </div>
      <p className="text-lg font-semibold text-white">{value}</p>
    </div>
  );
}

export function DrawerMock({ title, subtitle, children }: PropsWithChildren<{ title: string; subtitle: string }>) {
  return (
    <Surface className="p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-white">{title}</h3>
          <p className="text-sm text-slate-400">{subtitle}</p>
        </div>
        <button className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-200 transition hover:bg-white/10">
          Inspect
          <ChevronRight size={16} />
        </button>
      </div>
      {children}
    </Surface>
  );
}
