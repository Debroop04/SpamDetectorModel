'use client';

import Link from 'next/link';
import { useState } from 'react';
import useSWR from 'swr';
import {
  ArrowRight,
  BadgeCheck,
  Check,
  FileText,
  Globe,
  MapPinned,
  Phone,
  PhoneCall,
  PhoneIncoming,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Siren,
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useLive } from '@/lib/live';
import { setupSteps } from '@/lib/setup';
import { cn } from '@/lib/cn';
import { formatPhone, statusLabel, timeAgo } from '@/lib/format';
import type { Call, CallPage, Report, Stats, SystemStatus, Verdict } from '@/lib/types';
import { Card, CardHeader } from '@/components/ui/card';
import { ButtonLink } from '@/components/ui/button';
import { ReportStatusBadge, VerdictBadge } from '@/components/ui/badge';
import { Empty, Skeleton } from '@/components/ui/feedback';
import { OutcomeBar, RiskMeter, StatTile, WeekChart } from '@/components/charts';
import { LiveCallCard } from '@/components/calls/live-call';
import { CallSheet } from '@/components/calls/call-sheet';
import { MapView } from '@/components/map';
import { HeroRings } from '@/components/hero-rings';

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function HeroStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="min-w-0">
      <div className="text-[34px] leading-none font-semibold tracking-tight text-hero-ink">{value.toLocaleString('en-IN')}</div>
      <div className="mt-2 text-[13px] text-hero-muted">{label}</div>
    </div>
  );
}

