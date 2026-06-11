import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from './api.js';

interface User {
  id: string;
  email: string;
  nombre: string;
}

interface Obra {
  id: string;
  nombre: string;
  rol: string;
}

interface AuthState {
  user: User | null;
  obras: Obra[];
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, nombre: string, password: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthState>(null!);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [obras, setObras] = useState<Obra[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) refreshUser();
    else setLoading(false);
  }, []);

  async function refreshUser() {
    try {
      const data = await api.get('/auth/yo');
      setUser({ id: data.id, email: data.email, nombre: data.nombre });
      setObras(data.obras || []);
    } catch {
      localStorage.removeItem('token');
      setUser(null);
      setObras([]);
    } finally {
      setLoading(false);
    }
  }

  async function login(email: string, password: string) {
    const data = await api.post('/auth/login', { email, password });
    localStorage.setItem('token', data.token);
    setUser(data.usuario);
    await refreshUser();
  }

  async function register(email: string, nombre: string, password: string) {
    const data = await api.post('/auth/registro', { email, nombre, password });
    localStorage.setItem('token', data.token);
    setUser(data.usuario);
    await refreshUser();
  }

  function logout() {
    localStorage.removeItem('token');
    setUser(null);
    setObras([]);
  }

  return (
    <AuthContext.Provider value={{ user, obras, loading, login, register, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
