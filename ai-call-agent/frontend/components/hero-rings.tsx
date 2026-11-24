import { cn } from '@/lib/cn';

/** Decorative concentric rings for the solid brand panels. Solid strokes only. */
export function HeroRings({ className }: { className?: string }) {
  return (
    <svg className={cn('pointer-events-none absolute h-105 w-105 text-hero-line', className)} viewBox="0 0 420 420" fill="none" aria-hidden>
      {[60, 110, 160, 210].map((r) => (
        <circle key={r} cx="210" cy="210" r={r} stroke="currentColor" strokeWidth="1.5" />
      ))}
    </svg>
  );
}
