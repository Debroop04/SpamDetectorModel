'use client';

import { useState } from 'react';
import { Table2, BarChart3 } from 'lucide-react';
import { cn } from '@/lib/cn';
import { riskTone } from '@/lib/format';

export type TileTone = 'accent' | 'safe' | 'warn' | 'danger' | 'neutral';

const tileTones: Record<TileTone, { tile: string; line: string; fill: string }> = {
  accent: { tile: 'bg-accent-soft text-accent', line: 'stroke-chart-calls', fill: 'fill-chart-calls' },
  safe: { tile: 'bg-safe-soft text-safe', line: 'stroke-safe', fill: 'fill-safe' },
  warn: { tile: 'bg-warn-soft text-warn', line: 'stroke-warn', fill: 'fill-warn' },
  danger: { tile: 'bg-danger-soft text-danger', line: 'stroke-chart-scam', fill: 'fill-chart-scam' },
  neutral: { tile: 'bg-subtle text-ink-3', line: 'stroke-ink-3', fill: 'fill-ink-3' },
};

/** Seven-day trend line with a faint wash under it. Values stay in the tooltip-free tile, so the number is always readable. */
export function Sparkline({ values, tone = 'accent', className }: { values: number[]; tone?: TileTone; className?: string }) {
  if (values.length < 2) return null;
  const max = Math.max(...values, 1);
  const step = 100 / (values.length - 1);
  const points = values.map((v, i) => `${(i * step).toFixed(2)},${(30 - (v / max) * 26).toFixed(2)}`);
  const t = tileTones[tone];
  return (
    <svg viewBox="0 0 100 32" preserveAspectRatio="none" className={cn('h-9 w-full overflow-visible', className)} aria-hidden>
      <polygon points={`0,32 ${points.join(' ')} 100,32`} className={t.fill} fillOpacity={0.1} />
      <polyline points={points.join(' ')} className={t.line} fill="none" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export function StatTile({
  label,
  value,
  icon,
  href,
  tone = 'accent',
  footer,
  spark,
}: {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  href?: string;
  tone?: TileTone;
  footer?: React.ReactNode;
  spark?: number[];
}) {
  const content = (
    <>
      <div className="flex items-center gap-3">
        <span className={cn('flex h-10 w-10 items-center justify-center rounded-xl', tileTones[tone].tile)}>{icon}</span>
        <span className="text-[13px] font-medium text-ink-2">{label}</span>
      </div>
      <div className="mt-4 flex items-end justify-between gap-4">
        <div className="text-[30px] leading-none font-semibold tracking-tight text-ink">
          {typeof value === 'number' ? value.toLocaleString('en-IN') : value}
        </div>
        {spark && <Sparkline values={spark} tone={tone} className="max-w-28" />}
      </div>
      {footer && <div className="mt-3 text-xs text-ink-3">{footer}</div>}
    </>
  );
  const classes = 'block rounded-2xl border border-line bg-surface p-5 shadow-card transition-colors';
  return href ? (
    <a href={href} className={cn(classes, 'hover:border-line-strong')}>
      {content}
    </a>
  ) : (
    <div className={classes}>{content}</div>
  );
}

/** A stat card that doubles as a filter tab. The active one gets an accent ring. */
export function FilterTile({
  label,
  value,
  icon,
  tone = 'accent',
  active,
  onClick,
}: {
  label: string;
  value: number | undefined;
  icon: React.ReactNode;
  tone?: TileTone;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'flex items-center gap-3.5 rounded-2xl border bg-surface p-4 text-left shadow-card transition-all',
        active ? 'border-accent ring-3 ring-accent-soft' : 'border-line hover:border-line-strong',
      )}
    >
      <span className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl', tileTones[tone].tile)}>{icon}</span>
      <span className="min-w-0">
        <span className="block truncate text-[13px] font-medium text-ink-2">{label}</span>
        <span className="tabular mt-0.5 block text-2xl leading-tight font-semibold tracking-tight text-ink">
          {value === undefined ? '–' : value.toLocaleString('en-IN')}
        </span>
      </span>
    </button>
  );
}

