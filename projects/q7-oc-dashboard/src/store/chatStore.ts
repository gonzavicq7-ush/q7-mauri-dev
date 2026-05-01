import { create } from 'zustand';
import { api, type ChatMessage } from '../lib/api';

export type ChatSession = {
  id: string;
  title: string;
};

type ChatState = {
  sessions: ChatSession[];
  messages: Record<string, ChatMessage[]>;
  sendMessage: (sessionId: string, message: string, context?: unknown) => Promise<void>;
  loadHistory: (sessionId: string) => Promise<void>;
  appendMessage: (sessionId: string, message: ChatMessage) => void;
};

export const useChatStore = create<ChatState>((set) => ({
  sessions: [{ id: 'agent:main:telegram:direct:8646271102', title: 'Main session' }],
  messages: {},
  sendMessage: async (sessionId, message, context) => {
    await api.sendChatMessage(sessionId, message, context);
    set((state) => ({
      messages: {
        ...state.messages,
        [sessionId]: [
          ...(state.messages[sessionId] || []),
          { role: 'user', content: message, session_id: sessionId, timestamp: new Date().toISOString() },
        ],
      },
    }));
  },
  loadHistory: async (sessionId) => {
    const history = await api.getChatHistory(sessionId);
    set((state) => ({ messages: { ...state.messages, [sessionId]: history } }));
  },
  appendMessage: (sessionId, message) => set((state) => ({
    messages: {
      ...state.messages,
      [sessionId]: [...(state.messages[sessionId] || []), message],
    },
  })),
}));
