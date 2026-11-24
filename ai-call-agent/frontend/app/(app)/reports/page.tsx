'use client';

import Link from 'next/link';
import { useState } from 'react';
import useSWR from 'swr';
import { AlertTriangle, BadgeCheck, ChevronRight, Clock, FileText, MapPin, Siren } from 'lucide-react';
import { cn } from '@/lib/cn';
import { formatDateTime, formatPhone, timeAgo, type Tone } from '@/lib/format';
import type { Report, ReportStatus } from '@/lib/types';
import { Card, IconTile, PageHeader } from '@/components/ui/card';
import { Badge, ReportStatusBadge } from '@/components/ui/badge';
import { ButtonLink } from '@/components/ui/button';
import { Empty, Skeleton } from '@/components/ui/feedback';
import { FilterTile } from '@/components/charts';

type Filter = 'all' | 'sent' | 'acknowledged' | 'attention';

const FILTER_TITLE: Record<Filter, string> = {
  all: 'All reports',
  sent: 'Waiting for the police',
  acknowledged: 'Acknowledged',
  attention: 'Needs attention',
};

const statusTone: Record<ReportStatus, Tone> = {
  queued: 'neutral',
  sent: 'accent',
  acknowledged: 'safe',
  needs_email: 'warn',
  failed: 'danger',
};

const statusIcon: Record<ReportStatus, React.ElementType> = {
  queued: Clock,
  sent: FileText,
  acknowledged: BadgeCheck,
  needs_email: AlertTriangle,
  failed: AlertTriangle,
};

/** Three short bars: created, emailed, acknowledged. */
function Progress({ status }: { status: ReportStatus }) {
  const stage = status === 'acknowledged' ? 3 : status === 'sent' ? 2 : 1;
  const problem = status === 'failed' || status === 'needs_email';
  return (
    <div className="flex gap-1" aria-label={`Step ${stage} of 3`}>
      {[1, 2, 3].map((step) => (
        <span
          key={step}
          className={cn(
            'h-1.5 w-7 rounded-full',
            step <= stage ? (problem ? 'bg-warn' : status === 'acknowledged' ? 'bg-safe' : 'bg-accent') : 'bg-muted',
          )}
        />
      ))}
    </div>
  );
}

export default function ReportsPage() {
  const { data: reports } = useSWR<Report[]>('/api/reports?limit=200');
  const [filter, setFilter] = useState<Filter>('all');

  const counts = reports && {
    all: reports.length,
    sent: reports.filter((r) => r.status === 'sent').length,
    acknowledged: reports.filter((r) => r.status === 'acknowledged').length,
    attention: reports.filter((r) => r.status === 'failed' || r.status === 'needs_email').length,
  };
  const visible = (reports ?? []).filter((r) => {
    if (filter === 'all') return true;
    if (filter === 'attention') return r.status === 'failed' || r.status === 'needs_email';
    return r.status === filter;
  });

  return (
    <>
      <PageHeader
        title="Police reports"
        actions={
          <ButtonLink href="/numbers#report">
            <Siren className="h-4 w-4" />
            New report
          </ButtonLink>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-4 xl:grid-cols-4">
        <FilterTile label="All reports" value={counts?.all} icon={<FileText className="h-5 w-5" />} tone="neutral" active={filter === 'all'} onClick={() => setFilter('all')} />
        <FilterTile label="Waiting for police" value={counts?.sent} icon={<Clock className="h-5 w-5" />} tone="accent" active={filter === 'sent'} onClick={() => setFilter('sent')} />
        <FilterTile label="Acknowledged" value={counts?.acknowledged} icon={<BadgeCheck className="h-5 w-5" />} tone="safe" active={filter === 'acknowledged'} onClick={() => setFilter('acknowledged')} />
        <FilterTile
          label="Needs attention"
          value={counts?.attention}
          icon={<AlertTriangle className="h-5 w-5" />}
          tone={counts?.attention ? 'danger' : 'neutral'}
          active={filter === 'attention'}
          onClick={() => setFilter('attention')}
        />
      </div>

      <Card className="overflow-hidden">
        <div className="flex items-center gap-2.5 border-b border-line px-5 py-4">
          <h2 className="text-[15px] font-semibold tracking-tight text-ink">{FILTER_TITLE[filter]}</h2>
          {reports && <span className="tabular rounded-full bg-subtle px-2 py-0.5 text-xs font-semibold text-ink-2">{visible.length}</span>}
        </div>
        {!reports ? (
          <div className="space-y-3 p-5">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-16" />
            ))}
          </div>
        ) : visible.length === 0 ? (
          <Empty icon={<FileText className="h-5 w-5" />} title={filter === 'all' ? 'No reports yet' : 'Nothing here'} />
        ) : (
          <ul className="divide-y divide-line">
            {visible.map((report) => {
              const Icon = statusIcon[report.status];
              return (
                <li key={report.id}>
                  <Link href={`/reports/${report.id}`} className="group flex items-center gap-4 px-5 py-4 transition-colors hover:bg-subtle">
                    <IconTile tone={statusTone[report.status]}>
                      <Icon />
                    </IconTile>
                    <div className="grid min-w-0 flex-1 gap-2 md:grid-cols-[1.2fr_1.2fr_auto] md:items-center md:gap-6">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-sm font-semibold text-ink">{formatPhone(report.caller_number)}</span>
                          {report.mode === 'test' && <Badge className="h-5 px-1.5 text-[11px]">Test</Badge>}
                        </div>
                        <div className="truncate text-xs text-ink-3">
                          {report.reference} · {report.category}
                        </div>
                      </div>
                      <div className="flex min-w-0 items-center gap-2 text-[13px] text-ink-2">
                        <MapPin className="h-3.5 w-3.5 shrink-0 text-ink-3" />
                        <span className="truncate">{report.station_name || 'Finding nearest station'}</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="hidden text-right lg:block">
                          <Progress status={report.status} />
                          <div className="tabular mt-1.5 text-[11px] text-ink-3" title={formatDateTime(report.created_at)}>
                            {timeAgo(report.created_at)}
                          </div>
                        </div>
                        <ReportStatusBadge status={report.status} />
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-ink-3 transition-transform group-hover:translate-x-0.5" />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </>
  );
}
