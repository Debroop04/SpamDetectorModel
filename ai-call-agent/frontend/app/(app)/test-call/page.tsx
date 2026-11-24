'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import useSWR from 'swr';
import type { Call as VoiceCall, Device } from '@twilio/voice-sdk';
import { ArrowUpRight, Check, Copy, Grid3x3, Mic, MicOff, Phone, PhoneOff, ShieldCheck, ShieldX } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { formatDuration, verdictLabel } from '@/lib/format';
import { useLive, useLiveEvent } from '@/lib/live';
import type { Call, SystemStatus } from '@/lib/types';
import { Card, CardHeader, IconTile, PageHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/field';
import { Badge, VerdictBadge } from '@/components/ui/badge';
import { Callout } from '@/components/ui/feedback';
import { RiskMeter } from '@/components/charts';
import { LiveCallCard } from '@/components/calls/live-call';

type Phase = 'idle' | 'connecting' | 'active' | 'ended';

const SCRIPTS = [
  {
    label: 'Bank KYC scam',
    scam: true,
    text: 'Hello, I am calling from State Bank. Your KYC has expired and your account will be blocked today. Please tell me the OTP you just received.',
  },
  {
    label: 'Digital arrest scam',
    scam: true,
    text: 'This is an officer from CBI. A parcel in your name has drugs inside. You are under digital arrest, do not disconnect the call.',
  },
  {
    label: 'Hindi scam',
    scam: true,
    text: 'नमस्ते, मैं बिजली विभाग से बोल रहा हूँ। आपका बिजली कनेक्शन आज रात कट जाएगा, तुरंत भुगतान कीजिए।',
  },
  {
    label: 'Normal call',
    scam: false,
    text: 'Hi, this is Rahul from college. I am calling about tomorrow’s project meeting.',
  },
];

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'];

function ScriptCard({ script }: { script: (typeof SCRIPTS)[number] }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex flex-col rounded-xl border border-line bg-bg p-4">
      <div className="flex items-center gap-2.5">
        <IconTile size="sm" tone={script.scam ? 'danger' : 'safe'}>
          {script.scam ? <ShieldX /> : <ShieldCheck />}
        </IconTile>
        <span className="flex-1 text-sm font-semibold text-ink">{script.label}</span>
        <button
          type="button"
          onClick={() => {
            navigator.clipboard?.writeText(script.text);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
          className="rounded-lg p-1.5 text-ink-3 transition-colors hover:bg-surface hover:text-ink"
          aria-label={`Copy ${script.label}`}
        >
          {copied ? <Check className="h-4 w-4 text-safe" /> : <Copy className="h-4 w-4" />}
        </button>
      </div>
      <p className="mt-3 text-sm leading-relaxed text-ink-2">{script.text}</p>
    </div>
  );
}

export default function TestCallPage() {
  const { activeCalls } = useLive();
  const { data: system } = useSWR<SystemStatus>('/api/system/status');
  const deviceRef = useRef<Device | null>(null);
  const callRef = useRef<VoiceCall | null>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  const [callerNumber, setCallerNumber] = useState('+91 98765 00001');
  const [muted, setMuted] = useState(false);
  const [keypad, setKeypad] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState(0);
  const [screenedCallId, setScreenedCallId] = useState<number | null>(null);
  const [lastCall, setLastCall] = useState<Call | null>(null);

  useEffect(() => {
    if (phase !== 'active') return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [phase]);

  useEffect(
    () => () => {
      callRef.current?.disconnect();
      deviceRef.current?.destroy();
    },
    [],
  );

  useLiveEvent((event, data) => {
    const call = data as Call;
    if (event === 'call.started' && call.channel === 'browser' && (phase === 'connecting' || phase === 'active')) {
      setScreenedCallId(call.id);
    }
    if ((event === 'call.updated' || event === 'call.ended') && call.id === screenedCallId) {
      setLastCall(call);
    }
  });

  async function getDevice(): Promise<Device> {
    if (deviceRef.current) return deviceRef.current;
    const { Device } = await import('@twilio/voice-sdk');
    const { token } = await api<{ token: string }>('/api/twilio/token');
    const device = new Device(token, { logLevel: 'error' });
    device.on('tokenWillExpire', async () => {
      const fresh = await api<{ token: string }>('/api/twilio/token');
      device.updateToken(fresh.token);
    });
    deviceRef.current = device;
    return device;
  }

  async function start() {
    setError(null);
    setPhase('connecting');
    setScreenedCallId(null);
    setLastCall(null);
    try {
      const device = await getDevice();
      const call = await device.connect({ params: { callerNumber: callerNumber.trim() } });
      callRef.current = call;
      call.on('accept', () => {
        const acceptedAt = Date.now();
        setPhase('active');
        setStartedAt(acceptedAt);
        setNow(acceptedAt);
      });
      const end = () => {
        setPhase('ended');
        setMuted(false);
        callRef.current = null;
      };
      call.on('disconnect', end);
      call.on('cancel', end);
      call.on('reject', end);
      call.on('error', (err: { message?: string }) => {
        setError(err?.message || 'The call failed');
        end();
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start the call');
      setPhase('idle');
    }
  }

  function hangUp() {
    callRef.current?.disconnect();
  }

  function toggleMute() {
    if (!callRef.current) return;
    callRef.current.mute(!muted);
    setMuted(!muted);
  }

  function press(key: string) {
    callRef.current?.sendDigits(key);
  }

  const inCall = phase === 'connecting' || phase === 'active';
  const liveCall = activeCalls.find((c) => c.id === screenedCallId);
  const elapsed = startedAt ? Math.max(0, Math.round((now - startedAt) / 1000)) : 0;
  const ready = system?.twilio_sync?.browser_calling;

  return (
    <>
      <PageHeader
        title="Test call"
        meta={
          system &&
          (ready ? (
            <Badge tone="safe" dot>
              Ready
            </Badge>
          ) : (
            <Badge tone="warn" dot>
              Twilio not connected
            </Badge>
          ))
        }
      />
      <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
        <Card className="self-start overflow-hidden">
          <div className="relative flex flex-col items-center overflow-hidden border-b border-line bg-bg px-6 pt-10 pb-8">
            <div className="relative flex h-24 w-24 items-center justify-center">
              {inCall && (
                <>
                  <span className={cn('ripple absolute inset-0 rounded-full border-2', phase === 'active' ? 'border-safe' : 'border-accent')} />
                  <span className={cn('ripple ripple-delay absolute inset-0 rounded-full border-2', phase === 'active' ? 'border-safe' : 'border-accent')} />
                </>
              )}
              <span
                className={cn(
                  'relative flex h-24 w-24 items-center justify-center rounded-full border-4 border-surface shadow-card',
                  phase === 'active' ? 'bg-safe text-white dark:text-[#04140b]' : phase === 'connecting' ? 'bg-accent text-on-accent' : 'bg-accent-soft text-accent',
                )}
              >
                <Phone className="h-9 w-9" />
              </span>
            </div>
            <div className="mt-5 text-xl font-semibold tracking-tight text-ink">
              {phase === 'idle' && 'Ready to call'}
              {phase === 'connecting' && 'Connecting'}
              {phase === 'active' && <span className="tabular">{formatDuration(elapsed)}</span>}
              {phase === 'ended' && 'Call ended'}
            </div>
            <div className="tabular mt-1.5 rounded-full border border-line bg-surface px-3 py-1 text-xs font-medium text-ink-2">{callerNumber || 'No number'}</div>
          </div>

          <div className="space-y-5 px-6 py-6">
            {error && (
              <Callout tone="danger" action={<Link href="/settings?tab=system" className="font-semibold hover:underline">Settings</Link>}>
                {error}
              </Callout>
            )}
            {!inCall && (
              <Field label="Call as number">
                {(id) => <Input id={id} value={callerNumber} onChange={(e) => setCallerNumber(e.target.value)} inputMode="tel" />}
              </Field>
            )}

            {inCall && keypad && (
              <div className="mx-auto grid max-w-64 grid-cols-3 gap-3">
                {KEYS.map((key) => (
                  <button
                    key={key}
                    onClick={() => press(key)}
                    className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-line bg-bg text-lg font-semibold text-ink transition-colors hover:bg-subtle active:bg-muted"
                  >
                    {key}
                  </button>
                ))}
              </div>
            )}

            <div className="flex items-center justify-center gap-5">
              {inCall && (
                <Button variant="secondary" size="icon" className="h-12 w-12 rounded-full" onClick={toggleMute} aria-label={muted ? 'Unmute' : 'Mute'}>
                  {muted ? <MicOff className="h-5 w-5 text-danger" /> : <Mic className="h-5 w-5" />}
                </Button>
              )}
              {inCall ? (
                <Button variant="danger" className="h-16 w-16 rounded-full" onClick={hangUp} aria-label="Hang up">
                  <PhoneOff className="h-6 w-6" />
                </Button>
              ) : (
                <Button variant="success" className="h-16 w-16 rounded-full" onClick={start} aria-label="Start call">
                  <Phone className="h-6 w-6" />
                </Button>
              )}
              {inCall && (
                <Button
                  variant="secondary"
                  size="icon"
                  className={cn('h-12 w-12 rounded-full', keypad && 'border-accent text-accent')}
                  onClick={() => setKeypad((v) => !v)}
                  aria-label="Keypad"
                >
                  <Grid3x3 className="h-5 w-5" />
                </Button>
              )}
            </div>
          </div>
        </Card>

        <div className="min-w-0 space-y-6">
          {!ready && system && (
            <Callout tone="warn" action={<Link href="/settings?tab=system" className="font-semibold hover:underline">Settings</Link>}>
              Browser calling needs Twilio. Add your Twilio keys in backend/.env and reconnect in Settings.
            </Callout>
          )}

          {liveCall ? (
            <LiveCallCard call={liveCall} compact />
          ) : lastCall && phase === 'ended' ? (
            <Card className="animate-in p-5">
              <div className="flex flex-wrap items-center gap-4">
                <IconTile size="lg" tone={lastCall.verdict === 'spam' ? 'danger' : lastCall.verdict === 'suspicious' ? 'warn' : 'safe'}>
                  {lastCall.verdict === 'spam' ? <ShieldX /> : <ShieldCheck />}
                </IconTile>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-base font-semibold text-ink">
                      {lastCall.verdict === 'spam' ? 'Blocked as a scam' : lastCall.verdict === 'pending' ? 'Screening finished' : verdictLabel[lastCall.verdict]}
                    </span>
                    <VerdictBadge verdict={lastCall.verdict} />
                  </div>
                  {lastCall.category && <div className="mt-0.5 text-[13px] text-ink-3">{lastCall.category}</div>}
                </div>
                <Link href={`/calls?open=${lastCall.id}`} className="inline-flex items-center gap-1 text-[13px] font-semibold text-accent hover:text-accent-hover">
                  View call
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </Link>
              </div>
              <div className="mt-4">
                <RiskMeter score={lastCall.risk_score} />
              </div>
            </Card>
          ) : null}

          <Card>
            <CardHeader title="Lines to try" icon={<Mic />} tone="accent" />
            <div className="grid gap-3 p-5 md:grid-cols-2">
              {SCRIPTS.map((script) => (
                <ScriptCard key={script.label} script={script} />
              ))}
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