function ProtectionHero({ stats, system, reports }: { stats?: Stats; system?: SystemStatus; reports?: Report[] }) {
  const { user } = useAuth();
  if (!user) return null;
  const steps = setupSteps(user, system);
  const done = steps.filter((s) => s.done).length;
  const ready = Boolean(user.line_number && system?.twilio_sync?.ok);
  const today = stats?.last_7_days.at(-1);
  const todayKey = new Date().toDateString();
  const reportsToday = reports?.filter((r) => new Date(r.created_at).toDateString() === todayKey).length ?? 0;
  const next = steps.filter((s) => !s.done).slice(0, 3);

  return (
    <div className="relative flex h-full flex-col overflow-hidden rounded-2xl bg-hero p-6 shadow-card sm:p-8">
      <HeroRings className="-top-24 -right-24" />
      <div className="relative mb-8 flex flex-wrap items-start gap-4">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-hero-tile text-hero-ink">
          {ready ? <ShieldCheck className="h-6 w-6" /> : <ShieldAlert className="h-6 w-6" />}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-2xl font-semibold tracking-tight text-hero-ink">{ready ? 'Protection is on' : 'Finish setup to turn on protection'}</h2>
          <div className="mt-2 flex flex-wrap gap-2">
            {user.line_number && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-hero-tile px-3 py-1 text-xs font-medium text-hero-ink">
                <Phone className="h-3 w-3" />
                {formatPhone(user.line_number)}
              </span>
            )}
            {user.station && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-hero-tile px-3 py-1 text-xs font-medium text-hero-ink">
                <MapPinned className="h-3 w-3" />
                {user.station.name}
              </span>
            )}
          </div>
        </div>
      </div>

      {ready || done === steps.length ? (
        <div className="relative mt-auto grid grid-cols-3 gap-6 border-t border-hero-line pt-6">
          <HeroStat label="Calls today" value={today?.total ?? 0} />
          <HeroStat label="Scams blocked today" value={today?.spam ?? 0} />
          <HeroStat label="Reports today" value={reportsToday} />
        </div>
      ) : (
        <div className="relative mt-auto border-t border-hero-line pt-6">
          <div className="flex items-center justify-between text-sm text-hero-ink">
            <span className="font-medium">
              {done} of {steps.length} steps done
            </span>
            <Link href={next[0]?.href ?? '/settings'} className="inline-flex items-center gap-1.5 rounded-lg bg-hero-ink px-3.5 py-2 text-[13px] font-semibold text-hero">
              Continue
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="mt-4 flex gap-1.5">
            {steps.map((step) => (
              <span key={step.key} className={cn('h-1.5 flex-1 rounded-full', step.done ? 'bg-hero-ink' : 'bg-hero-tile')} />
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {next.map((step) => (
              <Link key={step.key} href={step.href} className="rounded-full border border-hero-line px-3 py-1.5 text-xs font-medium text-hero-ink hover:bg-hero-tile">
                {step.label}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StationCard() {
  const { user } = useAuth();
  if (!user) return null;
  return (
    <Card className="flex flex-col overflow-hidden">
      {user.lat !== null && user.lng !== null ? (
        <>
          <div className="relative h-48 border-b border-line">
            <MapView
              home={{ lat: user.lat, lng: user.lng }}
              stations={user.station ? [user.station] : []}
              selectedStationId={user.station?.id}
              line={user.station ? [[user.lat, user.lng], [user.station.lat, user.station.lng]] : null}
              interactive={false}
            />
          </div>
          <div className="flex flex-1 flex-col justify-between gap-4 p-5">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent">
                <Shield className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <div className="truncate text-[15px] font-semibold text-ink">{user.station?.name || 'No station selected'}</div>
                <div className="mt-0.5 truncate text-[13px] text-ink-3">
                  {user.station?.distance_km != null ? `${user.station.distance_km.toFixed(1)} km · ` : ''}
                  {user.station?.email || 'Email not set'}
                </div>
              </div>
            </div>
            <ButtonLink href="/map" variant="secondary" size="sm" className="w-full">
              Open map
            </ButtonLink>
          </div>
        </>
      ) : (
        <Empty
          className="flex-1"
          icon={<MapPinned className="h-5 w-5" />}
          title="Set your location to find the nearest police station"
          action={
            <ButtonLink href="/settings?tab=location" variant="secondary" size="sm">
              Set location
            </ButtonLink>
          }
        />
      )}
    </Card>
  );
}

const avatarTone: Record<Verdict, string> = {
  pending: 'bg-subtle text-ink-3',
  safe: 'bg-safe-soft text-safe',
  suspicious: 'bg-warn-soft text-warn',
  spam: 'bg-danger-soft text-danger',
};

function CallRow({ call, onOpen }: { call: Call; onOpen: () => void }) {
  return (
    <button type="button" onClick={onOpen} className="grid w-full grid-cols-[auto_1fr_auto] items-center gap-4 px-5 py-3.5 text-left transition-colors hover:bg-subtle sm:grid-cols-[auto_1fr_140px_auto]">
      <span className={cn('flex h-10 w-10 items-center justify-center rounded-full', avatarTone[call.verdict])}>
        {call.channel === 'browser' ? <Globe className="h-4 w-4" /> : <PhoneIncoming className="h-4 w-4" />}
      </span>
      <div className="min-w-0">
        <div className="truncate text-sm font-semibold text-ink">{call.caller_name || formatPhone(call.caller_number)}</div>
        <div className="truncate text-xs text-ink-3">
          {call.category || statusLabel[call.status]} · {timeAgo(call.started_at)}
        </div>
      </div>
      <div className="hidden sm:block">
        <RiskMeter score={call.risk_score} size="sm" />
      </div>
      <VerdictBadge verdict={call.verdict} />
    </button>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const { activeCalls } = useLive();
  const [openCall, setOpenCall] = useState<number | null>(null);
  const { data: stats } = useSWR<Stats>('/api/stats');
  const { data: system } = useSWR<SystemStatus>('/api/system/status');
  const { data: calls } = useSWR<CallPage>('/api/calls?limit=6');
  const { data: reports } = useSWR<Report[]>('/api/reports?limit=200');

  if (!user) return null;
  const week = stats?.last_7_days ?? [];
  const weekTotal = week.reduce((s, d) => s + d.total, 0);
  const weekSpam = week.reduce((s, d) => s + d.spam, 0);
  const waiting = reports?.filter((r) => r.status === 'sent').length ?? 0;
  const safe = stats?.safe ?? 0;
  const pending = stats ? Math.max(0, stats.screened - safe - stats.suspicious - stats.blocked) : 0;
  const maxCategory = Math.max(1, ...(stats?.top_categories.map((c) => c.count) ?? [1]));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-[30px] leading-tight font-semibold tracking-tight text-ink">
          {greeting()}, {user.name.split(' ')[0]}
        </h1>
        <div className="flex flex-wrap gap-2">
          <ButtonLink href="/test-call" variant="secondary">
            <PhoneCall className="h-4 w-4" />
            Test call
          </ButtonLink>
          <ButtonLink href="/numbers#report">
            <Siren className="h-4 w-4" />
            Report a number
          </ButtonLink>
        </div>
      </div>

      {activeCalls.length > 0 && (
        <div className="space-y-4">
          {activeCalls.slice(0, 2).map((call) => (
            <LiveCallCard key={call.id} call={call} />
          ))}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <ProtectionHero stats={stats} system={system} reports={reports} />
        </div>
        <StationCard />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats ? (
          <>
            <StatTile
              label="Calls screened"
              value={stats.screened}
              icon={<PhoneIncoming className="h-4.5 w-4.5" />}
              tone="accent"
              spark={week.map((d) => d.total)}
              footer={`${weekTotal} this week`}
              href="/calls"
            />
            <StatTile
              label="Scams blocked"
              value={stats.blocked}
              icon={<Shield className="h-4.5 w-4.5" />}
              tone="danger"
              spark={week.map((d) => d.spam)}
              footer={`${weekSpam} this week · ${stats.screened ? Math.round((stats.blocked / stats.screened) * 100) : 0}% of calls`}
              href="/calls?verdict=spam"
            />
            <StatTile
              label="Reports sent"
              value={stats.reports_sent}
              icon={<FileText className="h-4.5 w-4.5" />}
              tone="neutral"
              footer={`${waiting} waiting for the police`}
              href="/reports"
            />
            <StatTile
              label="Police acknowledged"
              value={stats.reports_acknowledged}
              icon={<BadgeCheck className="h-4.5 w-4.5" />}
              tone="safe"
              footer={`${stats.reports_sent ? Math.round((stats.reports_acknowledged / stats.reports_sent) * 100) : 0}% of sent reports`}
              href="/reports"
            />
          </>
        ) : (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-37.5 rounded-2xl" />)
        )}
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader
            title="Weekly activity"
            actions={stats && <span className="tabular text-sm font-semibold text-ink">{weekTotal} calls</span>}
          />
          <div className="p-5">{stats ? <WeekChart days={week} /> : <Skeleton className="h-52" />}</div>
        </Card>

        <Card>
          <CardHeader title="Call outcomes" />
          <div className="space-y-6 p-5">
            {stats ? (
              <OutcomeBar
                parts={[
                  { label: 'Safe', value: safe, className: 'bg-safe' },
                  { label: 'Suspicious', value: stats.suspicious, className: 'bg-warn' },
                  { label: 'Scam', value: stats.blocked, className: 'bg-danger' },
                  { label: 'Not screened', value: pending, className: 'bg-line-strong' },
                ]}
              />
            ) : (
              <Skeleton className="h-36" />
            )}
            {stats && stats.top_categories.length > 0 && (
              <div className="border-t border-line pt-5">
                <div className="mb-3 text-[13px] font-semibold text-ink">Top scam types</div>
                <ul className="space-y-3">
                  {stats.top_categories.map((c) => (
                    <li key={c.category}>
                      <div className="mb-1.5 flex justify-between text-[13px]">
                        <span className="truncate text-ink-2">{c.category}</span>
                        <span className="tabular font-semibold text-ink">{c.count}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-danger-soft">
                        <div className="h-1.5 rounded-full bg-chart-scam" style={{ width: `${(c.count / maxCategory) * 100}%` }} />
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="overflow-hidden xl:col-span-2">
          <CardHeader
            title="Recent calls"
            actions={
              <Link href="/calls" className="inline-flex items-center gap-1 text-[13px] font-medium text-accent hover:text-accent-hover">
                View all
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            }
          />
          {!calls ? (
            <div className="space-y-2 p-5">
              <Skeleton className="h-12" />
              <Skeleton className="h-12" />
              <Skeleton className="h-12" />
            </div>
          ) : calls.items.length === 0 ? (
            <Empty icon={<PhoneIncoming className="h-5 w-5" />} title="No calls yet" />
          ) : (
            <div className="divide-y divide-line">
              {calls.items.map((call) => (
                <CallRow key={call.id} call={call} onOpen={() => setOpenCall(call.id)} />
              ))}
            </div>
          )}
        </Card>

        <Card className="overflow-hidden">
          <CardHeader
            title="Police reports"
            actions={
              <Link href="/reports" className="inline-flex items-center gap-1 text-[13px] font-medium text-accent hover:text-accent-hover">
                View all
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            }
          />
          {!reports ? (
            <div className="space-y-2 p-5">
              <Skeleton className="h-12" />
              <Skeleton className="h-12" />
            </div>
          ) : reports.length === 0 ? (
            <Empty icon={<FileText className="h-5 w-5" />} title="No reports yet" />
          ) : (
            <ul className="divide-y divide-line">
              {reports.slice(0, 6).map((report) => (
                <li key={report.id}>
                  <Link href={`/reports/${report.id}`} className="flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-subtle">
                    <span
                      className={cn(
                        'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
                        report.status === 'acknowledged' ? 'bg-safe-soft text-safe' : 'bg-accent-soft text-accent',
                      )}
                    >
                      {report.status === 'acknowledged' ? <Check className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold text-ink">{formatPhone(report.caller_number)}</div>
                      <div className="truncate text-xs text-ink-3">
                        {report.reference} · {timeAgo(report.created_at)}
                      </div>
                    </div>
                    <ReportStatusBadge status={report.status} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <CallSheet callId={openCall} onClose={() => setOpenCall(null)} />
    </div>
  );
}
