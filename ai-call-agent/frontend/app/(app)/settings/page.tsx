'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import useSWR from 'swr';
import {
  Bot,
  Calendar,
  Check,
  Copy,
  Crosshair,
  FlaskConical,
  Gauge,
  Globe,
  Languages,
  Lock,
  Mail,
  MapPin,
  Mic,
  Phone,
  PhoneCall,
  PhoneForwarded,
  RefreshCw,
  Send,
  Server,
  Shield,
  Siren,
  SlidersHorizontal,
  UserRound,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/cn';
import { useSaveLocation } from '@/lib/location';
import { formatDate, formatPhone, type Tone } from '@/lib/format';
import type { Station, SystemStatus, User } from '@/lib/types';
import { Avatar, Card, CardHeader, IconTile, PageHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Field, Input, Segmented, Select, Switch } from '@/components/ui/field';
import { Badge } from '@/components/ui/badge';
import { Callout, Skeleton } from '@/components/ui/feedback';
import { Dialog } from '@/components/ui/overlay';
import { useToast } from '@/components/ui/toast';
import { MapView } from '@/components/map';

const SECTIONS = [
  { id: 'profile', label: 'Profile', icon: UserRound },
  { id: 'location', label: 'Location', icon: MapPin },
  { id: 'station', label: 'Police station', icon: Shield },
  { id: 'screening', label: 'Screening', icon: SlidersHorizontal },
  { id: 'delivery', label: 'Report delivery', icon: Send },
  { id: 'line', label: 'Protection line', icon: Phone },
  { id: 'forward', label: 'Forward your SIM', icon: PhoneForwarded },
  { id: 'system', label: 'System', icon: Server },
] as const;

type SectionId = (typeof SECTIONS)[number]['id'];

const TABS = [
  { id: 'profile', label: 'Profile', icon: UserRound },
  { id: 'location', label: 'Location', icon: MapPin },
  { id: 'screening', label: 'Screening', icon: SlidersHorizontal },
  { id: 'line', label: 'Phone line', icon: Phone },
  { id: 'system', label: 'System', icon: Server },
] as const;

type TabId = (typeof TABS)[number]['id'];

/** Reads ?tab=…, also accepting the section names used by older links. */
function toTab(value: string | null): TabId {
  if (value === 'station') return 'location';
  if (value === 'delivery') return 'screening';
  return TABS.find((t) => t.id === value)?.id ?? 'profile';
}

function useUpdateMe() {
  const { setUser } = useAuth();
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  async function update(body: Partial<User>, message = 'Saved') {
    setSaving(true);
    try {
      setUser(await api<User>('/api/me', { method: 'PATCH', body }));
      toast(message);
      return true;
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not save', 'error');
      return false;
    } finally {
      setSaving(false);
    }
  }
  return { update, saving };
}

function Section({ id, children, actions }: { id: SectionId; children: React.ReactNode; actions?: React.ReactNode }) {
  const meta = SECTIONS.find((s) => s.id === id)!;
  const Icon = meta.icon;
  return (
    <Card id={id} className="scroll-mt-24">
      <CardHeader title={meta.label} icon={<Icon />} tone="accent" actions={actions} />
      <div className="p-5">{children}</div>
    </Card>
  );
}

function SettingRow({ icon, label, children, className }: { icon: React.ReactNode; label: string; children?: React.ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-wrap items-center gap-3 py-4 first:pt-0 last:pb-0', className)}>
      <IconTile size="sm">{icon}</IconTile>
      <span className="min-w-0 flex-1 text-sm font-medium text-ink">{label}</span>
      {children}
    </div>
  );
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 py-3">
      <IconTile size="sm">{icon}</IconTile>
      <div className="min-w-0 flex-1">
        <div className="text-xs text-ink-3">{label}</div>
        <div className="truncate text-[13px] font-medium text-ink">{value}</div>
      </div>
    </div>
  );
}

