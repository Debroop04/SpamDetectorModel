'use client';

import { createContext, useCallback, useContext, useState } from 'react';
import { CheckCircle2, Info, XCircle, X } from 'lucide-react';
import { cn } from '@/lib/cn';

type ToastTone = 'success' | 'error' | 'info';
interface ToastItem {
  id: number;
  tone: ToastTone;
  message: string;
  action?: { label: string; onClick: () => void };
}

const ToastContext = createContext<{
  toast: (message: string, tone?: ToastTone, action?: ToastItem['action']) => void;
}>({ toast: () => {} });

const icons = { success: CheckCircle2, error: XCircle, info: Info };
const iconColors = { success: 'text-safe', error: 'text-danger', info: 'text-accent' };

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: number) => setItems((current) => current.filter((t) => t.id !== id)), []);

  const toast = useCallback(
    (message: string, tone: ToastTone = 'success', action?: ToastItem['action']) => {
      const id = Date.now() + Math.random();
      setItems((current) => [...current.slice(-3), { id, tone, message, action }]);
      setTimeout(() => dismiss(id), tone === 'error' ? 7000 : 4500);
    },
    [dismiss],
  );

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="pointer-events-none fixed right-4 bottom-4 z-[60] flex w-full max-w-sm flex-col gap-2">
        {items.map((item) => {
          const Icon = icons[item.tone];
          return (
            <div
              key={item.id}
              className="animate-in pointer-events-auto flex items-start gap-3 rounded-xl border border-line bg-surface px-4 py-3 shadow-pop"
            >
              <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', iconColors[item.tone])} />
              <p className="flex-1 text-[13px] leading-relaxed text-ink">{item.message}</p>
              {item.action && (
                <button
                  onClick={() => {
                    item.action?.onClick();
                    dismiss(item.id);
                  }}
                  className="shrink-0 text-[13px] font-semibold text-accent hover:text-accent-hover"
                >
                  {item.action.label}
                </button>
              )}
              <button onClick={() => dismiss(item.id)} className="shrink-0 text-ink-3 hover:text-ink" aria-label="Dismiss">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext).toast;
}
