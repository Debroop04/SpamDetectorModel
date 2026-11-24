'use client';

import { useEffect, useState } from 'react';
import { Check, Copy, Download, Link2, PhoneIncoming, Settings2, ShieldCheck, Smartphone, Wifi } from 'lucide-react';
import { API_URL } from '@/lib/api';
import { cn } from '@/lib/cn';
import { SiteHeader, WRAP } from '@/components/site-header';
import { LogoMark } from '@/components/logo';

interface ApkInfo {
  versionName: string;
  versionCode: number;
  url: string;
  sizeBytes?: number;
  updated?: string;
}

interface AppInfo {
  lan_servers: string[];
  public_server: string | null;
}

const STEPS = [
  { icon: Download, title: 'Download the APK', text: 'Tap Download on your Android phone. The file is about 3 MB.' },
  { icon: ShieldCheck, title: 'Allow the install', text: 'When Android asks, allow installs from your browser for this file only.' },
  { icon: Link2, title: 'Connect the app', text: 'Come back to this page and tap Open app and connect. No typing needed.' },
  { icon: Settings2, title: 'Turn on protection', text: 'Allow call screening and set forward-when-busy to your AI line.' },
];

function useAppData() {
  const [apk, setApk] = useState<ApkInfo | null>(null);
  const [info, setInfo] = useState<AppInfo | null>(null);
  useEffect(() => {
    fetch('/downloads/version.json', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then(setApk)
      .catch(() => setApk(null));
    fetch(`${API_URL}/api/app/info`)
      .then((r) => (r.ok ? r.json() : null))
      .then(setInfo)
      .catch(() => setInfo(null));
  }, []);
  return { apk, info };
}

/** The server the phone should use: the host this page came from, or the computer's Wi-Fi address. */
function serverForPhone(info: AppInfo | null): string | null {
  if (typeof window === 'undefined') return null;
  const host = window.location.hostname;
  if (host !== 'localhost' && host !== '127.0.0.1') return API_URL;
  return info?.lan_servers[0] ?? info?.public_server ?? null;
}

function CopyRow({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center gap-3 rounded-xl border border-line bg-bg px-4 py-3">
      <div className="min-w-0 flex-1">
        <div className="text-xs text-ink-3">{label}</div>
        <div className="truncate font-mono text-sm text-ink">{value}</div>
      </div>
      <button
        type="button"
        onClick={() => {
          navigator.clipboard?.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-line bg-surface text-ink-2 hover:text-ink"
        aria-label={`Copy ${label}`}
      >
        {copied ? <Check className="h-4 w-4 text-safe" /> : <Copy className="h-4 w-4" />}
      </button>
    </div>
  );
}

function PhonePreview() {
  return (
    <div className="mx-auto w-[300px] rounded-[44px] border-[10px] border-ink bg-ink shadow-pop">
      <div className="overflow-hidden rounded-[34px] bg-bg">
        <div className="flex h-7 items-center justify-center">
          <span className="h-1.5 w-16 rounded-full bg-line-strong" />
        </div>
        <div className="space-y-3 px-4 pb-5">
          <div className="flex items-center justify-between pt-1">
            <span className="text-lg font-semibold text-ink">Hello, Asha</span>
            <span className="h-2.5 w-2.5 rounded-full bg-safe" />
          </div>
          <div className="rounded-2xl border border-line bg-surface p-3">
            <div className="flex items-center gap-2.5">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-safe-soft text-safe">
                <ShieldCheck className="h-5 w-5" />
              </span>
              <span className="text-sm font-semibold text-ink">Protection is on</span>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-1.5">
              {[
                ['4', 'Sent to AI', 'bg-accent-soft'],
                ['2', 'Blocked', 'bg-danger-soft'],
                ['9', 'Rang you', 'bg-safe-soft'],
              ].map(([n, label, bg]) => (
                <div key={label} className={cn('rounded-lg px-2 py-1.5', bg)}>
                  <div className="text-sm font-semibold text-ink">{n}</div>
                  <div className="text-[9px] text-ink-2">{label}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-2xl border border-line bg-surface">
            {[
              ['+91 98765 43210', 'Financial scam', 'Blocked', 'text-danger', 'bg-danger-soft'],
              ['+91 90000 55555', 'Sent to your AI', 'To AI', 'text-accent', 'bg-accent-soft'],
              ['Rahul', 'Saved contact', 'Rang', 'text-safe', 'bg-safe-soft'],
            ].map(([who, why, tag, color, bg], i) => (
              <div key={who} className={cn('flex items-center gap-2.5 px-3 py-2.5', i > 0 && 'border-t border-line')}>
                <span className={cn('flex h-7 w-7 items-center justify-center rounded-full', bg, color)}>
                  <PhoneIncoming className="h-3.5 w-3.5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs font-medium text-ink">{who}</div>
                  <div className="truncate text-[10px] text-ink-3">{why}</div>
                </div>
                <span className={cn('text-[10px] font-semibold', color)}>{tag}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function DownloadPage() {
  const { apk, info } = useAppData();
  const [server, setServer] = useState<string | null>(null);
  useEffect(() => {
    const timer = setTimeout(() => setServer(serverForPhone(info)), 0);
    return () => clearTimeout(timer);
  }, [info]);

  const size = apk?.sizeBytes ? `${(apk.sizeBytes / 1024 / 1024).toFixed(1)} MB` : '3 MB';
  const connectLink = server ? `callshield://connect?server=${encodeURIComponent(server)}` : null;

  return (
    <div className="min-h-screen bg-bg">
      <SiteHeader links={false} />
      <main>
        <section className="border-b border-line">
          <div className={`${WRAP} grid items-center gap-14 py-14 lg:grid-cols-[1.1fr_1fr] lg:py-24`}>
            <div>
              <LogoMark className="h-16 w-16 rounded-2xl [&_svg]:h-8 [&_svg]:w-8" />
              <h1 className="mt-8 text-[40px] leading-[1.05] font-semibold tracking-tight text-ink sm:text-[56px]">Call Shield for Android</h1>
              <div className="mt-6 flex flex-wrap gap-2">
                {[apk ? `Version ${apk.versionName}` : 'Version 1.0', size, 'Android 10 or newer', 'Free'].map((chip) => (
                  <span key={chip} className="rounded-full border border-line bg-surface px-3 py-1 text-[13px] font-medium text-ink-2">
                    {chip}
                  </span>
                ))}
              </div>
              <div className="mt-9 flex flex-wrap gap-3">
                <a
                  href={apk?.url ?? '/downloads/call-shield.apk'}
                  download="call-shield.apk"
                  className="inline-flex h-13 items-center gap-2.5 rounded-xl bg-accent px-7 text-base font-semibold text-on-accent transition-colors hover:bg-accent-hover"
                >
                  <Download className="h-5 w-5" />
                  Download APK
                </a>
                {connectLink && (
                  <a
                    href={connectLink}
                    className="inline-flex h-13 items-center gap-2.5 rounded-xl border border-line bg-surface px-7 text-base font-semibold text-ink transition-colors hover:bg-subtle"
                  >
                    <Smartphone className="h-5 w-5" />
                    Open app and connect
                  </a>
                )}
              </div>
            </div>
            <PhonePreview />
          </div>
        </section>

        <section className="border-b border-line bg-surface">
          <div className={`${WRAP} py-16 lg:py-20`}>
            <h2 className="text-3xl font-semibold tracking-tight text-ink">Install in four steps</h2>
            <ol className="mt-10 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
              {STEPS.map(({ icon: Icon, title, text }, i) => (
                <li key={title} className="rounded-2xl border border-line bg-bg p-6">
                  <div className="flex items-center justify-between">
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent text-on-accent">
                      <Icon className="h-5 w-5" />
                    </span>
                    <span className="tabular text-3xl font-semibold text-line-strong">0{i + 1}</span>
                  </div>
                  <h3 className="mt-6 text-base font-semibold text-ink">{title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-ink-2">{text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section>
          <div className={`${WRAP} grid gap-8 py-16 lg:grid-cols-[1fr_1.2fr] lg:py-20`}>
            <h2 className="text-3xl font-semibold tracking-tight text-ink">Server address for the app</h2>
            <div className="space-y-3">
              {server && <CopyRow label="On this Wi-Fi" value={server} />}
              {info?.lan_servers
                .filter((s) => s !== server)
                .map((s) => <CopyRow key={s} label="Wi-Fi address" value={s} />)}
              {info?.public_server && <CopyRow label="From anywhere (changes when the tunnel restarts)" value={info.public_server} />}
              {!info && (
                <div className="flex items-center gap-3 rounded-xl border border-line bg-surface px-4 py-3 text-sm text-ink-3">
                  <Wifi className="h-4 w-4" />
                  The backend is not reachable from this device
                </div>
              )}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
