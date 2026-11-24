import Link from 'next/link';
import { BadgeCheck, Bot, MapPinned, ShieldCheck, ShieldX } from 'lucide-react';
import { Logo } from '@/components/logo';
import { ThemeToggle } from '@/components/theme-toggle';
import { HeroRings } from '@/components/hero-rings';
import { IconTile } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { RiskMeter } from '@/components/charts';

const POINTS = [
  { icon: Bot, text: 'AI answers unknown callers first' },
  { icon: ShieldCheck, text: 'Scams are blocked during the call' },
  { icon: MapPinned, text: 'Nearest police station gets the report' },
];

/** Curved edge between the brand panel and the form: a light band, then the page background. Solid fills only. */
function WaveEdge() {
  return (
    <svg className="pointer-events-none absolute inset-y-0 -right-px h-full w-24 xl:w-36" viewBox="0 0 100 1000" preserveAspectRatio="none" aria-hidden>
      <path d="M100 0 H40 C86 170 88 340 60 500 C32 660 28 830 70 1000 H100 Z" className="fill-hero-tile" />
      <path d="M100 0 H62 C104 170 106 340 80 500 C54 660 50 830 90 1000 H100 Z" className="fill-bg" />
    </svg>
  );
}

/** Static example of what a blocked call looks like in the app. */
function PreviewCard() {
  return (
    <div className="w-full max-w-sm rounded-2xl border border-line bg-surface p-4 shadow-pop">
      <div className="flex items-center gap-3">
        <IconTile tone="danger">
          <ShieldX />
        </IconTile>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-ink">+91 98765 43210</div>
          <div className="truncate text-xs text-ink-3">Bank or KYC fraud · Just now</div>
        </div>
        <Badge tone="danger" dot>
          Scam
        </Badge>
      </div>
      <div className="mt-4">
        <RiskMeter score={0.92} size="sm" />
      </div>
      <div className="mt-4 flex items-center gap-2 border-t border-line pt-3.5 text-[13px] font-medium text-ink-2">
        <BadgeCheck className="h-4 w-4 text-safe" />
        Report sent to the nearest police station
      </div>
    </div>
  );
}

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1fr_1.05fr]">
      <section className="relative hidden flex-col justify-between overflow-hidden bg-hero py-10 pr-28 pl-10 lg:flex xl:py-14 xl:pr-44 xl:pl-14">
        <HeroRings className="-right-36 -bottom-36 h-155 w-155" />
        <WaveEdge />
        <Link href="/" className="relative w-fit">
          <Logo inverted />
        </Link>
        <div className="relative">
          <h2 className="max-w-md text-[32px] leading-[1.12] font-semibold tracking-tight text-hero-ink xl:text-[38px]">Every scam call screened, blocked and reported.</h2>
          <ul className="mt-9 space-y-3.5">
            {POINTS.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3 text-[15px] font-medium text-hero-ink">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-hero-tile">
                  <Icon className="h-4.5 w-4.5" />
                </span>
                {text}
              </li>
            ))}
          </ul>
          <div className="mt-12">
            <PreviewCard />
          </div>
        </div>
        <p className="relative text-sm text-hero-muted">
          Cyber fraud helpline <span className="font-semibold text-hero-ink">1930</span>
        </p>
      </section>
      <section className="relative flex items-center justify-center px-5 py-12">
        <ThemeToggle className="absolute top-5 right-5" />
        <div className="w-full max-w-100">
          <Link href="/" className="mb-10 inline-block lg:hidden">
            <Logo />
          </Link>
          {children}
        </div>
      </section>
    </div>
  );
}
