'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Smartphone, X } from 'lucide-react';
import { LogoMark } from '@/components/logo';

const KEY = 'callshield.app-prompt-dismissed';

/** Offers the Android app once: a bottom sheet on Android phones, a small card on computers. */
export function AppPrompt() {
  const pathname = usePathname();
  const [mode, setMode] = useState<'sheet' | 'card' | null>(null);

  useEffect(() => {
    if (pathname === '/download' || pathname.startsWith('/login') || pathname.startsWith('/register')) return;
    const timer = setTimeout(() => {
      if (window.localStorage.getItem(KEY)) return;
      const android = /Android/i.test(navigator.userAgent);
      // Phones see the sheet anywhere; computers only see the card on the public home page.
      if (android) setMode('sheet');
      else if (pathname === '/') setMode('card');
    }, 1500);
    return () => clearTimeout(timer);
  }, [pathname]);

  if (!mode || pathname === '/download' || (mode === 'card' && pathname !== '/')) return null;

  const dismiss = () => {
    window.localStorage.setItem(KEY, '1');
    setMode(null);
  };

  if (mode === 'sheet') {
    return (
      <div className="fixed inset-0 z-55 flex items-end">
        <div className="absolute inset-0 bg-[#05080f]/45" onClick={dismiss} />
        <div className="animate-in relative w-full rounded-t-3xl border-t border-line bg-surface px-6 pt-3 pb-8 shadow-pop">
          <div className="mx-auto mb-6 h-1.5 w-10 rounded-full bg-line-strong" />
          <div className="flex items-center gap-4">
            <LogoMark className="h-14 w-14 rounded-2xl [&_svg]:h-7 [&_svg]:w-7" />
            <div className="min-w-0 flex-1">
              <div className="text-lg font-semibold text-ink">Call Shield app</div>
              <div className="text-sm text-ink-3">Free · 3 MB · Android 10+</div>
            </div>
          </div>
          <div className="mt-6 grid grid-cols-2 gap-3">
            <button onClick={dismiss} className="h-12 rounded-xl border border-line bg-surface text-[15px] font-semibold text-ink">
              Not now
            </button>
            <Link
              href="/download"
              onClick={() => window.localStorage.setItem(KEY, '1')}
              className="flex h-12 items-center justify-center gap-2 rounded-xl bg-accent text-[15px] font-semibold text-on-accent"
            >
              <Smartphone className="h-4 w-4" />
              Get the app
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-in fixed right-4 bottom-4 z-45 hidden w-85 rounded-2xl border border-line bg-surface p-4 shadow-pop sm:block">
      <button onClick={dismiss} className="absolute top-3 right-3 rounded-md p-1 text-ink-3 hover:bg-subtle hover:text-ink" aria-label="Dismiss">
        <X className="h-4 w-4" />
      </button>
      <div className="flex items-center gap-3 pr-6">
        <LogoMark className="h-11 w-11 rounded-xl" />
        <div className="text-[15px] font-semibold text-ink">Call Shield for Android</div>
      </div>
      <Link
        href="/download"
        onClick={() => window.localStorage.setItem(KEY, '1')}
        className="mt-4 flex h-10 items-center justify-center gap-2 rounded-lg bg-accent text-sm font-semibold text-on-accent hover:bg-accent-hover"
      >
        <Smartphone className="h-4 w-4" />
        Get the app
      </Link>
    </div>
  );
}
