import { cn } from '@/lib/cn';
import { reportStatusLabel, reportStatusTone, verdictLabel, verdictTone, type Tone } from '@/lib/format';
import type { ReportStatus, Verdict } from '@/lib/types';

const tones: Record<Tone, string> = {
  neutral: 'bg-subtle text-ink-2 border-line',
  accent: 'bg-accent-soft text-accent-ink border-transparent',
  safe: 'bg-safe-soft text-safe-ink border-transparent',
  warn: 'bg-warn-soft text-warn-ink border-transparent',
  danger: 'bg-danger-soft text-danger-ink border-transparent',
};

const dots: Record<Tone, string> = {
  neutral: 'bg-ink-3',
  accent: 'bg-accent',
  safe: 'bg-safe',
  warn: 'bg-warn',
  danger: 'bg-danger',
};

const liveDots: Record<Tone, string> = {
  neutral: 'text-ink-3',
  accent: 'text-accent',
  safe: 'text-safe',
  warn: 'text-warn',
  danger: 'text-danger',
};

export function Badge({
  tone = 'neutral',
  dot,
  live,
  className,
  children,
}: {
  tone?: Tone;
  dot?: boolean;
  live?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        'inline-flex h-6 items-center gap-1.5 rounded-md border px-2 text-xs font-medium whitespace-nowrap',
        tones[tone],
        className,
      )}
    >
      {live ? (
        <span className={cn('live-dot h-1.5! w-1.5!', liveDots[tone])} />
      ) : dot ? (
        <span className={cn('h-1.5 w-1.5 rounded-full', dots[tone])} />
      ) : null}
      {children}
    </span>
  );
}

export function VerdictBadge({ verdict, live }: { verdict: Verdict; live?: boolean }) {
  return (
    <Badge tone={verdictTone[verdict]} dot={!live} live={live}>
      {verdictLabel[verdict]}
    </Badge>
  );
}

export function ReportStatusBadge({ status }: { status: ReportStatus }) {
  return (
    <Badge tone={reportStatusTone[status]} dot>
      {reportStatusLabel[status]}
    </Badge>
  );
}
