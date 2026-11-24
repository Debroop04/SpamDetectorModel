'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { mutate } from 'swr';
import { api, getToken, setToken } from './api';
import type { Session, User } from './types';

interface AuthState {
  user: User | null;
  ready: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  setUser: (user: User) => void;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUserState] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  const refresh = useCallback(async () => {
    if (!getToken()) {
      setUserState(null);
      return;
    }
    try {
      setUserState(await api<User>('/api/auth/me'));
    } catch {
      setToken(null);
      setUserState(null);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const load = getToken()
      ? api<User>('/api/auth/me').catch(() => {
          setToken(null);
          return null;
        })
      : Promise.resolve(null);
    load.then((loaded) => {
      if (cancelled) return;
      setUserState(loaded);
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setUserState(null);
    mutate(() => true, undefined, { revalidate: false });
    router.replace('/login');
  }, [router]);

  useEffect(() => {
    const onUnauthorized = () => logout();
    window.addEventListener('callshield:unauthorized', onUnauthorized);
    return () => window.removeEventListener('callshield:unauthorized', onUnauthorized);
  }, [logout]);

  const startSession = useCallback((session: Session) => {
    setToken(session.token);
    setUserState(session.user);
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      user,
      ready,
      refresh,
      logout,
      setUser: setUserState,
      login: async (email, password) => startSession(await api<Session>('/api/auth/login', { method: 'POST', body: { email, password } })),
      register: async (name, email, password) =>
        startSession(await api<Session>('/api/auth/register', { method: 'POST', body: { name, email, password } })),
    }),
    [user, ready, refresh, logout, startSession],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
