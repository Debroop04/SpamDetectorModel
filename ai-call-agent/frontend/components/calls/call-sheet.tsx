'use client';

import Link from 'next/link';
import { useState } from 'react';
import useSWR, { mutate } from 'swr';
import { ArrowUpRight, Ban, Calendar, CheckCircle2, Clock, FileText, Globe, Languages, Phone, ShieldAlert, ShieldCheck, Users } from 'lucide-react';
import { api, authedUrl } from '@/lib/api';
import { cn } from '@/lib/cn';
import { formatDateTime, formatDuration, formatPhone, percent, statusLabel, verdictTone } from '@/lib/format';
import type { CallDetail, Report } from '@/lib/types';
import { Sheet } from '@/components/ui/overlay';
import { Button } from '@/components/ui/button';
import { Badge, ReportStatusBadge, VerdictBadge } from '@/components/ui/badge';
import { Fact, IconTile } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/feedback';
import { RiskMeter } from '@/components/charts';
import { useToast } from '@/components/ui/toast';
import { CallAvatar } from './call-list';
import { Transcript } from './transcript';

function Section({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn('border-b border-line px-5 py-5 last:border-0', className)}>
      <h3 className="mb-3.5 text-[13px] font-semibold text-ink">{title}</h3>
      {children}
    </section>
  );
}

function Signal({ label, value }: { label: string; value: number | null | undefined }) {
  return (
    <div className="grid grid-cols-[120px_1fr] items-center gap-3">
      <span className="text-[13px] text-ink-2">{label}</span>
      {value === null || value === undefined ? <span className="text-[13px] text-ink-3">Not used</span> : <RiskMeter score={value} size="sm" />}
    </div>
  );
}

const ringTone = { safe: 'border-safe', warn: 'border-warn', danger: 'border-danger', accent: 'border-accent', neutral: 'border-line-strong' };