function IdentityCard({ user }: { user: User }) {
  return (
    <Card className="p-6">
      <div className="flex flex-col items-center text-center">
        <Avatar name={user.name} size="lg" className="h-20 w-20 text-2xl" />
        <div className="mt-4 max-w-full truncate text-lg font-semibold tracking-tight text-ink">{user.name}</div>
        <div className="max-w-full truncate text-[13px] text-ink-3">{user.email}</div>
        <Badge tone={user.role === 'admin' ? 'accent' : 'neutral'} dot className="mt-3">
          {user.role === 'admin' ? 'Admin' : 'User'}
        </Badge>
      </div>
      <div className="mt-6 divide-y divide-line border-t border-line">
        <InfoRow icon={<Phone />} label="Phone" value={user.phone ? formatPhone(user.phone) : 'Not added'} />
        <InfoRow icon={<MapPin />} label="Location" value={user.address || 'Not set'} />
        <InfoRow icon={<Shield />} label="Police station" value={user.station?.name || 'Not chosen'} />
        <InfoRow icon={<Calendar />} label="Member since" value={formatDate(user.created_at)} />
      </div>
    </Card>
  );
}

function ProfileSection({ user }: { user: User }) {
  const { update, saving } = useUpdateMe();
  const [name, setName] = useState(user.name);
  const [phone, setPhone] = useState(user.phone || '');
  const dirty = name !== user.name || phone !== (user.phone || '');
  return (
    <Section id="profile">
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          update({ name: name.trim(), phone: phone.trim() || null });
        }}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Full name">{(id) => <Input id={id} value={name} onChange={(e) => setName(e.target.value)} required minLength={2} />}</Field>
          <Field label="Email">{(id) => <Input id={id} value={user.email} disabled />}</Field>
        </div>
        <Field label="Your phone number" hint="Safe calls ring this number. On a Twilio trial it must be a verified caller ID.">
          {(id) => <Input id={id} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 98765 43210" inputMode="tel" />}
        </Field>
        <Button type="submit" disabled={!dirty} loading={saving}>
          Save changes
        </Button>
      </form>
    </Section>
  );
}

function LocationSection({ user }: { user: User }) {
  const toast = useToast();
  const { save, locateWithGps, saving } = useSaveLocation();
  const [pending, setPending] = useState<{ lat: number; lng: number } | null>(null);
  const home = pending || (user.lat != null && user.lng != null ? { lat: user.lat, lng: user.lng } : null);

  async function run(task: () => Promise<{ user: User }>) {
    try {
      const result = await task();
      setPending(null);
      toast(result.user.station ? `Location saved. Nearest station: ${result.user.station.name}` : 'Location saved');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not save location', 'error');
    }
  }

  return (
    <Section
      id="location"
      actions={
        <Button size="sm" variant="secondary" onClick={() => run(locateWithGps)} loading={saving === 'gps'}>
          <Crosshair className="h-4 w-4" />
          Use my location
        </Button>
      }
    >
      <div className="h-72 overflow-hidden rounded-xl border border-line">
        <MapView home={home} stations={user.station && !pending ? [user.station] : []} selectedStationId={user.station?.id} onPick={(lat, lng) => setPending({ lat, lng })} />
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <IconTile size="sm" tone={pending ? 'warn' : 'neutral'}>
          <MapPin />
        </IconTile>
        <span className="min-w-0 flex-1 text-[13px] text-ink-2">
          {pending ? `${pending.lat.toFixed(5)}, ${pending.lng.toFixed(5)}` : user.address || 'Click the map or use your current location'}
        </span>
        {pending && (
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={() => setPending(null)}>
              Cancel
            </Button>
            <Button size="sm" onClick={() => run(() => save(pending.lat, pending.lng))} loading={saving === 'pick'}>
              Save location
            </Button>
          </div>
        )}
      </div>
    </Section>
  );
}

