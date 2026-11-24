'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import useSWR from 'swr';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowUpRight,
  BadgeCheck,
  Calendar,
  Download,
  ExternalLink,
  FilePlus2,
  FileText,
  Gauge,
  Mail,
  MapPin,
  Navigation,
  Phone,
  PhoneCall,
  RefreshCw,
  Shield,
  Tag,
} from 'lucide-react';
import { api, authedUrl } from '@/lib/api';
import { cn } from '@/lib/cn';
import { formatDateTime, formatPhone } from '@/lib/format';
import type { Report } from '@/lib/types';
import { Card, CardHeader, Fact, IconTile } from '@/components/ui/card';
import { Button, ButtonLink } from '@/components/ui/button';
import { Badge, ReportStatusBadge } from '@/components/ui/badge';
import { Callout, Skeleton } from '@/components/ui/feedback';
import { useToast } from '@/components/ui/toast';
import { RiskMeter } from '@/components/charts';
import { MapView } from '@/components/map';

type StepState = 'done' | 'active' | 'problem' | 'todo';

interface Step {
  icon: React.ElementType;
  title: string;
  detail?: React.ReactNode;
  state: StepState;
}

const circle: Record<StepState, string> = {
  done: 'border-safe bg-safe text-white dark:text-[#04140b]',
  active: 'border-accent bg-accent-soft text-accent',
  problem: 'border-warn bg-warn-soft text-warn',
  todo: 'border-line bg-surface text-ink-3',
};

