'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { mutate } from 'swr';
import { api, authedUrl, getToken } from './api';
import type { Call, LiveTurn, ReportBrief } from './types';

type Listener = (event: string, data: unknown) => void;

interface LiveState {
  connected: boolean;
  /** Calls that are still being screened or ringing the user, newest first. */
  activeCalls: Call[];
  /** Live transcript lines per call id. */
  turns: Record<number, LiveTurn[]>;
  subscribe: (listener: Listener) => () => void;
}

const LiveContext = createContext<LiveState | null>(null);
const ACTIVE = new Set(['screening', 'forwarding']);

function refreshCalls() {
  mutate((key) => typeof key === 'string' && (key.startsWith('/api/calls') || key.startsWith('/api/stats')));
}

function refreshReports() {
  mutate((key) => typeof key === 'string' && (key.startsWith('/api/reports') || key.startsWith('/api/calls/') || key.startsWith('/api/stats')));
}

export function LiveProvider({ enabled, children }: { enabled: boolean; children: React.ReactNode }) {
  const [connected, setConnected] = useState(false);
  const [activeCalls, setActiveCalls] = useState<Call[]>([]);
  const [turns, setTurns] = useState<Record<number, LiveTurn[]>>({});
  const listeners = useRef(new Set<Listener>());

  const subscribe = useCallback((listener: Listener) => {
    listeners.current.add(listener);
    return () => {
      listeners.current.delete(listener);
    };
  }, []);

  useEffect(() => {
    if (!enabled || !getToken()) return;
    let source: EventSource | null = null;
    let retry: ReturnType<typeof setTimeout> | null = null;
    let attempts = 0;
    let closed = false;

    const handle = (event: string, data: unknown) => {
      if (event === 'call.started' || event === 'call.updated' || event === 'call.ended') {
        const call = data as Call;
        setActiveCalls((current) => {
          const others = current.filter((c) => c.id !== call.id);
          return ACTIVE.has(call.status) && event !== 'call.ended' ? [call, ...others] : others;
        });
        refreshCalls();
      } else if (event === 'call.turn') {
        const turn = data as LiveTurn;
        setTurns((current) => ({ ...current, [turn.call_id]: [...(current[turn.call_id] || []), turn] }));
        mutate(`/api/calls/${turn.call_id}`);
      } else if (event === 'report.created' || event === 'report.updated') {
        const report = data as ReportBrief & { id: number };
        mutate(`/api/reports/${report.id}`);
        refreshReports();
      }
      listeners.current.forEach((listener) => listener(event, data));
    };

    const connect = () => {
      if (closed) return;
      source = new EventSource(authedUrl('/api/events'));
      source.onopen = () => {
        attempts = 0;
        setConnected(true);
        api<Call[]>('/api/calls/live')
          .then((calls) => setActiveCalls(calls))
          .catch(() => {});
      };
      source.onmessage = (message) => {
        try {
          const parsed = JSON.parse(message.data) as { event: string; data: unknown };
          handle(parsed.event, parsed.data);
        } catch {
          // ignore malformed messages
        }
      };
      source.onerror = () => {
        setConnected(false);
        source?.close();
        attempts += 1;
        retry = setTimeout(connect, Math.min(15000, 1000 * 2 ** Math.min(attempts, 4)));
      };
    };

    connect();
    return () => {
      closed = true;
      if (retry) clearTimeout(retry);
      source?.close();
      setConnected(false);
    };
  }, [enabled]);

  return <LiveContext.Provider value={{ connected, activeCalls, turns, subscribe }}>{children}</LiveContext.Provider>;
}

export function useLive() {
  const context = useContext(LiveContext);
  if (!context) throw new Error('useLive must be used inside LiveProvider');
  return context;
}

export function useLiveEvent(listener: Listener) {
  const { subscribe } = useLive();
  const ref = useRef(listener);
  useEffect(() => {
    ref.current = listener;
  });
  useEffect(() => subscribe((event, data) => ref.current(event, data)), [subscribe]);
}