function StationSection({ user }: { user: User }) {
  const { setUser } = useAuth();
  const toast = useToast();
  const { data: stations } = useSWR<Station[]>(user.lat != null ? '/api/stations/nearby' : null);
  const [stationId, setStationId] = useState<number | null>(user.station?.id ?? null);
  const [email, setEmail] = useState(user.station?.email || '');
  const [phone, setPhone] = useState(user.station?.phone || '');
  const [saving, setSaving] = useState(false);

  function pick(id: number) {
    setStationId(id);
    const station = stations?.find((s) => s.id === id);
    setEmail(station?.email || '');
    setPhone(station?.phone || '');
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!stationId) return;
    setSaving(true);
    try {
      setUser(await api<User>('/api/me/station', { method: 'PUT', body: { station_id: stationId, email: email.trim() || null, phone: phone.trim() || null } }));
      toast('Police station saved');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not save', 'error');
    } finally {
      setSaving(false);
    }
  }

  if (user.lat == null) {
    return (
      <Section id="station">
        <Callout tone="info">Set your location first. The nearest police station is chosen automatically.</Callout>
      </Section>
    );
  }

  return (
    <Section id="station">
      {user.station && (
        <div className="mb-5 flex items-center gap-3 rounded-xl border border-line bg-bg p-4">
          <IconTile tone="accent">
            <Shield />
          </IconTile>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold text-ink">{user.station.name}</div>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {user.station.distance_km != null && <Badge className="h-5 px-1.5 text-[11px]">{user.station.distance_km.toFixed(1)} km</Badge>}
              <Badge tone={user.station.email ? 'safe' : 'warn'} dot className="h-5 px-1.5 text-[11px]">
                {user.station.email ? 'Email set' : 'Email missing'}
              </Badge>
            </div>
          </div>
        </div>
      )}
      <form onSubmit={submit} className="space-y-4">
        <Field label="Station">
          {(id) =>
            stations ? (
              <Select id={id} value={stationId ?? ''} onChange={(e) => pick(Number(e.target.value))}>
                {!stationId && <option value="">Choose a station</option>}
                {stations.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} · {s.distance_km?.toFixed(1)} km
                  </option>
                ))}
              </Select>
            ) : (
              <Skeleton className="h-10" />
            )
          }
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Station email" hint={!email ? 'Find the official email on your state police website.' : undefined}>
            {(id) => <Input id={id} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="sho-station@police.gov.in" />}
          </Field>
          <Field label="Station phone">{(id) => <Input id={id} value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" />}</Field>
        </div>
        <Button type="submit" loading={saving} disabled={!stationId}>
          Save station
        </Button>
      </form>
    </Section>
  );
}

function thresholdLabel(value: number) {
  if (value <= 60) return 'Strict';
  if (value <= 80) return 'Balanced';
  return 'Relaxed';
}

function ScreeningSection({ user }: { user: User }) {
  const { update } = useUpdateMe();
  const saved = Math.round(user.block_threshold * 100);
  const [draft, setDraft] = useState<number | null>(null);
  const threshold = draft ?? saved;

  async function commit() {
    if (draft === null) return;
    if (draft !== saved) await update({ block_threshold: draft / 100 }, 'Threshold saved');
    setDraft(null);
  }

  return (
    <Section id="screening">
      <div className="divide-y divide-line">
        <SettingRow icon={<Languages />} label="Caller language">
          <Segmented<User['language']>
            value={user.language}
            onChange={(language) => update({ language }, 'Language saved')}
            options={[
              { value: 'ask', label: 'Ask caller' },
              { value: 'en', label: 'English' },
              { value: 'hi', label: 'Hindi' },
            ]}
          />
        </SettingRow>
        <div className="py-4">
          <div className="flex items-center gap-3">
            <IconTile size="sm">
              <Gauge />
            </IconTile>
            <span className="flex-1 text-sm font-medium text-ink">Block calls at risk score</span>
            <span className="rounded-full bg-subtle px-2.5 py-0.5 text-xs font-medium text-ink-2">{thresholdLabel(threshold)}</span>
            <span className="tabular w-12 text-right text-base font-semibold text-ink">{threshold}%</span>
          </div>
          <div className="mt-4 pl-11">
            <input
              type="range"
              min={50}
              max={95}
              step={5}
              value={threshold}
              onChange={(e) => setDraft(Number(e.target.value))}
              onPointerUp={commit}
              onKeyUp={commit}
              className="w-full accent-accent"
              aria-label="Block threshold"
            />
            <div className="mt-1 flex justify-between text-[11px] text-ink-3">
              <span>Stricter</span>
              <span>More relaxed</span>
            </div>
          </div>
        </div>
        <SettingRow icon={<Siren />} label="Report blocked scam calls to police automatically">
          <Switch checked={user.auto_report} onChange={(auto_report) => update({ auto_report }, auto_report ? 'Automatic reports on' : 'Automatic reports off')} label="Automatic police reports" />
        </SettingRow>
      </div>
    </Section>
  );
}