/** One whole split into parts (thin segmented bar), with a legend that carries the names and counts. */
export function OutcomeBar({ parts }: { parts: { label: string; value: number; className: string }[] }) {
  const total = parts.reduce((sum, p) => sum + p.value, 0);
  return (
    <div>
      <div className="flex h-2.5 w-full gap-0.5 overflow-hidden rounded-full bg-muted" role="img" aria-label={parts.map((p) => `${p.label} ${p.value}`).join(', ')}>
        {total > 0 &&
          parts
            .filter((p) => p.value > 0)
            .map((p) => <div key={p.label} className={cn('h-full first:rounded-l-full last:rounded-r-full', p.className)} style={{ width: `${(p.value / total) * 100}%` }} />)}
      </div>
      <ul className="mt-4 space-y-2.5">
        {parts.map((p) => (
          <li key={p.label} className="flex items-center gap-3 text-sm">
            <span className={cn('h-2.5 w-2.5 rounded-[3px]', p.className)} />
            <span className="flex-1 text-ink-2">{p.label}</span>
            <span className="tabular font-semibold text-ink">{p.value}</span>
            <span className="tabular w-11 text-right text-xs text-ink-3">{total ? Math.round((p.value / total) * 100) : 0}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

const meterFill = { safe: 'bg-safe', warn: 'bg-warn', danger: 'bg-danger', accent: 'bg-accent', neutral: 'bg-ink-3' };
const meterTrack = { safe: 'bg-safe-soft', warn: 'bg-warn-soft', danger: 'bg-danger-soft', accent: 'bg-accent-soft', neutral: 'bg-muted' };

/** Risk 0-1 as a meter. Fill carries severity; the track is a lighter step of the same hue. */
export function RiskMeter({ score, size = 'md', showValue = true }: { score: number; size?: 'sm' | 'md'; showValue?: boolean }) {
  const tone = riskTone(score);
  const pct = Math.round(Math.max(0, Math.min(1, score)) * 100);
  return (
    <div className="flex items-center gap-2.5" role="meter" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Risk score">
      <div className={cn('relative w-full overflow-hidden rounded-full', size === 'sm' ? 'h-1.5 min-w-16' : 'h-2', meterTrack[tone])}>
        <div className={cn('h-full rounded-full transition-all duration-500', meterFill[tone])} style={{ width: pct === 0 ? 0 : `${Math.max(pct, 3)}%` }} />
      </div>
      {showValue && <span className={cn('tabular shrink-0 font-semibold text-ink', size === 'sm' ? 'w-8 text-xs' : 'w-10 text-sm')}>{pct}%</span>}
    </div>
  );
}

interface Day {
  date: string;
  total: number;
  spam: number;
}

/** Whole-number axis: the smallest clean step that covers the value in at most 5 intervals. */
function niceScale(value: number): { max: number; ticks: number[] } {
  const steps = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 5000];
  const target = Math.max(value, 4);
  const step = steps.find((s) => Math.ceil(target / s) <= 5) ?? Math.ceil(target / 5);
  const max = Math.ceil(target / step) * step;
  const ticks = Array.from({ length: max / step + 1 }, (_, i) => i * step);
  return { max, ticks };
}

function dayLabel(iso: string, short = true) {
  const date = new Date(`${iso}T00:00:00`);
  return date.toLocaleDateString('en-IN', short ? { weekday: 'short' } : { weekday: 'long', day: 'numeric', month: 'short' });
}

/** Stacked columns: scam calls (red) on other calls (blue), one column per day. */
export function WeekChart({ days }: { days: Day[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const [table, setTable] = useState(false);
  const { max, ticks } = niceScale(Math.max(...days.map((d) => d.total), 0));
  const height = 168;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-4 text-xs text-ink-2">
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-[3px] bg-chart-calls" />
            Other calls
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-[3px] bg-chart-scam" />
            Scam calls
          </span>
        </div>
        <button
          onClick={() => setTable((v) => !v)}
          className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-ink-3 hover:bg-subtle hover:text-ink"
        >
          {table ? <BarChart3 className="h-3.5 w-3.5" /> : <Table2 className="h-3.5 w-3.5" />}
          {table ? 'Chart' : 'Table'}
        </button>
      </div>

      {table ? (
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-line text-left text-ink-3">
              <th className="py-2 font-medium">Day</th>
              <th className="py-2 text-right font-medium">Calls</th>
              <th className="py-2 text-right font-medium">Scams</th>
            </tr>
          </thead>
          <tbody>
            {days.map((d) => (
              <tr key={d.date} className="border-b border-line last:border-0">
                <td className="py-2 text-ink-2">{dayLabel(d.date, false)}</td>
                <td className="tabular py-2 text-right text-ink">{d.total}</td>
                <td className="tabular py-2 text-right text-ink">{d.spam}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="flex gap-3">
          <div className="tabular relative w-6 shrink-0 text-right text-[11px] text-ink-3" style={{ height }}>
            {ticks.map((t) => (
              <span key={t} className="absolute right-0 leading-none" style={{ bottom: `${(t / max) * 100}%`, transform: 'translateY(50%)' }}>
                {t}
              </span>
            ))}
          </div>
          <div className="relative flex-1">
            <div className="relative" style={{ height }}>
              {ticks.map((t) => (
                <div key={t} className="absolute right-0 left-0 h-px bg-chart-grid" style={{ bottom: `${(t / max) * 100}%` }} />
              ))}
              <div className="absolute inset-0 flex items-end justify-around">
                {days.map((d, i) => {
                  const other = d.total - d.spam;
                  const otherH = (other / max) * height;
                  const spamH = (d.spam / max) * height;
                  const gap = other > 0 && d.spam > 0 ? 2 : 0;
                  return (
                    <button
                      key={d.date}
                      type="button"
                      aria-label={`${dayLabel(d.date, false)}: ${d.total} calls, ${d.spam} scams`}
                      onPointerEnter={() => setHover(i)}
                      onPointerLeave={() => setHover(null)}
                      onFocus={() => setHover(i)}
                      onBlur={() => setHover(null)}
                      className="group relative flex h-full flex-1 cursor-default flex-col items-center justify-end focus:outline-none"
                    >
                      <div className={cn('flex w-full max-w-6 flex-col transition-opacity', hover !== null && hover !== i && 'opacity-50')}>
                        {d.spam > 0 && (
                          <div className="w-full rounded-t-sm bg-chart-scam" style={{ height: spamH }} />
                        )}
                        {gap > 0 && <div className="w-full bg-surface" style={{ height: gap }} />}
                        {other > 0 && (
                          <div className={cn('w-full bg-chart-calls', d.spam === 0 && 'rounded-t-sm')} style={{ height: otherH }} />
                        )}
                      </div>
                      {hover === i && (
                        <div className="pointer-events-none absolute bottom-full z-10 mb-2 w-36 rounded-lg border border-line bg-surface px-3 py-2 text-left shadow-pop">
                          <div className="mb-1.5 text-[11px] font-medium text-ink-3">{dayLabel(d.date, false)}</div>
                          <div className="flex items-center justify-between text-xs">
                            <span className="flex items-center gap-1.5 text-ink-2">
                              <span className="h-0.5 w-3 rounded bg-chart-calls" />
                              Other
                            </span>
                            <span className="tabular font-semibold text-ink">{other}</span>
                          </div>
                          <div className="mt-1 flex items-center justify-between text-xs">
                            <span className="flex items-center gap-1.5 text-ink-2">
                              <span className="h-0.5 w-3 rounded bg-chart-scam" />
                              Scam
                            </span>
                            <span className="tabular font-semibold text-ink">{d.spam}</span>
                          </div>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="mt-2 flex justify-around text-[11px] text-ink-3">
              {days.map((d) => (
                <span key={d.date} className="flex-1 text-center">
                  {dayLabel(d.date)}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
