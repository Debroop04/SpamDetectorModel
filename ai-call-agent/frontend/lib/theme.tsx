'use client';

import { useCallback, useSyncExternalStore } from 'react';

type Theme = 'light' | 'dark';
const STORAGE_KEY = 'callshield.theme';
const EVENT = 'callshield:theme';

/** Inline script that applies the saved theme before first paint to avoid a flash. */
export const themeScript = `(function(){try{var t=localStorage.getItem('${STORAGE_KEY}');if(!t){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}document.documentElement.classList.toggle('dark',t==='dark')}catch(e){}})();`;

function subscribe(callback: () => void) {
  window.addEventListener(EVENT, callback);
  return () => window.removeEventListener(EVENT, callback);
}

function snapshot(): Theme {
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
}

/** The theme lives on the <html> class, so it is read from there instead of React state. */
export function useTheme() {
  const theme = useSyncExternalStore(subscribe, snapshot, () => 'light' as Theme);
  const toggle = useCallback(() => {
    const next = snapshot() === 'dark' ? 'light' : 'dark';
    document.documentElement.classList.toggle('dark', next === 'dark');
    window.localStorage.setItem(STORAGE_KEY, next);
    window.dispatchEvent(new Event(EVENT));
  }, []);
  return { theme, toggle };
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