function ChoiceCard({
  selected,
  icon,
  tone,
  title,
  detail,
  onClick,
  locked,
}: {
  selected: boolean;
  icon: React.ReactNode;
  tone: Tone;
  title: string;
  detail: string;
  onClick: () => void;
  locked?: boolean;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onClick}
      className={cn(
        'relative flex items-start gap-3 rounded-xl border bg-surface p-4 text-left transition-all',
        selected ? 'border-accent ring-3 ring-accent-soft' : 'border-line hover:border-line-strong',
      )}
    >
      <IconTile tone={tone}>{icon}</IconTile>
      <div className="min-w-0 flex-1 pr-6">
        <div className="text-sm font-semibold text-ink">{title}</div>
        <div className="mt-0.5 truncate text-xs text-ink-3" title={detail}>{detail}</div>
      </div>
      <span
        className={cn(
          'absolute top-4 right-4 flex h-5 w-5 items-center justify-center rounded-full border-2',
          selected ? 'border-accent bg-accent text-on-accent' : 'border-line-strong',
        )}
      >
        {selected ? <Check className="h-3 w-3" strokeWidth={3} /> : locked ? <Lock className="h-2.5 w-2.5 text-ink-3" /> : null}
      </span>
    </button>
  );
}

function DeliverySection({ user, system }: { user: User; system?: SystemStatus }) {
  const { update, saving } = useUpdateMe();
  const [confirm, setConfirm] = useState(false);
  const allowed = system?.live_delivery_allowed;

  return (
    <Section id="delivery">
      <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Send police reports to">
        <ChoiceCard
          selected={user.police_delivery === 'test'}
          icon={<FlaskConical />}
          tone="warn"
          title="Me (test)"
          detail={user.email}
          onClick={() => user.police_delivery !== 'test' && update({ police_delivery: 'test' }, 'Test mode on')}
        />
        <ChoiceCard
          selected={user.police_delivery === 'live'}
          icon={<Shield />}
          tone="safe"
          title="Police station"
          detail={user.station?.email || 'Station email not set'}
          locked={!allowed}
          onClick={() => user.police_delivery !== 'live' && setConfirm(true)}
        />
      </div>
      <div className="mt-4">
        {user.police_delivery === 'test' ? (
          <Callout tone="warn">Test mode: complaint emails come to you, so no real police station is contacted while you try things out.</Callout>
        ) : (
          <Callout tone="safe">Live: complaints are emailed to {user.station?.email || 'your police station'} with a copy to you.</Callout>
        )}
        {!allowed && user.police_delivery === 'test' && (
          <p className="mt-3 flex items-center gap-1.5 text-xs text-ink-3">
            <Lock className="h-3 w-3" />
            Live delivery is locked on this server. Set ALLOW_LIVE_POLICE_EMAIL=true in backend/.env to unlock it.
          </p>
        )}
      </div>
      <Dialog
        open={confirm}
        onClose={() => setConfirm(false)}
        title="Email real police stations?"
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirm(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              loading={saving}
              onClick={async () => {
                if (await update({ police_delivery: 'live' }, 'Live delivery on')) setConfirm(false);
              }}
            >
              Turn on live delivery
            </Button>
          </>
        }
      >
        Scam calls will be reported to {user.station?.name || 'your nearest police station'} in your name. Only turn this on for real use, never for tests.
      </Dialog>
    </Section>
  );
}

function LineSection({ user, system, onChange }: { user: User; system?: SystemStatus; onChange: () => void }) {
  const { setUser } = useAuth();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  async function toggle(claim: boolean) {
    setBusy(true);
    try {
      setUser(await api<User>('/api/me/line', { method: claim ? 'POST' : 'DELETE' }));
      onChange();
      toast(claim ? 'Protection line active' : 'Protection line released');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not update', 'error');
    } finally {
      setBusy(false);
    }
  }

  if (!system) return <Skeleton className="h-36 rounded-2xl" />;
  return (
    <Section id="line">
      {!system.twilio_number ? (
        <Callout tone="info">Add TWILIO_PHONE_NUMBER to backend/.env to enable a protection line. Browser test calls work without it.</Callout>
      ) : (
        <div className="flex flex-wrap items-center gap-4 rounded-xl border border-line bg-bg p-4">
          <IconTile tone={user.line_number ? 'safe' : 'neutral'} size="lg">
            <PhoneCall />
          </IconTile>
          <div className="min-w-0 flex-1">
            <div className="tabular text-xl font-semibold tracking-tight text-ink">{formatPhone(system.twilio_number)}</div>
            <div className="mt-1.5">
              {user.line_number ? (
                <Badge tone="safe" live>
                  Active for you
                </Badge>
              ) : system.line_claimed ? (
                <Badge tone="warn" dot>
                  Used by another account
                </Badge>
              ) : (
                <Badge dot>Available</Badge>
              )}
            </div>
          </div>
          {user.line_number ? (
            <Button variant="secondary" onClick={() => toggle(false)} loading={busy}>
              Release
            </Button>
          ) : (
            <Button onClick={() => toggle(true)} loading={busy} disabled={system.line_claimed}>
              Activate
            </Button>
          )}
        </div>
      )}
    </Section>
  );
}

