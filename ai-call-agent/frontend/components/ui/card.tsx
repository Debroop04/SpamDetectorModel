import { cn } from '@/lib/cn';
import type { Tone } from '@/lib/format';

export function Card({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('rounded-2xl border border-line bg-surface shadow-card', className)} {...props}>
      {children}
    </div>
  );
}

const tileTones: Record<Tone, string> = {
  neutral: 'bg-subtle text-ink-2',
  accent: 'bg-accent-soft text-accent',
  safe: 'bg-safe-soft text-safe',
  warn: 'bg-warn-soft text-warn',
  danger: 'bg-danger-soft text-danger',
};

const tileSizes = {
  sm: 'h-8 w-8 rounded-lg [&_svg]:h-4 [&_svg]:w-4',
  md: 'h-10 w-10 rounded-xl [&_svg]:h-4.5 [&_svg]:w-4.5',
  lg: 'h-12 w-12 rounded-2xl [&_svg]:h-6 [&_svg]:w-6',
};

/** Rounded square that carries an icon in one of the semantic tones. */
export function IconTile({
  tone = 'neutral',
  size = 'md',
  className,
  children,
}: {
  tone?: Tone;
  size?: keyof typeof tileSizes;
  className?: string;
  children: React.ReactNode;
}) {
  return <span className={cn('flex shrink-0 items-center justify-center', tileSizes[size], tileTones[tone], className)}>{children}</span>;
}

export function Avatar({ name, size = 'md', className }: { name: string; size?: 'sm' | 'md' | 'lg'; className?: string }) {
  const letters =
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('') || '?';
  return (
    <span
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full bg-accent-soft font-semibold text-accent-ink',
        size === 'sm' && 'h-8 w-8 text-xs',
        size === 'md' && 'h-10 w-10 text-sm',
        size === 'lg' && 'h-16 w-16 text-xl',
        className,
      )}
      aria-hidden
    >
      {letters}
    </span>
  );
}

export function CardHeader({
  title,
  icon,
  tone = 'neutral',
  actions,
  className,
}: {
  title: React.ReactNode;
  icon?: React.ReactNode;
  tone?: Tone;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex min-h-15 items-center justify-between gap-3 border-b border-line px-5 py-3', className)}>
      <h2 className="flex min-w-0 items-center gap-3 text-[15px] font-semibold tracking-tight text-ink">
        {icon && (
          <IconTile tone={tone} size="sm">
            {icon}
          </IconTile>
        )}
        <span className="truncate">{title}</span>
      </h2>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}

export function PageHeader({ title, actions, meta }: { title: string; actions?: React.ReactNode; meta?: React.ReactNode }) {
  return (
    <div className="mb-7 flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-[28px] leading-tight font-semibold tracking-tight text-ink">{title}</h1>
        {meta}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Row({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('flex items-start justify-between gap-4 border-b border-line py-3 last:border-0', className)}>
      <dt className="shrink-0 text-[13px] text-ink-3">{label}</dt>
      <dd className="min-w-0 text-right text-[13px] font-medium wrap-break-word text-ink">{children}</dd>
    </div>
  );
}

/** Small labelled value block used in fact grids. */
export function Fact({ label, icon, children, className }: { label: string; icon?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('min-w-0 rounded-xl border border-line bg-bg px-4 py-3.5', className)}>
      <div className="flex items-center gap-1.5 text-xs font-medium text-ink-3 [&_svg]:h-3.5 [&_svg]:w-3.5">
        {icon}
        {label}
      </div>
      <div className="mt-1.5 text-sm font-semibold wrap-break-word text-ink">{children}</div>
    </div>
  );
}
