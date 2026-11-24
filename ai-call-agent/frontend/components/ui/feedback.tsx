import { AlertTriangle, Info, CheckCircle2, XCircle } from 'lucide-react';
import { cn } from '@/lib/cn';

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-md bg-muted', className)} />;
}

export function Empty({
  icon,
  title,
  action,
  className,
}: {
  icon: React.ReactNode;
  title: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-3 px-6 py-12 text-center', className)}>
      <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-line bg-subtle text-ink-3">{icon}</div>
      <p className="text-sm font-medium text-ink-2">{title}</p>
      {action}
    </div>
  );
}

const calloutStyles = {
  info: { box: 'bg-accent-soft text-accent-ink', icon: Info },
  warn: { box: 'bg-warn-soft text-warn-ink', icon: AlertTriangle },
  danger: { box: 'bg-danger-soft text-danger-ink', icon: XCircle },
  safe: { box: 'bg-safe-soft text-safe-ink', icon: CheckCircle2 },
};

export function Callout({
  tone = 'info',
  children,
  action,
  className,
}: {
  tone?: keyof typeof calloutStyles;
  children: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  const style = calloutStyles[tone];
  const Icon = style.icon;
  return (
    <div className={cn('flex items-start gap-3 rounded-lg px-3.5 py-3 text-[13px] leading-relaxed', style.box, className)}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="min-w-0 flex-1">{children}</div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
