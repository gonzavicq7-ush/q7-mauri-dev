import { create } from 'zustand';
import { api, getMockDataFlag, type Task } from '../lib/api';
import { useAppStore } from './appStore';

type TasksState = {
  tasks: Task[];
  loading: boolean;
  fetchTasks: () => Promise<void>;
  executeAction: (taskId: string, action: string, params?: unknown) => Promise<unknown>;
  replaceTasks: (tasks: Task[]) => void;
  upsertTask: (task: Task) => void;
};

export const useTasksStore = create<TasksState>((set) => ({
  tasks: [],
  loading: false,
  fetchTasks: async () => {
    set({ loading: true });
    try {
      const tasks = await api.getTasks();
      set({ tasks, loading: false });
      useAppStore.setState({ isMockData: getMockDataFlag() || Boolean(tasks[0]?.is_mock) });
    } catch {
      set({ loading: false });
    }
  },
  executeAction: async (taskId, action, params) => api.taskAction(taskId, action, params),
  replaceTasks: (tasks) => set({ tasks }),
  upsertTask: (task) => set((state) => {
    const idx = state.tasks.findIndex((item) => item.id === task.id);
    if (idx === -1) return { tasks: [task, ...state.tasks] };
    const next = [...state.tasks];
    next[idx] = { ...next[idx], ...task };
    return { tasks: next };
  }),
}));