type Health = 'ok' | 'warn' | 'off';

const healthTone: Record<Health, Tone> = { ok: 'safe', warn: 'warn', off: 'danger' };
const healthLabel: Record<Health, string> = { ok: 'Ready', warn: 'Check', off: 'Off' };

function HealthTile({ icon, label, state, value }: { icon: React.ReactNode; label: string; state: Health; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-line bg-bg p-4">
      <IconTile size="sm" tone={healthTone[state]}>
        {icon}
      </IconTile>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-semibold text-ink">{label}</span>
          <Badge tone={healthTone[state]} dot className="h-5 px-1.5 text-[11px]">
            {healthLabel[state]}
          </Badge>
        </div>
        <div className="mt-1 text-xs leading-relaxed wrap-anywhere text-ink-3">{value}</div>
      </div>
    </div>
  );
}

function SystemSection({ system, onRefresh }: { system?: SystemStatus; onRefresh: (data: SystemStatus) => void }) {
  const toast = useToast();
  const [syncing, setSyncing] = useState(false);

  async function sync() {
    setSyncing(true);
    try {
      const status = await api<SystemStatus>('/api/system/twilio/sync', { method: 'POST' });
      onRefresh(status);
      if (status.twilio_sync?.ok) toast('Twilio connected');
      else toast(status.twilio_sync?.error || 'Twilio setup is incomplete', 'error');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not reconnect', 'error');
    } finally {
      setSyncing(false);
    }
  }

  if (!system) return <Skeleton className="h-72 rounded-2xl" />;
  const sync_ = system.twilio_sync;
  const tiles: { key: string; icon: React.ReactNode; label: string; state: Health; value: React.ReactNode }[] = [
    {
      key: 'url',
      icon: <Globe />,
      label: 'Public URL',
      state: system.public_url ? 'ok' : 'off',
      value: system.public_url ? `${system.public_url} (${system.public_url_source})` : 'Not found. Start ngrok or cloudflared for port 8000.',
    },
    {
      key: 'twilio',
      icon: <Server />,
      label: 'Twilio',
      state: sync_?.ok ? 'ok' : system.twilio_configured ? 'warn' : 'off',
      value: !system.twilio_configured
        ? 'Add TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN to backend/.env'
        : sync_?.ok
          ? 'Connected'
          : sync_?.error || 'Not connected yet',
    },
    {
      key: 'browser',
      icon: <Mic />,
      label: 'Browser calling',
      state: sync_?.browser_calling ? 'ok' : 'warn',
      value: sync_?.browser_calling ? 'Test calls work from this site' : 'Needs Twilio',
    },
    ...(system.twilio_number
      ? [
          {
            key: 'line',
            icon: <PhoneCall />,
            label: 'Phone line',
            state: (sync_?.number_configured ? 'ok' : 'warn') as Health,
            value: sync_?.number_configured ? `${formatPhone(system.twilio_number)} answers with Call Shield` : sync_?.error || 'Not configured yet',
          },
        ]
      : []),
    {
      key: 'email',
      icon: <Mail />,
      label: 'Report email',
      state: system.smtp_configured ? 'ok' : 'off',
      value: system.smtp_configured ? `Sending from ${system.smtp_sender}` : 'Add SMTP_USERNAME and SMTP_PASSWORD to backend/.env',
    },
    {
      key: 'model',
      icon: <Bot />,
      label: 'Spam model',
      state: system.model_loaded ? 'ok' : 'off',
      value: system.model_loaded ? 'Loaded' : system.model_error || 'Not loaded',
    },
    {
      key: 'translate',
      icon: <Languages />,
      label: 'Hindi translation',
      state: system.translator === 'off' ? 'warn' : 'ok',
      value: system.translator === 'local' ? 'Offline model' : system.translator === 'online' ? 'Free online service' : 'Off',
    },
  ];
  const ready = tiles.filter((t) => t.state === 'ok').length;

  return (
    <Section
      id="system"
      actions={
        <>
          <span className="tabular hidden text-xs font-medium text-ink-3 sm:inline">
            {ready} of {tiles.length} ready
          </span>
          <Button size="sm" variant="secondary" onClick={sync} loading={syncing} disabled={!system.twilio_configured}>
            <RefreshCw className="h-4 w-4" />
            Reconnect Twilio
          </Button>
        </>
      }
    >
      <div className="mb-5 flex gap-1.5">
        {tiles.map((t) => (
          <span key={t.key} className={cn('h-1.5 flex-1 rounded-full', t.state === 'ok' ? 'bg-safe' : t.state === 'warn' ? 'bg-warn' : 'bg-danger')} />
        ))}
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {tiles.map(({ key, ...tile }) => (
          <HealthTile key={key} {...tile} />
        ))}
      </div>
    </Section>
  );
}

