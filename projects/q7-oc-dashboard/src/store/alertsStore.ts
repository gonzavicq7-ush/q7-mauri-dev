import { create } from 'zustand';
import { api, getMockDataFlag, type Alert } from '../lib/api';
import { useAppStore } from './appStore';

type AlertsState = {
  alerts: Alert[];
  loading: boolean;
  fetchAlerts: () => Promise<void>;
  resolveAlert: (alertId: string) => Promise<void>;
  setAlerts: (alerts: Alert[]) => void;
};

export const useAlertsStore = create<AlertsState>((set) => ({
  alerts: [],
  loading: false,
  fetchAlerts: async () => {
    set({ loading: true });
    try {
      const alerts = await api.getAlerts();
      set({ alerts, loading: false });
      useAppStore.setState({ isMockData: getMockDataFlag() || Boolean(alerts[0]?.is_mock) });
    } catch {
      set({ loading: false, alerts: [] });
    }
  },
  resolveAlert: async (alertId) => {
    set((state) => ({ alerts: state.alerts.filter((alert) => alert.id !== alertId) }));
  },
  setAlerts: (alerts) => set({ alerts }),
}));
