import Link from 'next/link';
import {
  ArrowRight,
  BadgeCheck,
  Ban,
  Bot,
  Brain,
  Briefcase,
  Check,
  FileText,
  Gift,
  Globe,
  KeyRound,
  Landmark,
  Languages,
  Mail,
  MapPinned,
  MonitorSmartphone,
  Package,
  PhoneIncoming,
  Radio,
  ShieldCheck,
  Siren,
  Smartphone,
  User,
  Users,
  Zap,
} from 'lucide-react';
import { Logo } from '@/components/logo';
import { ButtonLink } from '@/components/ui/button';
import { SiteHeader, WRAP } from '@/components/site-header';
import { LandingMap } from '@/components/landing-map';


const SCAMS = [
  { icon: Landmark, label: 'Bank and KYC fraud' },
  { icon: KeyRound, label: 'OTP and PIN theft' },
  { icon: Siren, label: 'Fake police and digital arrest' },
  { icon: Gift, label: 'Lottery and prize offers' },
  { icon: Zap, label: 'Electricity cut-off threats' },
  { icon: MonitorSmartphone, label: 'AnyDesk and remote access' },
  { icon: Package, label: 'Courier and customs parcels' },
  { icon: Briefcase, label: 'Fake jobs and investments' },
];

const STEPS = [
  { icon: PhoneIncoming, title: 'A call comes in', text: 'Unknown numbers reach your AI assistant first, never your phone.' },
  { icon: Bot, title: 'The AI asks why', text: 'It asks the caller for their name and reason, in English or Hindi.' },
  { icon: Brain, title: 'Every word is scored', text: 'The spam model, scam phrase rules and number history decide in seconds.' },
  { icon: Siren, title: 'Police get the report', text: 'Scammers are cut off and the nearest station receives the complaint.' },
];

const FEATURES = [
  { icon: Radio, title: 'Live transcript', text: 'Follow the screening word by word and block or connect with one click.' },
  { icon: Languages, title: 'English and Hindi', text: 'Callers pick a language. Hindi speech is translated before scoring.' },
  { icon: MapPinned, title: 'Nearest police station', text: 'OpenStreetMap finds stations around you and draws the route on a map.' },
  { icon: FileText, title: 'Ready-to-file PDF', text: 'Every complaint carries the transcript, reasons, location and caller details.' },
  { icon: Users, title: 'Community blocklist', text: 'Numbers reported by others are cut off before they say a single word.' },
  { icon: Globe, title: 'Test from the browser', text: 'Place a real screened call from your laptop microphone in seconds.' },
];