export function CallSheet({ callId, onClose }: { callId: number | null; onClose: () => void }) {
  const { data: call } = useSWR<CallDetail>(callId ? `/api/calls/${callId}` : null);
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);

  async function run(key: string, task: () => Promise<unknown>, message: string) {
    setBusy(key);
    try {
      await task();
      toast(message);
      mutate(`/api/calls/${callId}`);
      mutate((k) => typeof k === 'string' && (k.startsWith('/api/calls?') || k.startsWith('/api/reports')));
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Action failed', 'error');
    } finally {
      setBusy(null);
    }
  }

  const hasNumber = call?.caller_number.startsWith('+');

  return (
    <Sheet
      open={callId !== null}
      onClose={onClose}
      title="Call details"
      headerExtra={call && <VerdictBadge verdict={call.verdict} live={call.status === 'screening'} />}
      footer={
        call &&
        hasNumber && (
          <>
            {call.rule !== 'allow' && (
              <Button
                variant="secondary"
                loading={busy === 'allow'}
                onClick={() => run('allow', () => api('/api/numbers/rules', { method: 'PUT', body: { number: call.caller_number, kind: 'allow' } }), 'Number added to trusted list')}
              >
                <ShieldCheck className="h-4 w-4" />
                Trust
              </Button>
            )}
            {call.rule !== 'block' && (
              <Button
                variant="secondary"
                loading={busy === 'block'}
                onClick={() => run('block', () => api('/api/numbers/rules', { method: 'PUT', body: { number: call.caller_number, kind: 'block' } }), 'Number blocked')}
              >
                <Ban className="h-4 w-4" />
                Block
              </Button>
            )}
            {!call.report && (
              <Button
                variant="danger"
                loading={busy === 'report'}
                onClick={() => run('report', () => api<Report>(`/api/calls/${call.id}/report`, { method: 'POST' }), 'Report created and sent')}
              >
                <FileText className="h-4 w-4" />
                Report to police
              </Button>
            )}
          </>
        )
      }
    >
      {!call ? (
        <div className="space-y-4 p-5">
          <Skeleton className="h-24" />
          <Skeleton className="h-40" />
        </div>
      ) : (
        <>
          <div className="border-b border-line px-5 py-6">
            <div className="flex items-center gap-4">
              <CallAvatar call={call} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-lg font-semibold tracking-tight text-ink">{call.caller_name || formatPhone(call.caller_number)}</div>
                <div className="truncate text-[13px] text-ink-3">{call.caller_name ? formatPhone(call.caller_number) : statusLabel[call.status]}</div>
              </div>
              <div
                className={cn(
                  'flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-full border-4 bg-surface',
                  ringTone[verdictTone[call.verdict]],
                )}
                aria-label={`Risk ${percent(call.risk_score)}`}
              >
                <span className="tabular text-base leading-none font-semibold text-ink">{percent(call.risk_score)}</span>
                <span className="mt-0.5 text-[10px] font-medium text-ink-3">risk</span>
              </div>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
              <Fact label="When" icon={<Calendar />}>
                {formatDateTime(call.started_at)}
              </Fact>
              <Fact label="Outcome" icon={<Phone />}>
                {statusLabel[call.status]}
              </Fact>
              <Fact label="Duration" icon={<Clock />}>
                {formatDuration(call.duration)}
              </Fact>
              <Fact label="Line" icon={<Globe />}>
                {call.channel === 'browser' ? 'Browser test' : 'Phone'}
              </Fact>
              <Fact label="Language" icon={<Languages />}>
                {call.language === 'hi' ? 'Hindi' : 'English'}
              </Fact>
              <Fact label="Reports on number" icon={<Users />}>
                {call.number_reports}
              </Fact>
            </div>
            {call.rule && (
              <div className="mt-3">
                <Badge tone={call.rule === 'allow' ? 'safe' : 'danger'} dot>
                  {call.rule === 'allow' ? 'On your trusted list' : 'On your block list'}
                </Badge>
              </div>
            )}
          </div>

          <Section title="Risk assessment">
            <div className="mb-4 flex items-center gap-3 rounded-xl border border-line bg-bg px-4 py-3">
              <IconTile tone={verdictTone[call.verdict]} size="sm">
                {call.verdict === 'spam' ? <Ban /> : call.verdict === 'suspicious' ? <ShieldAlert /> : <ShieldCheck />}
              </IconTile>
              <span className="flex-1 text-sm font-medium text-ink">{call.category || 'No scam pattern found'}</span>
            </div>
            <div className="space-y-3">
              <Signal label="Spam model" value={call.signals.model_score} />
              <Signal label="Scam phrases" value={call.signals.rule_score} />
              <Signal label="Number history" value={call.signals.reputation_score} />
            </div>
            {call.reasons.length > 0 && (
              <ul className="mt-5 space-y-2.5 text-[13px] leading-snug text-ink-2">
                {call.reasons.map((reason) => (
                  <li key={reason} className="flex gap-2.5">
                    <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-3" />
                    {reason}
                  </li>
                ))}
              </ul>
            )}
          </Section>

          {call.report && (
            <Section title="Police report">
              <Link
                href={`/reports/${call.report.id}`}
                className="flex items-center gap-3 rounded-xl border border-line px-4 py-3 transition-colors hover:border-line-strong hover:bg-subtle"
              >
                <IconTile tone={call.report.status === 'acknowledged' ? 'safe' : 'accent'} size="sm">
                  <FileText />
                </IconTile>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-ink">{call.report.reference}</div>
                  <div className="truncate text-xs text-ink-3">{call.report.station_name || 'Finding nearest station'}</div>
                </div>
                <ReportStatusBadge status={call.report.status} />
                <ArrowUpRight className="h-4 w-4 text-ink-3" />
              </Link>
            </Section>
          )}

          {call.has_recording && (
            <Section title="Voicemail">
              <audio controls preload="none" className="w-full" src={authedUrl(`/api/calls/${call.id}/recording`)} />
            </Section>
          )}

          <Section title="Conversation">
            <Transcript lines={call.turns} />
          </Section>
        </>
      )}
    </Sheet>
  );
}