function Stepper({ steps }: { steps: Step[] }) {
  return (
    <ol className="grid gap-5 md:grid-cols-3 md:gap-0">
      {steps.map((step, i) => {
        const Icon = step.icon;
        const next = steps[i + 1];
        return (
          <li key={step.title} className="relative flex gap-3.5 md:flex-col md:gap-3 md:pr-6">
            {next && (
              <span
                className={cn('absolute top-4.75 right-3 left-13 hidden h-0.5 rounded-full md:block', next.state === 'done' ? 'bg-safe' : 'bg-line')}
                aria-hidden
              />
            )}
            <span className={cn('relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2', circle[step.state])}>
              <Icon className="h-4.5 w-4.5" />
            </span>
            <div className="min-w-0">
              <div className={cn('text-sm font-semibold', step.state === 'todo' ? 'text-ink-3' : 'text-ink')}>{step.title}</div>
              {step.detail && <div className="mt-0.5 text-[13px] leading-relaxed wrap-break-word text-ink-3">{step.detail}</div>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function ContactRow({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 py-3">
      <IconTile size="sm">{icon}</IconTile>
      <div className="min-w-0 flex-1">
        <div className="text-xs text-ink-3">{label}</div>
        <div className="mt-0.5 text-[13px] font-medium wrap-break-word text-ink">{children}</div>
      </div>
    </div>
  );
}

export default function ReportDetailPage() {
  const params = useParams<{ id: string }>();
  const { data: report, mutate } = useSWR<Report>(`/api/reports/${params.id}`);
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  async function resend() {
    setBusy(true);
    try {
      await mutate(api<Report>(`/api/reports/${params.id}/resend`, { method: 'POST' }), { revalidate: false });
      toast('Sending the report again', 'info');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not resend', 'error');
    } finally {
      setBusy(false);
    }
  }

  if (!report) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-52 rounded-2xl" />
        <div className="grid gap-6 lg:grid-cols-2">
          <Skeleton className="h-80 rounded-2xl" />
          <Skeleton className="h-80 rounded-2xl" />
        </div>
      </div>
    );
  }

  const sent = report.status === 'sent' || report.status === 'acknowledged';
  const acknowledged = report.status === 'acknowledged';
  const problem = report.status === 'failed' || report.status === 'needs_email';
  const hasMap = report.lat !== null && report.lng !== null;
  const hasStation = report.station_lat !== null && report.station_lng !== null;

  const steps: Step[] = [
    { icon: FilePlus2, title: 'Complaint created', detail: formatDateTime(report.created_at), state: 'done' },
    {
      icon: Mail,
      title: sent ? 'Emailed to the station' : problem ? 'Email not sent' : 'Sending email',
      detail: sent ? (
        <>
          {report.sent_to}
          {report.sent_at && <span className="block">{formatDateTime(report.sent_at)}</span>}
        </>
      ) : problem ? (
        report.status === 'needs_email' ? 'The station email is missing' : 'Delivery failed'
      ) : undefined,
      state: sent ? 'done' : problem ? 'problem' : 'active',
    },
    {
      icon: BadgeCheck,
      title: acknowledged ? `Acknowledged${report.ack_by ? ` by ${report.ack_by}` : ''}` : 'Police acknowledgement',
      detail: acknowledged ? formatDateTime(report.acknowledged_at) : sent ? 'Waiting for the station' : undefined,
      state: acknowledged ? 'done' : sent ? 'active' : 'todo',
    },
  ];

  return (
    <div className="space-y-6">
      <Link href="/reports" className="inline-flex items-center gap-1.5 text-[13px] font-medium text-ink-3 hover:text-ink">
        <ArrowLeft className="h-4 w-4" />
        Police reports
      </Link>

      <Card className="p-6">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="flex min-w-0 items-start gap-4">
            <IconTile tone={acknowledged ? 'safe' : problem ? 'warn' : 'accent'} size="lg">
              {acknowledged ? <BadgeCheck /> : problem ? <AlertTriangle /> : <FileText />}
            </IconTile>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-[26px] leading-tight font-semibold tracking-tight text-ink">{report.reference}</h1>
                <ReportStatusBadge status={report.status} />
                {report.mode === 'test' && <Badge>Test mode</Badge>}
              </div>
              <div className="mt-2.5 flex flex-wrap gap-2 text-xs font-medium text-ink-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-subtle px-3 py-1">
                  <Phone className="h-3 w-3" />
                  {formatPhone(report.caller_number)}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-subtle px-3 py-1">
                  <Tag className="h-3 w-3" />
                  {report.category}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-subtle px-3 py-1">
                  <Calendar className="h-3 w-3" />
                  {formatDateTime(report.created_at)}
                </span>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {report.public_url && (
              <ButtonLink href={report.public_url} external variant="secondary">
                <ExternalLink className="h-4 w-4" />
                Police view
              </ButtonLink>
            )}
            <ButtonLink href={authedUrl(`/api/reports/${report.id}/pdf`)} external variant="secondary">
              <Download className="h-4 w-4" />
              PDF
            </ButtonLink>
            {!acknowledged && (
              <Button onClick={resend} loading={busy}>
                <RefreshCw className="h-4 w-4" />
                Send again
              </Button>
            )}
          </div>
        </div>
        <div className="mt-6 border-t border-line pt-6">
          <Stepper steps={steps} />
        </div>
      </Card>

      {report.mode === 'test' && sent && (
        <Callout tone="warn" action={<Link href="/settings?tab=screening" className="font-semibold underline-offset-2 hover:underline">Settings</Link>}>
          Test mode: this report was emailed to you instead of the police station.
        </Callout>
      )}
      {problem && report.error && (
        <Callout
          tone="danger"
          action={
            report.status === 'needs_email' ? (
              <Link href="/settings?tab=location" className="font-semibold underline-offset-2 hover:underline">
                Add email
              </Link>
            ) : undefined
          }
        >
          {report.error}
        </Callout>
      )}

      <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
        <div className="space-y-6">
          <Card>
            <CardHeader title="Complaint" icon={<FileText />} tone="accent" />
            <div className="space-y-5 p-5">
              <div className="grid gap-3 sm:grid-cols-2">
                <Fact label="Caller number" icon={<Phone />}>
                  {formatPhone(report.caller_number)}
                </Fact>
                <Fact label="Type of fraud" icon={<Tag />}>
                  {report.category}
                </Fact>
                {report.risk_score !== null && (
                  <Fact label="Risk score" icon={<Gauge />}>
                    <div className="pt-1">
                      <RiskMeter score={report.risk_score} size="sm" />
                    </div>
                  </Fact>
                )}
                <Fact label="Filed from" icon={<MapPin />} className={report.risk_score === null ? 'sm:col-span-2' : undefined}>
                  <span className="line-clamp-2 font-medium">{report.address || '—'}</span>
                </Fact>
              </div>
              <div>
                <div className="mb-2 text-[13px] font-semibold text-ink">What happened</div>
                <p className="rounded-xl border-l-4 border-accent bg-bg px-4 py-3.5 text-[13px] leading-relaxed whitespace-pre-line text-ink-2">{report.summary}</p>
              </div>
              {report.call_id && (
                <Link
                  href={`/calls?open=${report.call_id}`}
                  className="flex items-center gap-3 rounded-xl border border-line px-4 py-3 transition-colors hover:border-line-strong hover:bg-subtle"
                >
                  <IconTile size="sm" tone="accent">
                    <PhoneCall />
                  </IconTile>
                  <span className="flex-1 text-sm font-medium text-ink">Call recording and transcript</span>
                  <ArrowUpRight className="h-4 w-4 text-ink-3" />
                </Link>
              )}
            </div>
          </Card>

          {acknowledged && report.ack_note && (
            <Card className="p-5">
              <div className="flex items-start gap-3">
                <IconTile tone="safe" size="sm">
                  <BadgeCheck />
                </IconTile>
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-ink">Note from {report.ack_by || 'the police station'}</div>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-ink-2">{report.ack_note}</p>
                </div>
              </div>
            </Card>
          )}

          <Card className="flex flex-wrap items-center gap-4 p-5">
            <IconTile tone="danger" size="lg">
              <Phone />
            </IconTile>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-ink">Cyber fraud helpline</div>
              <div className="mt-0.5 text-[13px] text-ink-3">
                <span className="text-lg font-semibold text-ink">1930</span> ·{' '}
                <a href="https://cybercrime.gov.in" target="_blank" rel="noreferrer" className="font-medium text-accent hover:text-accent-hover">
                  cybercrime.gov.in
                </a>
              </div>
            </div>
            <ButtonLink href="tel:1930" external variant="secondary" size="sm">
              <PhoneCall className="h-4 w-4" />
              Call 1930
            </ButtonLink>
          </Card>
        </div>

        <Card className="self-start overflow-hidden">
          {hasMap && (
            <div className="h-64 border-b border-line">
              <MapView
                home={{ lat: report.lat!, lng: report.lng! }}
                stations={
                  hasStation
                    ? [
                        {
                          id: -1,
                          name: report.station_name || 'Police station',
                          lat: report.station_lat!,
                          lng: report.station_lng!,
                          address: report.station_address,
                          phone: report.station_phone,
                          email: report.station_email,
                          email_source: null,
                          distance_km: report.distance_km,
                        },
                      ]
                    : []
                }
                selectedStationId={-1}
                line={hasStation ? [[report.lat!, report.lng!], [report.station_lat!, report.station_lng!]] : null}
              />
            </div>
          )}
          <div className="p-5">
            <div className="flex items-start gap-3">
              <IconTile tone="accent">
                <Shield />
              </IconTile>
              <div className="min-w-0 flex-1">
                <div className="text-base font-semibold tracking-tight text-ink">{report.station_name || 'Police station'}</div>
                {report.distance_km !== null && (
                  <span className="tabular mt-1 inline-flex rounded-full bg-accent-soft px-2.5 py-0.5 text-xs font-semibold text-accent-ink">
                    {report.distance_km.toFixed(1)} km away
                  </span>
                )}
              </div>
            </div>
            <div className="mt-3 divide-y divide-line">
              <ContactRow icon={<MapPin />} label="Address">
                {report.station_address || '—'}
              </ContactRow>
              <ContactRow icon={<Phone />} label="Phone">
                {report.station_phone || '—'}
              </ContactRow>
              <ContactRow icon={<Mail />} label="Email">
                {report.station_email || 'Not known'}
              </ContactRow>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              {report.station_phone ? (
                <ButtonLink href={`tel:${report.station_phone}`} external variant="secondary">
                  <PhoneCall className="h-4 w-4" />
                  Call station
                </ButtonLink>
              ) : (
                <Button variant="secondary" disabled>
                  <PhoneCall className="h-4 w-4" />
                  Call station
                </Button>
              )}
              <ButtonLink
                href={hasStation ? `https://www.google.com/maps/dir/?api=1&destination=${report.station_lat},${report.station_lng}` : '#'}
                external
                variant="secondary"
              >
                <Navigation className="h-4 w-4" />
                Directions
              </ButtonLink>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