function CodeRow({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center gap-3 rounded-xl border border-line bg-bg px-4 py-3">
      <div className="min-w-0 flex-1">
        <div className="text-xs text-ink-3">{label}</div>
        <div className="tabular truncate font-mono text-[15px] font-semibold text-ink">{value}</div>
      </div>
      <button
        type="button"
        onClick={() => {
          navigator.clipboard?.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-line bg-surface text-ink-2 transition-colors hover:text-ink"
        aria-label={`Copy ${label}`}
      >
        {copied ? <Check className="h-4 w-4 text-safe" /> : <Copy className="h-4 w-4" />}
      </button>
    </div>
  );
}

/** GSM codes that send calls declined by the Android app to the AI line. */
function ForwardSection({ system }: { system?: SystemStatus }) {
  if (!system?.twilio_number) return null;
  return (
    <Section id="forward">
      <div className="space-y-3">
        <CodeRow label="Turn on" value={`**67*${system.twilio_number}#`} />
        <CodeRow label="Turn off" value="##67#" />
      </div>
      <p className="mt-4 text-[13px] leading-relaxed text-ink-3">Dial the code on your phone. Unknown calls declined by the Call Shield app then reach the AI line.</p>
    </Section>
  );
}

function SettingsView() {
  const { user } = useAuth();
  const router = useRouter();
  const tab = toTab(useSearchParams().get('tab'));
  const { data: system, mutate: mutateSystem } = useSWR<SystemStatus>('/api/system/status');
  if (!user) return null;

  const systemIssue =
    system &&
    (!system.public_url ||
      !system.twilio_sync?.ok ||
      !system.smtp_configured ||
      !system.model_loaded ||
      Boolean(system.twilio_number && !system.twilio_sync?.number_configured));
  const attention: Record<TabId, boolean> = {
    profile: !user.phone,
    location: user.lat == null || !user.station?.email,
    screening: false,
    line: Boolean(system?.twilio_number && !user.line_number),
    system: Boolean(systemIssue),
  };

  return (
    <>
      <PageHeader title="Settings" />
      <nav className="mb-6 flex gap-1 overflow-x-auto rounded-2xl border border-line bg-surface p-1.5 shadow-card" role="tablist" aria-label="Settings">
        {TABS.map(({ id, label, icon: Icon }) => {
          const active = tab === id;
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => router.replace(id === 'profile' ? '/settings' : `/settings?tab=${id}`, { scroll: false })}
              className={cn(
                'flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors',
                active ? 'bg-accent-soft text-accent-ink' : 'text-ink-2 hover:bg-subtle hover:text-ink',
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
              {attention[id] && <span className="h-1.5 w-1.5 rounded-full bg-warn" aria-label="Needs attention" />}
            </button>
          );
        })}
      </nav>

      <div key={tab} className="animate-in">
        {tab === 'profile' && (
          <div className="grid items-start gap-6 lg:grid-cols-[340px_1fr]">
            <IdentityCard user={user} />
            <ProfileSection user={user} />
          </div>
        )}
        {tab === 'location' && (
          <div className="grid gap-6 xl:grid-cols-2">
            <LocationSection user={user} />
            <StationSection key={`${user.station?.id}-${user.station?.email}-${user.station?.phone}`} user={user} />
          </div>
        )}
        {tab === 'screening' && (
          <div className="grid gap-6 xl:grid-cols-2">
            <ScreeningSection user={user} />
            <DeliverySection user={user} system={system} />
          </div>
        )}
        {tab === 'line' && (
          <div className="grid items-start gap-6 xl:grid-cols-2">
            <LineSection user={user} system={system} onChange={() => mutateSystem()} />
            <ForwardSection system={system} />
          </div>
        )}
        {tab === 'system' && <SystemSection system={system} onRefresh={(data) => mutateSystem(data, { revalidate: false })} />}
      </div>
    </>
  );
}

export default function SettingsPage() {
  return (
    <Suspense>
      <SettingsView />
    </Suspense>
  );
}
