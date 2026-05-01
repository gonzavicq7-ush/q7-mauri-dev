import { create } from 'zustand';
import { api, getMockDataFlag, subscribeMockFlag, type Health } from '../lib/api';

type Notification = {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  message: string;
  timestamp: string;
};

type AppState = {
  isConnected: boolean;
  isMockData: boolean;
  pendingApprovals: number;
  notifications: Notification[];
  health: Health | null;
  setConnected: (value: boolean) => void;
  setMockData: (value: boolean) => void;
  setPendingApprovals: (value: number) => void;
  incrementPendingApprovals: () => void;
  addNotification: (notification: Omit<Notification, 'id' | 'timestamp'>) => void;
  setHealth: (health: Health) => void;
  fetchHealth: () => Promise<void>;
};

export const useAppStore = create<AppState>((set) => ({
  isConnected: false,
  isMockData: getMockDataFlag(),
  pendingApprovals: 0,
  notifications: [],
  health: null,
  setConnected: (value) => set({ isConnected: value }),
  setMockData: (value) => set({ isMockData: value }),
  setPendingApprovals: (value) => set({ pendingApprovals: value }),
  incrementPendingApprovals: () => set((state) => ({ pendingApprovals: state.pendingApprovals + 1 })),
  addNotification: (notification) => set((state) => ({
    notifications: [{ id: crypto.randomUUID(), timestamp: new Date().toISOString(), ...notification }, ...state.notifications].slice(0, 20),
  })),
  setHealth: (health) => set({ health }),
  fetchHealth: async () => {
    const health = await api.getHealth();
    set({ health, isMockData: getMockDataFlag() || Boolean(health?.is_mock) });
  },
}));

subscribeMockFlag((value) => {
  useAppStore.setState({ isMockData: value });
});
