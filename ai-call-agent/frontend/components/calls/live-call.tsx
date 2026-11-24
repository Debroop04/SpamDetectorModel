'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import useSWR from 'swr';
import { Ban, Globe, Phone, PhoneForwarded, PhoneIncoming, Radio } from 'lucide-react';
import { api } from '@/lib/api';
import { useLive } from '@/lib/live';
import { formatDuration, formatPhone, statusLabel } from '@/lib/format';
import type { Call, CallDetail } from '@/lib/types';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge, VerdictBadge } from '@/components/ui/badge';
import { RiskMeter } from '@/components/charts';
import { useToast } from '@/components/ui/toast';
import { Transcript, type TranscriptLine } from './transcript';

function useElapsed(startedAt: string) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  return Math.max(0, Math.round((now - new Date(startedAt).getTime()) / 1000));
}

export function LiveCallCard({ call, compact }: { call: Call; compact?: boolean }) {
  const { turns } = useLive();
  const { data: detail } = useSWR<CallDetail>(`/api/calls/${call.id}`);
  const toast = useToast();
  const [busy, setBusy] = useState<'block' | 'connect' | null>(null);
  const elapsed = useElapsed(call.started_at);
  const scrollRef = useRef<HTMLDivElement>(null);

  const lines: TranscriptLine[] = useMemo(() => {
    const stored = detail?.turns ?? [];
    const live = turns[call.id] ?? [];
    const seen = new Set(stored.map((t) => `${t.speaker}:${t.text}`));
    return [...stored, ...live.filter((t) => !seen.has(`${t.speaker}:${t.text}`))];
  }, [detail, turns, call.id]);

  // Scroll only the transcript box, never the page.
  useEffect(() => {
    const box = scrollRef.current;
    if (box) box.scrollTo({ top: box.scrollHeight, behavior: 'smooth' });
  }, [lines.length]);

  async function act(action: 'block' | 'connect') {
    setBusy(action);
    try {
      await api(`/api/calls/${call.id}/${action}`, { method: 'POST' });
      toast(action === 'block' ? 'Call ended and reported' : 'Ringing your phone now', action === 'block' ? 'error' : 'success');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Action failed', 'error');
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center gap-4 border-b border-line px-5 py-4">
        <span className="relative flex h-11 w-11 items-center justify-center rounded-full bg-accent-soft text-accent">
          <PhoneIncoming className="h-5 w-5" />
          <span className="absolute -top-0.5 -right-0.5 rounded-full border-2 border-surface">
            <span className="live-dot block text-danger" />
          </span>
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate text-base font-semibold text-ink">{call.caller_name || formatPhone(call.caller_number)}</span>
            {call.channel === 'browser' && (
              <Badge>
                <Globe className="h-3 w-3" />
                Browser
              </Badge>
            )}
          </div>
          <div className="mt-0.5 flex items-center gap-2 text-[13px] text-ink-3">
            {call.caller_name && <span>{formatPhone(call.caller_number)}</span>}
            <span className="flex items-center gap-1">
              <Radio className="h-3.5 w-3.5" />
              {statusLabel[call.status]}
            </span>
            <span className="tabular">{formatDuration(elapsed)}</span>
          </div>
        </div>
        <VerdictBadge verdict={call.verdict} live />
      </div>

      <div className={compact ? '' : 'grid lg:grid-cols-[1fr_300px]'}>
        <div ref={scrollRef} className="max-h-80 min-h-40 overflow-y-auto px-5 py-4">
          <Transcript lines={lines} live />
        </div>
        <div className="space-y-4 border-t border-line bg-subtle/60 px-5 py-4 lg:border-t-0 lg:border-l">
          <div>
            <div className="mb-2 text-xs font-medium text-ink-3">Risk</div>
            <RiskMeter score={call.risk_score} />
          </div>
          {call.category && (
            <div>
              <div className="mb-1 text-xs font-medium text-ink-3">Detected</div>
              <div className="text-sm font-medium text-ink">{call.category}</div>
            </div>
          )}
          {call.reasons.length > 0 && call.verdict !== 'safe' && (
            <ul className="space-y-1.5 text-[13px] leading-snug text-ink-2">
              {call.reasons.slice(0, 3).map((reason) => (
                <li key={reason} className="flex gap-2">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-ink-3" />
                  {reason}
                </li>
              ))}
            </ul>
          )}
          {call.status === 'screening' && (
            <div className="flex flex-col gap-2 pt-1">
              <Button variant="danger" loading={busy === 'block'} disabled={busy !== null} onClick={() => act('block')}>
                <Ban className="h-4 w-4" />
                Block and report
              </Button>
              <Button variant="secondary" loading={busy === 'connect'} disabled={busy !== null} onClick={() => act('connect')}>
                <PhoneForwarded className="h-4 w-4" />
                Connect now
              </Button>
            </div>
          )}
          {call.status === 'forwarding' && (
            <div className="flex items-center gap-2 rounded-lg bg-safe-soft px-3 py-2.5 text-[13px] font-medium text-safe-ink">
              <Phone className="h-4 w-4" />
              Ringing your phone
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