function CallCard() {
  return (
    <div className="rounded-2xl border border-line bg-surface shadow-pop">
      <div className="flex items-center gap-3 border-b border-line px-5 py-4">
        <span className="relative flex h-11 w-11 items-center justify-center rounded-full bg-danger-soft text-danger">
          <PhoneIncoming className="h-5 w-5" />
          <span className="absolute -top-0.5 -right-0.5 rounded-full border-2 border-surface">
            <span className="live-dot block text-danger" />
          </span>
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[15px] font-semibold text-ink">+91 90000 77777</div>
          <div className="text-xs text-ink-3">AI screening · 0:21</div>
        </div>
        <span className="inline-flex h-7 items-center gap-1.5 rounded-md bg-danger-soft px-2.5 text-xs font-semibold text-danger-ink">
          <span className="h-1.5 w-1.5 rounded-full bg-danger" />
          Scam
        </span>
      </div>
      <div className="space-y-4 px-5 py-5">
        <div className="flex gap-3">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
            <Bot className="h-3.5 w-3.5" />
          </span>
          <p className="text-sm leading-relaxed text-ink-2">Please say your name and the reason for your call.</p>
        </div>
        <div className="flex gap-3">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-subtle text-ink-2">
            <User className="h-3.5 w-3.5" />
          </span>
          <p className="text-sm leading-relaxed text-ink">
            I am calling from State Bank. Your KYC has expired and your account will be blocked today. Tell me the OTP.
          </p>
        </div>
        <div className="grid grid-cols-3 gap-3 rounded-xl bg-subtle p-3.5">
          {[
            ['Model', 81],
            ['Phrases', 75],
            ['History', 0],
          ].map(([label, value]) => (
            <div key={label}>
              <div className="mb-1.5 flex justify-between text-[11px]">
                <span className="text-ink-3">{label}</span>
                <span className="font-semibold text-ink">{value}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-danger-soft">
                <div className="h-1.5 rounded-full bg-danger" style={{ width: `${Math.max(Number(value), 0)}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-2.5 rounded-b-2xl border-t border-line px-5 py-3.5">
        <Ban className="h-4 w-4 text-danger" />
        <span className="text-[13px] font-medium text-ink">Call ended by the assistant</span>
      </div>
    </div>
  );
}

function ReportCard() {
  return (
    <div className="w-full max-w-[320px] rounded-2xl border border-line bg-surface p-4 shadow-pop">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-[13px] font-semibold text-ink">CS-2026-00001</span>
        <span className="inline-flex h-6 items-center gap-1.5 rounded-md bg-safe-soft px-2 text-[11px] font-semibold text-safe-ink">
          <span className="h-1.5 w-1.5 rounded-full bg-safe" />
          Acknowledged
        </span>
      </div>
      <ol className="space-y-2.5">
        {[
          [FileText, 'Complaint created'],
          [Mail, 'Emailed to Connaught Place PS'],
          [BadgeCheck, 'Acknowledged by SI R. Sharma'],
        ].map(([Icon, text]) => {
          const I = Icon as typeof FileText;
          return (
            <li key={text as string} className="flex items-center gap-2.5 text-[13px] text-ink-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-safe text-white">
                <I className="h-3.5 w-3.5" />
              </span>
              {text as string}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function Hero() {
  return (
    <section className="border-b border-line">
      <div className={`${WRAP} grid items-center gap-14 py-16 lg:grid-cols-[1fr_1fr] lg:gap-20 lg:py-24 xl:py-28`}>
        <div>
          <h1 className="text-[44px] leading-[1.03] font-semibold tracking-tight text-ink sm:text-[60px] xl:text-[76px] 2xl:text-[88px]">
            Scam calls stop here.
            <br />
            <span className="text-accent">The police hear about them.</span>
          </h1>
          <div className="mt-10 flex flex-wrap gap-3">
            <ButtonLink href="/register" size="lg" className="h-12 px-6 text-base">
              Protect my number
              <ArrowRight className="h-4 w-4" />
            </ButtonLink>
            <ButtonLink href="/download" size="lg" variant="secondary" className="h-12 px-6 text-base">
              <Smartphone className="h-4 w-4" />
              Download for Android
            </ButtonLink>
          </div>
          <dl className="mt-14 grid max-w-xl grid-cols-3 gap-6 border-t border-line pt-8">
            {[
              ['3', 'signals score every call'],
              ['2', 'languages understood'],
              ['1930', 'cyber helpline linked'],
            ].map(([value, label]) => (
              <div key={label}>
                <dt className="text-3xl font-semibold tracking-tight text-ink">{value}</dt>
                <dd className="mt-1 text-[13px] leading-snug text-ink-3">{label}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="relative mx-auto w-full max-w-155 lg:pb-28 2xl:max-w-175">
          <CallCard />
          <div className="mt-4 lg:absolute lg:-right-8 lg:bottom-0 lg:mt-0">
            <ReportCard />
          </div>
        </div>
      </div>
    </section>
  );
}

function ScamStrip() {
  return (
    <section className="border-b border-line bg-surface">
      <div className={`${WRAP} flex flex-col gap-6 py-10 xl:flex-row xl:items-center xl:gap-12`}>
        <h2 className="shrink-0 text-lg font-semibold tracking-tight text-ink">Stops the scams India hears most</h2>
        <ul className="flex flex-wrap gap-2.5">
          {SCAMS.map(({ icon: Icon, label }) => (
            <li key={label} className="inline-flex items-center gap-2 rounded-full border border-line bg-bg px-3.5 py-2 text-[13px] font-medium text-ink-2">
              <Icon className="h-4 w-4 text-accent" />
              {label}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function HowItWorks() {
  return (
    <section id="how" className="scroll-mt-16 border-b border-line">
      <div className={`${WRAP} py-20 lg:py-28`}>
        <h2 className="text-3xl font-semibold tracking-tight text-ink sm:text-4xl">How it works</h2>
        <ol className="mt-12 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          {STEPS.map(({ icon: Icon, title, text }, index) => (
            <li key={title} className="relative rounded-2xl border border-line bg-surface p-7">
              <div className="flex items-center justify-between">
                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent text-on-accent">
                  <Icon className="h-5 w-5" />
                </span>
                <span className="tabular text-4xl font-semibold text-line-strong">0{index + 1}</span>
              </div>
              <h3 className="mt-8 text-lg font-semibold text-ink">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-2">{text}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function CheckList({ items }: { items: string[] }) {
  return (
    <ul className="mt-8 space-y-4">
      {items.map((item) => (
        <li key={item} className="flex gap-3 text-[15px] leading-relaxed text-ink-2">
          <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
            <Check className="h-3.5 w-3.5" strokeWidth={3} />
          </span>
          {item}
        </li>
      ))}
    </ul>
  );
}

function LiveSection() {
  return (
    <section className="border-b border-line bg-surface">
      <div className={`${WRAP} grid items-center gap-14 py-20 lg:grid-cols-2 lg:gap-20 lg:py-28`}>
        <div className="order-2 lg:order-1">
          <div className="rounded-2xl border border-line bg-bg p-3 shadow-card sm:p-4">
            <div className="grid gap-3 sm:grid-cols-[1.3fr_1fr]">
              <div className="rounded-xl border border-line bg-surface p-4">
                <div className="mb-4 flex items-center gap-2 text-xs font-semibold text-ink-3">
                  <span className="live-dot text-danger" />
                  LIVE TRANSCRIPT
                </div>
                <div className="space-y-3 text-sm">
                  <p className="text-ink-2">
                    <span className="font-semibold text-ink">Assistant</span> · Which company are you calling from?
                  </p>
                  <p className="text-ink">
                    <span className="font-semibold">Caller</span> · Customs department. Your parcel has drugs, you are under digital arrest.
                  </p>
                </div>
              </div>
              <div className="flex flex-col gap-3">
                <div className="rounded-xl border border-line bg-surface p-4">
                  <div className="text-xs text-ink-3">Risk</div>
                  <div className="mt-1 text-3xl font-semibold text-ink">92%</div>
                  <div className="mt-3 h-2 rounded-full bg-danger-soft">
                    <div className="h-2 w-[92%] rounded-full bg-danger" />
                  </div>
                </div>
                <div className="flex h-11 items-center justify-center gap-2 rounded-xl bg-danger text-sm font-semibold text-white">
                  <Ban className="h-4 w-4" />
                  Block and report
                </div>
                <div className="flex h-11 items-center justify-center rounded-xl border border-line bg-surface text-sm font-semibold text-ink">
                  Connect now
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="order-1 lg:order-2">
          <h2 className="text-3xl font-semibold tracking-tight text-ink sm:text-4xl">Watch every call as it happens</h2>
          <CheckList
            items={[
              'The transcript, risk score and reasons update live while the caller is still talking.',
              'Block and report a caller yourself, or skip the questions and take the call.',
              'Trusted numbers ring straight through and blocked numbers never get in.',
            ]}
          />
        </div>
      </div>
    </section>
  );
}

function PoliceSection() {
  return (
    <section id="police" className="scroll-mt-16 border-b border-line">
      <div className={`${WRAP} grid items-center gap-14 py-20 lg:grid-cols-2 lg:gap-20 lg:py-28`}>
        <div>
          <h2 className="text-3xl font-semibold tracking-tight text-ink sm:text-4xl">Reports reach the nearest police station</h2>
          <CheckList
            items={[
              'Your location finds the closest station on OpenStreetMap automatically.',
              'The complaint email carries a PDF with the caller number, transcript and map.',
              'The station acknowledges with one click, no login needed, and you see it instantly.',
            ]}
          />
          <div className="mt-10 inline-flex items-center gap-3 rounded-xl border border-line bg-surface px-4 py-3 text-sm text-ink-2">
            <Siren className="h-4 w-4 text-danger" />
            Cyber fraud helpline <span className="font-semibold text-ink">1930</span>
          </div>
        </div>
        <div className="relative">
          <div className="h-95 overflow-hidden rounded-2xl border border-line shadow-card sm:h-110">
            <LandingMap />
          </div>
          <div className="absolute right-4 bottom-4 left-4 flex items-center gap-3 rounded-xl border border-line bg-surface p-3.5 shadow-pop sm:right-auto sm:max-w-sm">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-ink text-bg">
              <ShieldCheck className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-ink">Police Station Connaught Place</div>
              <div className="text-xs text-ink-3">0.4 km away · complaint emailed</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Features() {
  return (
    <section id="features" className="scroll-mt-16 border-b border-line bg-surface">
      <div className={`${WRAP} py-20 lg:py-28`}>
        <h2 className="text-3xl font-semibold tracking-tight text-ink sm:text-4xl">Everything in one place</h2>
        <div className="mt-12 grid gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-2 xl:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, text }) => (
            <div key={title} className="bg-surface p-8 transition-colors hover:bg-subtle">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-line bg-bg text-accent">
                <Icon className="h-5 w-5" />
              </span>
              <h3 className="mt-6 text-base font-semibold text-ink">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-2">{text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function CallToAction() {
  return (
    <section className="bg-accent">
      <div className={`${WRAP} flex flex-col items-start justify-between gap-8 py-16 md:flex-row md:items-center lg:py-20`}>
        <h2 className="max-w-3xl text-3xl leading-tight font-semibold tracking-tight text-on-accent sm:text-[40px]">
          Put an AI assistant between you and every scammer.
        </h2>
        <Link
          href="/register"
          className="inline-flex h-12 shrink-0 items-center gap-2 rounded-lg bg-surface px-6 text-base font-semibold text-ink transition-colors hover:bg-subtle"
        >
          Get started free
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="bg-bg">
      <div className={`${WRAP} grid gap-10 py-14 sm:grid-cols-2 lg:grid-cols-4`}>
        <div>
          <Logo />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-ink">Product</h3>
          <ul className="mt-4 space-y-2.5 text-sm text-ink-3">
            <li>
              <Link href="/register" className="hover:text-ink">
                Create account
              </Link>
            </li>
            <li>
              <Link href="/login" className="hover:text-ink">
                Sign in
              </Link>
            </li>
            <li>
              <a href="#how" className="hover:text-ink">
                How it works
              </a>
            </li>
          </ul>
        </div>
        <div>
          <h3 className="text-sm font-semibold text-ink">Get help</h3>
          <ul className="mt-4 space-y-2.5 text-sm text-ink-3">
            <li>
              Cyber helpline <span className="font-semibold text-danger-ink">1930</span>
            </li>
            <li>
              <a href="https://cybercrime.gov.in" target="_blank" rel="noreferrer" className="hover:text-ink">
                cybercrime.gov.in
              </a>
            </li>
            <li>
              <a href="https://sancharsaathi.gov.in" target="_blank" rel="noreferrer" className="hover:text-ink">
                sancharsaathi.gov.in
              </a>
            </li>
          </ul>
        </div>
        <div>
          <h3 className="text-sm font-semibold text-ink">Built with</h3>
          <ul className="mt-4 space-y-2.5 text-sm text-ink-3">
            <li>Twilio voice</li>
            <li>OpenStreetMap</li>
            <li>scikit-learn model</li>
          </ul>
        </div>
      </div>
      <div className="border-t border-line">
        <div className={`${WRAP} py-6 text-[13px] text-ink-3`}>© 2026 Call Shield</div>
      </div>
    </footer>
  );
}

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-bg">
      <SiteHeader />
      <main>
        <Hero />
        <ScamStrip />
        <HowItWorks />
        <LiveSection />
        <PoliceSection />
        <Features />
        <CallToAction />
      </main>
      <Footer />
    </div>
  );
}
