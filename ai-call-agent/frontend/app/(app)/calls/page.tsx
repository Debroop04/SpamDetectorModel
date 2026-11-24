'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import useSWR from 'swr';
import {
  Ban,
  ChevronLeft,
  ChevronRight,
  PhoneCall,
  PhoneForwarded,
  PhoneIncoming,
  PhoneMissed,
  PhoneOff,
  Radio,
  Search,
  ShieldAlert,
  ShieldCheck,
  ShieldX,
  Voicemail,
  X,
} from 'lucide-react';
import { formatDateTime, formatPhone, statusLabel, timeAgo } from '@/lib/format';
import type { CallPage, CallStatus, Stats, Verdict } from '@/lib/types';
import { Card, PageHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/field';
import { VerdictBadge } from '@/components/ui/badge';
import { Button, ButtonLink } from '@/components/ui/button';
import { Empty, Skeleton } from '@/components/ui/feedback';
import { FilterTile, RiskMeter } from '@/components/charts';
import { CallSheet } from '@/components/calls/call-sheet';
import { CallAvatar, CallListItem } from '@/components/calls/call-list';

type Filter = 'all' | Exclude<Verdict, 'pending'>;
const PAGE_SIZE = 25;

const FILTER_TITLE: Record<Filter, string> = {
  all: 'All calls',
  spam: 'Scam calls',
  suspicious: 'Suspicious calls',
  safe: 'Safe calls',
};

const statusIcon: Record<CallStatus, React.ElementType> = {
  screening: Radio,
  forwarding: PhoneForwarded,
  connected: PhoneCall,
  voicemail: Voicemail,
  blocked: Ban,
  missed: PhoneMissed,
  ended: PhoneOff,
};

function CallsView() {
  const params = useSearchParams();
  const router = useRouter();
  const initial = params.get('verdict');
  const [filter, setFilter] = useState<Filter>(initial === 'spam' || initial === 'suspicious' || initial === 'safe' ? initial : 'all');
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [page, setPage] = useState(0);
  const openParam = params.get('open');
  const [openCall, setOpenCall] = useState<number | null>(openParam ? Number(openParam) : null);
  const { data: stats } = useSWR<Stats>('/api/stats');

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebounced(query.trim());
      setPage(0);
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);

  function changeFilter(next: Filter) {
    setFilter(next);
    setPage(0);
  }

  const search = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(page * PAGE_SIZE) });
  if (filter !== 'all') search.set('verdict', filter);
  if (debounced) search.set('q', debounced);
  const { data, isLoading } = useSWR<CallPage>(`/api/calls?${search.toString()}`);

  function open(id: number | null) {
    setOpenCall(id);
    router.replace(id ? `/calls?open=${id}` : '/calls', { scroll: false });
  }

  const pages = data ? Math.ceil(data.total / PAGE_SIZE) : 0;

  return (
    <>
      <PageHeader
        title="Calls"
        actions={
          <ButtonLink href="/test-call" variant="secondary">
            <PhoneCall className="h-4 w-4" />
            Test call
          </ButtonLink>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-4 xl:grid-cols-4">
        <FilterTile label="All calls" value={stats?.screened} icon={<PhoneIncoming className="h-5 w-5" />} tone="accent" active={filter === 'all'} onClick={() => changeFilter('all')} />
        <FilterTile label="Scam" value={stats?.blocked} icon={<ShieldX className="h-5 w-5" />} tone="danger" active={filter === 'spam'} onClick={() => changeFilter('spam')} />
        <FilterTile label="Suspicious" value={stats?.suspicious} icon={<ShieldAlert className="h-5 w-5" />} tone="warn" active={filter === 'suspicious'} onClick={() => changeFilter('suspicious')} />
        <FilterTile label="Safe" value={stats?.safe} icon={<ShieldCheck className="h-5 w-5" />} tone="safe" active={filter === 'safe'} onClick={() => changeFilter('safe')} />
      </div>

      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-3.5">
          <h2 className="flex items-center gap-2.5 text-[15px] font-semibold tracking-tight text-ink">
            {FILTER_TITLE[filter]}
            {data && <span className="tabular rounded-full bg-subtle px-2 py-0.5 text-xs font-semibold text-ink-2">{data.total}</span>}
          </h2>
          <div className="relative w-full sm:w-80">
            <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-ink-3" />
            <Input className="pr-9 pl-9" placeholder="Search number, name or type" value={query} onChange={(e) => setQuery(e.target.value)} />
            {query && (
              <button onClick={() => setQuery('')} className="absolute top-1/2 right-2 -translate-y-1/2 rounded-md p-1 text-ink-3 hover:bg-subtle hover:text-ink" aria-label="Clear search">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {isLoading && !data ? (
          <div className="space-y-3 p-5">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-12" />
            ))}
          </div>
        ) : !data || data.items.length === 0 ? (
          <Empty icon={<PhoneIncoming className="h-5 w-5" />} title={debounced || filter !== 'all' ? 'No calls match' : 'No calls yet'} />
        ) : (
          <>
            <div className="divide-y divide-line md:hidden">
              {data.items.map((call) => (
                <CallListItem key={call.id} call={call} onClick={() => open(call.id)} />
              ))}
            </div>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-[11px] font-semibold tracking-wider text-ink-3 uppercase">
                    <th className="px-5 py-3 font-semibold">Caller</th>
                    <th className="px-3 py-3 font-semibold">Result</th>
                    <th className="px-3 py-3 font-semibold">Type</th>
                    <th className="w-44 px-3 py-3 font-semibold">Risk</th>
                    <th className="px-3 py-3 font-semibold">Outcome</th>
                    <th className="px-5 py-3 text-right font-semibold">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {data.items.map((call) => {
                    const StatusIcon = statusIcon[call.status];
                    return (
                      <tr key={call.id} onClick={() => open(call.id)} className="cursor-pointer transition-colors hover:bg-subtle">
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-3">
                            <CallAvatar call={call} size="sm" />
                            <div className="min-w-0">
                              <div className="truncate font-semibold text-ink">{call.caller_name || formatPhone(call.caller_number)}</div>
                              <div className="truncate text-xs text-ink-3">
                                {call.caller_name ? formatPhone(call.caller_number) : call.channel === 'browser' ? 'Browser test call' : 'Phone call'}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3.5">
                          <VerdictBadge verdict={call.verdict} live={call.status === 'screening'} />
                        </td>
                        <td className="max-w-52 truncate px-3 py-3.5 text-ink-2">{call.category || '—'}</td>
                        <td className="px-3 py-3.5">
                          <RiskMeter score={call.risk_score} size="sm" />
                        </td>
                        <td className="px-3 py-3.5">
                          <span className="inline-flex items-center gap-1.5 text-ink-2">
                            <StatusIcon className="h-3.5 w-3.5 text-ink-3" />
                            {statusLabel[call.status]}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-right whitespace-nowrap">
                          <div className="tabular text-[13px] text-ink">{formatDateTime(call.started_at)}</div>
                          <div className="text-xs text-ink-3">{timeAgo(call.started_at)}</div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}

        {data && data.total > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-5 py-3 text-[13px] text-ink-3">
            <span className="tabular">
              Showing <span className="font-semibold text-ink">{page * PAGE_SIZE + 1}</span>–
              <span className="font-semibold text-ink">{Math.min((page + 1) * PAGE_SIZE, data.total)}</span> of{' '}
              <span className="font-semibold text-ink">{data.total}</span>
            </span>
            {pages > 1 && (
              <div className="flex items-center gap-2">
                <Button variant="secondary" size="icon" className="h-8 w-8" disabled={page === 0} onClick={() => setPage((p) => p - 1)} aria-label="Previous page">
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="tabular px-1 text-ink-2">
                  {page + 1} / {pages}
                </span>
                <Button variant="secondary" size="icon" className="h-8 w-8" disabled={page + 1 >= pages} onClick={() => setPage((p) => p + 1)} aria-label="Next page">
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        )}
      </Card>

      <CallSheet callId={openCall} onClose={() => open(null)} />
    </>
  );
}

export default function CallsPage() {
  return (
    <Suspense>
      <CallsView />
    </Suspense>
  );
}
