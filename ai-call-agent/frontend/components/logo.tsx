import { cn } from '@/lib/cn';

export function LogoMark({ className }: { className?: string }) {
  return (
    <span className={cn('flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-on-accent', className)}>
      <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        <path d="m9 12 2 2 4-4" />
      </svg>
    </span>
  );
}

export function Logo({ className, inverted }: { className?: string; inverted?: boolean }) {
  return (
    <span className={cn('flex items-center gap-2.5', className)}>
      <LogoMark className={inverted ? 'bg-hero-ink text-hero' : undefined} />
      <span className={cn('text-[15px] font-semibold tracking-tight', inverted ? 'text-hero-ink' : 'text-ink')}>Call Shield</span>
    </span>
  );
}
