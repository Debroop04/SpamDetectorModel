'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import useSWR from 'swr';
import {
  Bell,
  ChevronDown,
  FileText,
  Hash,
  LayoutDashboard,
  LogOut,
  MapPinned,
  Menu,
  PhoneCall,
  PhoneIncoming,
  Search,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  UserCog,
  X,
} from 'lucide-react';
import { cn } from '@/lib/cn';
import { useAuth } from '@/lib/auth';
import { LiveProvider, useLive, useLiveEvent } from '@/lib/live';
import { formatPhone, timeAgo, type Tone } from '@/lib/format';
import type { Call, Report, ReportBrief, SystemStatus } from '@/lib/types';
import { Logo } from '@/components/logo';
import { ThemeToggle } from '@/components/theme-toggle';
import { Popover } from '@/components/ui/popover';
import { useToast } from '@/components/ui/toast';
import { VerdictBadge } from '@/components/ui/badge';

type NavItem = { href: string; label: string; icon: typeof LayoutDashboard; adminOnly?: boolean };

const NAV_GROUPS: NavItem[][] = [
  [
    { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/calls', label: 'Calls', icon: PhoneIncoming },
    { href: '/reports', label: 'Police reports', icon: FileText },
  ],
  [
    { href: '/map', label: 'Map', icon: MapPinned },
    { href: '/numbers', label: 'Numbers', icon: Hash },
    { href: '/test-call', label: 'Test call', icon: PhoneCall },
  ],
  [
    { href: '/settings', label: 'Settings', icon: Settings },
    { href: '/admin', label: 'Admin', icon: UserCog, adminOnly: true },
    { href: '/download', label: 'Android app', icon: Smartphone },
  ],
];

const PAGE_TITLES: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/calls': 'Calls',
  '/reports': 'Police reports',
  '/map': 'Map',
  '/numbers': 'Numbers',
  '/test-call': 'Test call',
  '/settings': 'Settings',
  '/admin': 'Admin',
};

// ---------- Sidebar ----------

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { user } = useAuth();
  const { activeCalls } = useLive();
  const { data: reports } = useSWR<Report[]>('/api/reports?limit=200');
  const attention = reports?.filter((r) => r.status === 'failed' || r.status === 'needs_email').length ?? 0;

  return (
    <nav className="flex flex-col gap-4">
      {NAV_GROUPS.map((group, index) => (
        <div key={index} className={cn('flex flex-col gap-0.5', index > 0 && 'border-t border-line pt-4')}>
          {group
            .filter((item) => !item.adminOnly || user?.role === 'admin')
            .map(({ href, label, icon: Icon }) => {
              const active = pathname === href || pathname.startsWith(`${href}/`);
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={onNavigate}
                  className={cn(
                    'group relative flex h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors',
                    active ? 'bg-accent-soft text-accent-ink' : 'text-ink-2 hover:bg-subtle hover:text-ink',
                  )}
                >
                  {active && <span className="absolute top-2 bottom-2 -left-3 w-1 rounded-r-full bg-accent" />}
                  <Icon className={cn('h-4.5 w-4.5', active ? 'text-accent' : 'text-ink-3 group-hover:text-ink-2')} strokeWidth={active ? 2.2 : 1.9} />
                  <span className="flex-1">{label}</span>
                  {href === '/calls' && activeCalls.length > 0 && (
                    <span className="flex items-center gap-1.5 rounded-full bg-danger-soft px-2 py-0.5 text-[11px] font-semibold text-danger-ink">
                      <span className="live-dot h-1.5! w-1.5! text-danger" />
                      {activeCalls.length}
                    </span>
                  )}
                  {href === '/reports' && attention > 0 && (
                    <span className="rounded-full bg-warn-soft px-2 py-0.5 text-[11px] font-semibold text-warn-ink">{attention}</span>
                  )}
                </Link>
              );
            })}
        </div>
      ))}
    </nav>
  );
}

