import { create } from 'zustand';
import { api, getMockDataFlag, type Agent } from '../lib/api';
import { useAppStore } from './appStore';

type Filters = {
  status?: string;
  model?: string;
};

type AgentsState = {
  agents: Agent[];
  loading: boolean;
  filters: Filters;
  fetchAgents: () => Promise<void>;
  setFilter: (key: keyof Filters, value?: string) => void;
  replaceAgents: (agents: Agent[]) => void;
  upsertAgent: (agent: Agent) => void;
};

export const useAgentsStore = create<AgentsState>((set, get) => ({
  agents: [],
  loading: false,
  filters: {},
  fetchAgents: async () => {
    set({ loading: true });
    try {
      const agents = await api.getAgents(get().filters);
      set({ agents, loading: false });
      useAppStore.setState({ isMockData: getMockDataFlag() || Boolean(agents[0]?.is_mock) });
    } catch {
      set({ loading: false });
    }
  },
  setFilter: (key, value) => set((state) => ({ filters: { ...state.filters, [key]: value || undefined } })),
  replaceAgents: (agents) => set({ agents }),
  upsertAgent: (agent) => set((state) => {
    const idx = state.agents.findIndex((item) => item.id === agent.id);
    if (idx === -1) return { agents: [agent, ...state.agents] };
    const next = [...state.agents];
    next[idx] = { ...next[idx], ...agent };
    return { agents: next };
  }),
}));
