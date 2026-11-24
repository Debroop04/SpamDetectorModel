'use client';

import Link from 'next/link';
import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import useSWR, { mutate } from 'swr';
import { Ban, Calendar, Flame, Hash, Phone, Search, ShieldAlert, ShieldCheck, ShieldQuestion, Siren, Tag, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { FRAUD_CATEGORIES, formatDate, formatPhone, timeAgo, type Tone } from '@/lib/format';
import type { ManualReportResult, NumberLookup, NumberRule, SpamNumber } from '@/lib/types';
import { Card, CardHeader, Fact, IconTile, PageHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Field, Input, Segmented, Switch, Textarea } from '@/components/ui/field';
import { Badge } from '@/components/ui/badge';
import { Callout, Empty, Skeleton } from '@/components/ui/feedback';
import { useToast } from '@/components/ui/toast';
import { RiskMeter } from '@/components/charts';

const levelStyle: Record<NumberLookup['level'], { icon: React.ElementType; tone: Tone; label: string; box: string }> = {
  unknown: { icon: ShieldQuestion, tone: 'neutral', label: 'No reports', box: 'border-line bg-bg' },
  reported: { icon: ShieldAlert, tone: 'warn', label: 'Reported', box: 'border-warn/40 bg-warn-soft' },
  dangerous: { icon: ShieldAlert, tone: 'danger', label: 'Dangerous', box: 'border-danger/40 bg-danger-soft' },
};

function Lookup() {
  const toast = useToast();
  const [number, setNumber] = useState('');
  const [result, setResult] = useState<NumberLookup | null>(null);
  const [busy, setBusy] = useState(false);

  async function lookupNumber(value: string) {
    if (!value.trim()) return;
    setBusy(true);
    try {
      setResult(await api<NumberLookup>(`/api/numbers/lookup?number=${encodeURIComponent(value.trim())}`));
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Lookup failed', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function search(event?: React.FormEvent) {
    event?.preventDefault();
    await lookupNumber(number);
  }

  // Numbers typed in the top bar search arrive as ?q=…
  const query = useSearchParams().get('q');
  useEffect(() => {
    if (!query) return;
    const timer = setTimeout(() => {
      setNumber(query);
      lookupNumber(query);
    }, 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  async function setRule(kind: 'allow' | 'block' | null) {
    if (!result) return;
    try {
      if (kind) await api('/api/numbers/rules', { method: 'PUT', body: { number: result.number, kind } });
      else await api(`/api/numbers/rules/${encodeURIComponent(result.number)}`, { method: 'DELETE' });
      setResult({ ...result, rule: kind });
      mutate('/api/numbers/rules');
      toast(kind === 'allow' ? 'Number trusted' : kind === 'block' ? 'Number blocked' : 'Rule removed');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not update', 'error');
    }
  }

  const style = result ? levelStyle[result.level] : null;

  return (
    <Card className="p-6">
      <div className="mb-5 flex items-center gap-3">
        <IconTile tone="accent">
          <Search />
        </IconTile>
        <h2 className="text-lg font-semibold tracking-tight text-ink">Check a number</h2>
      </div>
      <form onSubmit={search} className="flex flex-col gap-2.5 sm:flex-row">
        <div className="relative flex-1">
          <Phone className="pointer-events-none absolute top-1/2 left-4 h-4 w-4 -translate-y-1/2 text-ink-3" />
          <Input className="h-12 rounded-xl pl-11 text-base" placeholder="+91 98765 43210" value={number} onChange={(e) => setNumber(e.target.value)} inputMode="tel" />
        </div>
        <Button type="submit" size="lg" className="h-12 rounded-xl px-6" loading={busy}>
          <Search className="h-4 w-4" />
          Check
        </Button>
      </form>

      {result && style && (
        <div className={cn('animate-in mt-5 rounded-2xl border p-5', style.box)}>
          <div className="flex flex-wrap items-center gap-4">
            <IconTile tone={style.tone} size="lg" className="bg-surface">
              <style.icon />
            </IconTile>
            <div className="min-w-0 flex-1">
              <div className="text-xl font-semibold tracking-tight text-ink">{formatPhone(result.number)}</div>
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                <Badge tone={style.tone} dot className="bg-surface">
                  {style.label}
                </Badge>
                {result.rule && (
                  <Badge tone={result.rule === 'allow' ? 'safe' : 'danger'} className="bg-surface">
                    {result.rule === 'allow' ? 'Trusted by you' : 'Blocked by you'}
                  </Badge>
                )}
              </div>
            </div>
          </div>
          {result.reports > 0 && (
            <>
              <div className="mt-5 grid gap-2.5 sm:grid-cols-3">
                <Fact label="Reports" icon={<Hash />} className="bg-surface">
                  {result.reports}
                </Fact>
                <Fact label="Type" icon={<Tag />} className="bg-surface">
                  {result.category || '—'}
                </Fact>
                <Fact label="Last reported" icon={<Calendar />} className="bg-surface">
                  {formatDate(result.last_reported_at) || '—'}
                </Fact>
              </div>
              <div className="mt-4 rounded-xl bg-surface px-4 py-3">
                <div className="mb-2 text-xs font-medium text-ink-3">Risk</div>
                <RiskMeter score={result.risk} />
              </div>
            </>
          )}
          <div className="mt-5 flex flex-wrap gap-2">
            {result.rule === 'allow' ? (
              <Button size="sm" variant="secondary" onClick={() => setRule(null)}>
                <ShieldCheck className="h-4 w-4 text-safe" />
                Trusted · Remove
              </Button>
            ) : (
              <Button size="sm" variant="secondary" onClick={() => setRule('allow')}>
                <ShieldCheck className="h-4 w-4" />
                Trust
              </Button>
            )}
            {result.rule === 'block' ? (
              <Button size="sm" variant="secondary" onClick={() => setRule(null)}>
                <Ban className="h-4 w-4 text-danger" />
                Blocked · Remove
              </Button>
            ) : (
              <Button size="sm" variant="secondary" onClick={() => setRule('block')}>
                <Ban className="h-4 w-4" />
                Block
              </Button>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}

function ReportForm() {
  const toast = useToast();
  const [number, setNumber] = useState('');
  const [category, setCategory] = useState(FRAUD_CATEGORIES[0]);
  const [note, setNote] = useState('');
  const [police, setPolice] = useState(true);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<ManualReportResult | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setDone(null);
    try {
      const result = await api<ManualReportResult>('/api/numbers/report', {
        method: 'POST',
        body: { number: number.trim(), category, note: note.trim() || null, send_to_police: police },
      });
      setDone(result);
      setNumber('');
      setNote('');
      mutate('/api/numbers/top?limit=10');
      mutate((key) => typeof key === 'string' && key.startsWith('/api/reports'));
      toast(police ? 'Report filed' : 'Number reported to the community');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not submit', 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card id="report" className="scroll-mt-24">
      <CardHeader title="Report a number" icon={<Siren />} tone="danger" />
      <form onSubmit={submit} className="space-y-5 p-5">
        {done && (
          <Callout
            tone={done.duplicate_report ? 'warn' : 'safe'}
            action={
              done.report ? (
                <Link href={`/reports/${done.report.id}`} className="font-semibold underline-offset-2 hover:underline">
                  Open
                </Link>
              ) : undefined
            }
          >
            {done.duplicate_report
              ? `You already reported ${formatPhone(done.number)} in the last 24 hours.`
              : done.report
                ? `Report ${done.report.reference} is being sent.`
                : `${formatPhone(done.number)} was added to the community list.`}
          </Callout>
        )}
        <Field label="Phone number">
          {(id) => <Input id={id} required inputMode="tel" placeholder="+91 98765 43210" value={number} onChange={(e) => setNumber(e.target.value)} />}
        </Field>
        <div>
          <div className="mb-2 text-[13px] font-medium text-ink">Type of fraud</div>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Type of fraud">
            {FRAUD_CATEGORIES.map((c) => (
              <button
                key={c}
                type="button"
                role="radio"
                aria-checked={category === c}
                onClick={() => setCategory(c)}
                className={cn(
                  'rounded-full border px-3 py-1.5 text-[13px] font-medium transition-colors',
                  category === c ? 'border-accent bg-accent-soft text-accent-ink' : 'border-line bg-surface text-ink-2 hover:border-line-strong hover:text-ink',
                )}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
        <Field label="What happened">
          {(id) => (
            <Textarea id={id} maxLength={2000} placeholder="They said my bank account will be blocked and asked for the OTP" value={note} onChange={(e) => setNote(e.target.value)} />
          )}
        </Field>
        <div className="flex items-center gap-3 rounded-xl border border-line bg-bg px-4 py-3">
          <IconTile size="sm" tone={police ? 'accent' : 'neutral'}>
            <Siren />
          </IconTile>
          <span className="flex-1 text-sm font-medium text-ink">Send to my police station</span>
          <Switch checked={police} onChange={setPolice} label="Send to my police station" />
        </div>
        <Button type="submit" size="lg" loading={busy} className="w-full sm:w-auto">
          Submit report
        </Button>
      </form>
    </Card>
  );
}

function TopNumbers() {
  const { data } = useSWR<SpamNumber[]>('/api/numbers/top?limit=10');
  const max = Math.max(1, ...(data?.map((r) => r.reports) ?? [1]));
  return (
    <Card className="overflow-hidden">
      <CardHeader title="Most reported" icon={<Flame />} tone="danger" />
      {!data ? (
        <div className="space-y-2 p-5">
          <Skeleton className="h-11" />
          <Skeleton className="h-11" />
          <Skeleton className="h-11" />
        </div>
      ) : data.length === 0 ? (
        <Empty icon={<ShieldAlert className="h-5 w-5" />} title="No reported numbers yet" />
      ) : (
        <ol className="divide-y divide-line">
          {data.map((row, index) => (
            <li key={row.number} className="flex items-center gap-3.5 px-5 py-3">
              <span
                className={cn(
                  'tabular flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-semibold',
                  index < 3 ? 'bg-danger-soft text-danger-ink' : 'bg-subtle text-ink-3',
                )}
              >
                {index + 1}
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold text-ink">{formatPhone(row.number)}</div>
                <div className="truncate text-xs text-ink-3">
                  {row.category} · {timeAgo(row.last_reported_at)}
                </div>
              </div>
              <div className="w-20 shrink-0 text-right">
                <div className="tabular text-sm font-semibold text-ink">{row.reports}</div>
                <div className="mt-1 h-1 rounded-full bg-danger-soft">
                  <div className="ml-auto h-1 rounded-full bg-chart-scam" style={{ width: `${(row.reports / max) * 100}%` }} />
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}

function Rules() {
  const toast = useToast();
  const { data } = useSWR<NumberRule[]>('/api/numbers/rules');
  const [kind, setKind] = useState<'allow' | 'block'>('block');
  const rows = (data ?? []).filter((r) => r.kind === kind);

  async function remove(number: string) {
    try {
      await api(`/api/numbers/rules/${encodeURIComponent(number)}`, { method: 'DELETE' });
      mutate('/api/numbers/rules');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not remove', 'error');
    }
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader
        title="Your lists"
        icon={<ShieldCheck />}
        tone="accent"
        actions={
          <Segmented<'allow' | 'block'>
            size="sm"
            value={kind}
            onChange={setKind}
            options={[
              { value: 'block', label: 'Blocked', count: data?.filter((r) => r.kind === 'block').length },
              { value: 'allow', label: 'Trusted', count: data?.filter((r) => r.kind === 'allow').length },
            ]}
          />
        }
      />
      {!data ? (
        <div className="p-5">
          <Skeleton className="h-10" />
        </div>
      ) : rows.length === 0 ? (
        <Empty
          icon={kind === 'block' ? <Ban className="h-5 w-5" /> : <ShieldCheck className="h-5 w-5" />}
          title={kind === 'block' ? 'No blocked numbers' : 'No trusted numbers'}
        />
      ) : (
        <ul className="divide-y divide-line">
          {rows.map((rule) => (
            <li key={rule.id} className="flex items-center gap-3 px-5 py-3">
              <IconTile size="sm" tone={rule.kind === 'allow' ? 'safe' : 'danger'}>
                {rule.kind === 'allow' ? <ShieldCheck /> : <Ban />}
              </IconTile>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold text-ink">{formatPhone(rule.number)}</div>
                <div className="text-xs text-ink-3">Added {timeAgo(rule.created_at)}</div>
              </div>
              <button onClick={() => remove(rule.number)} className="rounded-lg p-2 text-ink-3 transition-colors hover:bg-danger-soft hover:text-danger" aria-label="Remove">
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export default function NumbersPage() {
  return (
    <>
      <PageHeader title="Numbers" />
      <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <div className="space-y-6">
          <Suspense>
            <Lookup />
          </Suspense>
          <ReportForm />
        </div>
        <div className="space-y-6">
          <TopNumbers />
          <Rules />
        </div>
      </div>
    </>
  );
}