function ProtectionCard() {
  const { user } = useAuth();
  const { connected } = useLive();
  const { data: system } = useSWR<SystemStatus>('/api/system/status');
  const protectedNow = Boolean(user?.line_number && system?.twilio_sync?.ok);
  return (
    <Link href={protectedNow ? '/settings?tab=line' : '/dashboard'} className="block rounded-xl border border-line bg-subtle p-3.5 transition-colors hover:border-line-strong">
      <div className="flex items-center gap-3">
        <span className={cn('flex h-9 w-9 items-center justify-center rounded-lg', protectedNow ? 'bg-safe-soft text-safe' : 'bg-warn-soft text-warn')}>
          {protectedNow ? <ShieldCheck className="h-4.5 w-4.5" /> : <ShieldAlert className="h-4.5 w-4.5" />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-semibold text-ink">{protectedNow ? 'Protected' : 'Setup needed'}</div>
          <div className="truncate text-[11.5px] text-ink-3">{user?.line_number ? formatPhone(user.line_number) : 'No line yet'}</div>
        </div>
        <span className={cn('h-2 w-2 rounded-full', connected ? 'bg-safe' : 'bg-line-strong')} title={connected ? 'Live updates on' : 'Reconnecting'} />
      </div>
    </Link>
  );
}

function SidebarBody({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <>
      <div className="flex-1 overflow-y-auto px-3 py-4">
        <NavLinks onNavigate={onNavigate} />
      </div>
      <div className="border-t border-line p-3">
        <ProtectionCard />
      </div>
    </>
  );
}

// ---------- Top bar ----------

interface Note {
  id: number;
  tone: Tone;
  text: string;
  href: string;
  at: number;
}

const noteTone: Record<Tone, string> = {
  neutral: 'bg-subtle text-ink-2',
  accent: 'bg-accent-soft text-accent',
  safe: 'bg-safe-soft text-safe',
  warn: 'bg-warn-soft text-warn',
  danger: 'bg-danger-soft text-danger',
};

function useLiveNotes() {
  const toast = useToast();
  const router = useRouter();
  const [notes, setNotes] = useState<Note[]>([]);
  const [unread, setUnread] = useState(0);

  const add = useCallback((tone: Tone, text: string, href: string) => {
    setNotes((current) => [{ id: Date.now() + Math.random(), tone, text, href, at: Date.now() }, ...current].slice(0, 12));
    setUnread((n) => n + 1);
  }, []);

  useLiveEvent((event, data) => {
    if (event === 'call.updated') {
      const call = data as Call;
      if (call.status === 'blocked' && call.verdict === 'spam') {
        const text = `Blocked a scam call from ${formatPhone(call.caller_number)}`;
        add('danger', text, `/calls?open=${call.id}`);
        toast(text, 'error', { label: 'View', onClick: () => router.push(`/calls?open=${call.id}`) });
      }
    }
    if (event === 'call.started') {
      const call = data as Call;
      add('accent', `Screening a call from ${formatPhone(call.caller_number)}`, '/dashboard');
    }
    if (event === 'report.updated') {
      const report = data as ReportBrief;
      if (report.status === 'acknowledged') {
        const text = `${report.station_name || 'The police station'} acknowledged ${report.reference}`;
        add('safe', text, `/reports/${report.id}`);
        toast(text, 'success', { label: 'Open', onClick: () => router.push(`/reports/${report.id}`) });
      } else if (report.status === 'sent') {
        const text = `Report ${report.reference} emailed${report.mode === 'test' ? ' to you (test mode)' : ''}`;
        add('accent', text, `/reports/${report.id}`);
        toast(text, 'info');
      } else if (report.status === 'failed' || report.status === 'needs_email') {
        const text = `Report ${report.reference} was not sent`;
        add('warn', text, `/reports/${report.id}`);
        toast(text, 'error', { label: 'Fix', onClick: () => router.push(`/reports/${report.id}`) });
      }
    }
  });

  return { notes, unread, markRead: () => setUnread(0) };
}

function TopBar({ onMenu }: { onMenu: () => void }) {
  const { user, logout } = useAuth();
  const { connected } = useLive();
  const pathname = usePathname();
  const router = useRouter();
  const [query, setQuery] = useState('');
  const { notes, unread, markRead } = useLiveNotes();
  const title = PAGE_TITLES[`/${pathname.split('/')[1]}`] ?? '';
  const initials = (user?.name || '?')
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-bg/85 backdrop-blur-md">
      <div className="flex h-16 items-center gap-3 px-4 sm:px-6 lg:px-8">
        <button onClick={onMenu} className="rounded-lg p-2 text-ink-2 hover:bg-subtle lg:hidden" aria-label="Open menu">
          <Menu className="h-5 w-5" />
        </button>
        <span className="text-[15px] font-semibold text-ink lg:hidden">{title}</span>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (query.trim()) router.push(`/numbers?q=${encodeURIComponent(query.trim())}`);
          }}
          className="relative hidden w-full max-w-sm md:block"
        >
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-ink-3" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Check a phone number"
            inputMode="tel"
            className="h-10 w-full rounded-xl border border-line bg-surface pr-3 pl-9 text-sm text-ink placeholder:text-ink-3 focus:border-accent focus:ring-3 focus:ring-accent-soft focus:outline-none"
          />
        </form>

        <div className="ml-auto flex items-center gap-2">
          <span
            className={cn(
              'hidden items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold sm:inline-flex',
              connected ? 'bg-safe-soft text-safe-ink' : 'bg-subtle text-ink-3',
            )}
          >
            <span className={cn('live-dot h-1.5! w-1.5!', connected ? 'text-safe' : 'text-ink-3')} />
            {connected ? 'Live' : 'Offline'}
          </span>
          <ThemeToggle />

          <Popover
            className="w-80"
            trigger={(open, toggle) => (
              <button
                onClick={() => {
                  toggle();
                  markRead();
                }}
                className={cn(
                  'relative flex h-9 w-9 items-center justify-center rounded-lg border border-line bg-surface text-ink-2 transition-colors hover:border-line-strong hover:text-ink',
                  open && 'border-line-strong text-ink',
                )}
                aria-label="Notifications"
              >
                <Bell className="h-4 w-4" />
                {unread > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold text-white">
                    {unread}
                  </span>
                )}
              </button>
            )}
          >
            {(close) => (
              <div>
                <div className="border-b border-line px-4 py-3 text-sm font-semibold text-ink">Notifications</div>
                {notes.length === 0 ? (
                  <p className="px-4 py-8 text-center text-sm text-ink-3">Nothing new since you opened the app</p>
                ) : (
                  <ul className="max-h-96 divide-y divide-line overflow-y-auto">
                    {notes.map((note) => (
                      <li key={note.id}>
                        <Link href={note.href} onClick={close} className="flex gap-3 px-4 py-3 hover:bg-subtle">
                          <span className={cn('mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full', noteTone[note.tone])}>
                            <Bell className="h-3.5 w-3.5" />
                          </span>
                          <div className="min-w-0">
                            <div className="text-[13px] leading-snug text-ink">{note.text}</div>
                            <div className="mt-0.5 text-[11px] text-ink-3">{timeAgo(new Date(note.at).toISOString())}</div>
                          </div>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </Popover>

          <Popover
            className="w-64"
            trigger={(_, toggle) => (
              <button onClick={toggle} className="flex items-center gap-2 rounded-xl py-1 pr-2 pl-1 transition-colors hover:bg-subtle" aria-label="Account">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-xs font-semibold text-on-accent">{initials}</span>
                <span className="hidden max-w-32 truncate text-sm font-medium text-ink xl:inline">{user?.name}</span>
                <ChevronDown className="hidden h-4 w-4 text-ink-3 xl:inline" />
              </button>
            )}
          >
            {(close) => (
              <div className="py-1.5">
                <div className="px-4 py-2.5">
                  <div className="truncate text-sm font-semibold text-ink">{user?.name}</div>
                  <div className="truncate text-xs text-ink-3">{user?.email}</div>
                </div>
                <div className="my-1 border-t border-line" />
                <Link href="/settings" onClick={close} className="flex items-center gap-2.5 px-4 py-2 text-sm text-ink-2 hover:bg-subtle hover:text-ink">
                  <Settings className="h-4 w-4" />
                  Settings
                </Link>
                {user?.role === 'admin' && (
                  <Link href="/admin" onClick={close} className="flex items-center gap-2.5 px-4 py-2 text-sm text-ink-2 hover:bg-subtle hover:text-ink">
                    <UserCog className="h-4 w-4" />
                    Admin
                  </Link>
                )}
                <button
                  onClick={() => {
                    close();
                    logout();
                  }}
                  className="flex w-full items-center gap-2.5 px-4 py-2 text-left text-sm text-danger-ink hover:bg-danger-soft"
                >
                  <LogOut className="h-4 w-4" />
                  Sign out
                </button>
              </div>
            )}
          </Popover>
        </div>
      </div>
    </header>
  );
}

// ---------- Live call banner ----------

function LiveCallBanner() {
  const { activeCalls } = useLive();
  const pathname = usePathname();
  const call = activeCalls[0];
  if (!call || pathname === '/dashboard' || pathname === '/test-call') return null;
  return (
    <Link
      href="/dashboard"
      className="animate-in fixed bottom-4 left-4 z-40 flex w-[calc(100%-2rem)] max-w-sm items-center gap-3 rounded-2xl border border-line bg-surface p-3.5 shadow-pop lg:left-[calc(var(--sidebar-w)+1rem)]"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
        <PhoneIncoming className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold text-ink">{call.caller_name || formatPhone(call.caller_number)}</div>
        <div className="text-xs text-ink-3">{call.status === 'forwarding' ? 'Ringing your phone' : 'AI is screening this call'}</div>
      </div>
      <VerdictBadge verdict={call.verdict} live />
    </Link>
  );
}

// ---------- Shell ----------

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, ready } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (ready && !user) router.replace(`/login?next=${encodeURIComponent(pathname)}`);
  }, [ready, user, router, pathname]);

  if (!ready || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <span className="h-6 w-6 animate-spin rounded-full border-2 border-line border-t-accent" />
      </div>
    );
  }

  return (
    <LiveProvider enabled>
      <div className="[--sidebar-w:264px]">
        <aside className="fixed inset-y-0 left-0 z-30 hidden w-(--sidebar-w) flex-col border-r border-line bg-surface lg:flex">
          <div className="flex h-16 items-center border-b border-line px-5">
            <Link href="/dashboard">
              <Logo />
            </Link>
          </div>
          <SidebarBody />
        </aside>

        {open && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div className="absolute inset-0 bg-[#05080f]/45" onClick={() => setOpen(false)} />
            <aside className="animate-in absolute inset-y-0 left-0 flex w-72 flex-col border-r border-line bg-surface">
              <div className="flex h-16 items-center justify-between border-b border-line px-5">
                <Logo />
                <button onClick={() => setOpen(false)} className="rounded-md p-1.5 text-ink-3 hover:bg-subtle hover:text-ink" aria-label="Close menu">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <SidebarBody onNavigate={() => setOpen(false)} />
            </aside>
          </div>
        )}

        <div className="min-h-screen lg:pl-(--sidebar-w)">
          <TopBar onMenu={() => setOpen(true)} />
          <main className="mx-auto w-full max-w-370 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
        </div>
        <LiveCallBanner />
      </div>
    </LiveProvider>
  );
}
