import Link from 'next/link';
import { Smartphone } from 'lucide-react';
import { Logo } from '@/components/logo';
import { ButtonLink } from '@/components/ui/button';
import { ThemeToggle } from '@/components/theme-toggle';

export const WRAP = 'mx-auto w-full max-w-[1840px] px-5 sm:px-8 lg:px-12 2xl:px-16';

export function SiteHeader({ links = true }: { links?: boolean }) {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-bg/90 backdrop-blur-md">
      <div className={`${WRAP} flex h-16 items-center justify-between gap-4`}>
        <Link href="/" aria-label="Call Shield home">
          <Logo />
        </Link>
        {links && (
          <nav className="hidden items-center gap-8 text-sm font-medium text-ink-2 lg:flex">
            <Link href="/#how" className="transition-colors hover:text-ink">
              How it works
            </Link>
            <Link href="/#police" className="transition-colors hover:text-ink">
              Police reports
            </Link>
            <Link href="/#features" className="transition-colors hover:text-ink">
              Features
            </Link>
          </nav>
        )}
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <ButtonLink href="/download" variant="secondary" className="hidden sm:inline-flex">
            <Smartphone className="h-4 w-4" />
            Get the app
          </ButtonLink>
          <ButtonLink href="/login" variant="ghost" className="hidden md:inline-flex">
            Sign in
          </ButtonLink>
          <ButtonLink href="/register">Get started</ButtonLink>
        </div>
      </div>
    </header>
  );
}
