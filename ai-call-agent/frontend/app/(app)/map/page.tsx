'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { Check, Crosshair, Mail, MapPinned, Navigation, Phone, PhoneCall, Shield, ShieldAlert } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/cn';
import { useSaveLocation } from '@/lib/location';
import type { Hotspot, Station, User } from '@/lib/types';
import { Card, IconTile, PageHeader } from '@/components/ui/card';
import { Button, ButtonLink } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Empty, Skeleton } from '@/components/ui/feedback';
import { useToast } from '@/components/ui/toast';
import { MapView } from '@/components/map';

function Legend() {
  return (
    <div className="pointer-events-none absolute bottom-3 left-3 z-10 flex flex-wrap gap-x-4 gap-y-1.5 rounded-xl border border-line bg-surface/95 px-3.5 py-2.5 text-xs text-ink-2 shadow-pop">
      <span className="flex items-center gap-1.5">
        <span className="h-3 w-3 rounded-full border-2 border-surface bg-accent ring-1 ring-line-strong" />
        You
      </span>
      <span className="flex items-center gap-1.5">
        <span className="h-3 w-3 rounded-sm bg-ink" />
        Your station
      </span>
      <span className="flex items-center gap-1.5">
        <span className="h-3 w-3 rounded-sm border border-line-strong bg-surface" />
        Other stations
      </span>
      <span className="flex items-center gap-1.5">
        <span className="h-3 w-3 rounded-full border border-danger bg-danger-soft" />
        Spam reports
      </span>
    </div>
  );
}

function OverlayStat({ icon, value, label }: { icon: React.ReactNode; value: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-line bg-surface/95 px-3 py-2 shadow-pop">
      {icon}
      <div className="leading-tight">
        <div className="tabular text-sm font-semibold text-ink">{value}</div>
        <div className="text-[11px] text-ink-3">{label}</div>
      </div>
    </div>
  );
}

function SelectedStation({ station }: { station: Station }) {
  return (
    <Card className="p-5">
      <div className="flex items-start gap-3">
        <IconTile tone="accent">
          <Shield />
        </IconTile>
        <div className="min-w-0 flex-1">
          <div className="text-xs font-medium text-accent">Reports go to</div>
          <div className="mt-0.5 text-[15px] leading-snug font-semibold text-ink">{station.name}</div>
          {station.distance_km != null && <div className="tabular mt-1 text-xs text-ink-3">{station.distance_km.toFixed(1)} km away</div>}
        </div>
      </div>
      <div className="mt-4 space-y-2 text-[13px]">
        <div className="flex items-center gap-2.5 text-ink-2">
          <Phone className="h-3.5 w-3.5 shrink-0 text-ink-3" />
          <span className="truncate">{station.phone || 'Phone not known'}</span>
        </div>
        <div className="flex items-center gap-2.5 text-ink-2">
          <Mail className="h-3.5 w-3.5 shrink-0 text-ink-3" />
          <span className="truncate">{station.email || 'Email not set'}</span>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        {station.phone ? (
          <ButtonLink href={`tel:${station.phone}`} external variant="secondary" size="sm">
            <PhoneCall className="h-3.5 w-3.5" />
            Call
          </ButtonLink>
        ) : (
          <ButtonLink href="/settings?tab=location" variant="secondary" size="sm">
            <Mail className="h-3.5 w-3.5" />
            Add contact
          </ButtonLink>
        )}
        <ButtonLink href={`https://www.google.com/maps/dir/?api=1&destination=${station.lat},${station.lng}`} external variant="secondary" size="sm">
          <Navigation className="h-3.5 w-3.5" />
          Directions
        </ButtonLink>
      </div>
    </Card>
  );
}

export default function MapPage() {
  const { user, setUser } = useAuth();
  const toast = useToast();
  const { locateWithGps, saving } = useSaveLocation();
  const [choosing, setChoosing] = useState<number | null>(null);
  const hasLocation = user?.lat != null && user?.lng != null;

  const { data: stations, isLoading } = useSWR<Station[]>(hasLocation ? '/api/stations/nearby' : null);
  const { data: hotspots } = useSWR<Hotspot[]>(hasLocation ? `/api/numbers/hotspots?lat=${user!.lat}&lng=${user!.lng}&radius_km=30` : null);

  async function locate() {
    try {
      const result = await locateWithGps();
      toast(result.user.station ? `Nearest station: ${result.user.station.name}` : 'Location saved');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not get location', 'error');
    }
  }

  async function choose(station: Station) {
    if (station.id === user?.station?.id) return;
    setChoosing(station.id);
    try {
      setUser(await api<User>('/api/me/station', { method: 'PUT', body: { station_id: station.id } }));
      toast(`Reports will go to ${station.name}`);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not select station', 'error');
    } finally {
      setChoosing(null);
    }
  }

  if (!user) return null;
  const selected = user.station?.id;
  const reportCount = (hotspots ?? []).reduce((sum, h) => sum + h.count, 0);
  const nearest = stations?.[0]?.distance_km;

  return (
    <>
      <PageHeader
        title="Map"
        actions={
          <Button variant="secondary" onClick={locate} loading={saving === 'gps'}>
            <Crosshair className="h-4 w-4" />
            Use my location
          </Button>
        }
      />

      {!hasLocation ? (
        <Card className="py-10">
          <Empty
            icon={<MapPinned className="h-5 w-5" />}
            title="Share your location to see nearby police stations"
            action={
              <Button onClick={locate} loading={saving === 'gps'}>
                <Crosshair className="h-4 w-4" />
                Use my location
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="grid gap-6 lg:h-[calc(100vh-190px)] lg:min-h-150 lg:grid-cols-[1fr_380px]">
          <Card className="relative h-115 overflow-hidden lg:h-auto">
            <MapView
              home={{ lat: user.lat!, lng: user.lng! }}
              stations={stations ?? (user.station ? [user.station] : [])}
              selectedStationId={selected}
              hotspots={hotspots}
              onSelectStation={choose}
            />
            <div className="pointer-events-none absolute top-3 right-3 z-10 flex flex-wrap justify-end gap-2">
              <OverlayStat
                icon={
                  <IconTile size="sm" tone="accent">
                    <Shield />
                  </IconTile>
                }
                value={stations?.length ?? '–'}
                label="Stations nearby"
              />
              {nearest != null && (
                <OverlayStat
                  icon={
                    <IconTile size="sm">
                      <Navigation />
                    </IconTile>
                  }
                  value={`${nearest.toFixed(1)} km`}
                  label="Nearest"
                />
              )}
              <OverlayStat
                icon={
                  <IconTile size="sm" tone={reportCount ? 'danger' : 'neutral'}>
                    <ShieldAlert />
                  </IconTile>
                }
                value={reportCount}
                label="Spam reports"
              />
            </div>
            <Legend />
          </Card>

          <div className="flex min-h-0 flex-col gap-6">
            {user.station && <SelectedStation station={user.station} />}

            <Card className="flex min-h-0 flex-1 flex-col overflow-hidden">
              <div className="flex items-center gap-2.5 border-b border-line px-5 py-4">
                <h2 className="text-[15px] font-semibold tracking-tight text-ink">Nearby stations</h2>
                <span className="tabular rounded-full bg-subtle px-2 py-0.5 text-xs font-semibold text-ink-2">{stations?.length ?? 0}</span>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto">
                {isLoading && !stations ? (
                  <div className="space-y-2 p-4">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Skeleton key={i} className="h-16" />
                    ))}
                  </div>
                ) : !stations || stations.length === 0 ? (
                  <Empty icon={<MapPinned className="h-5 w-5" />} title="No police stations found within 30 km" />
                ) : (
                  <ul className="divide-y divide-line">
                    {stations.map((station, index) => {
                      const isSelected = station.id === selected;
                      return (
                        <li key={station.id}>
                          <button
                            type="button"
                            onClick={() => choose(station)}
                            disabled={choosing !== null}
                            className={cn('flex w-full items-center gap-3.5 px-5 py-3.5 text-left transition-colors', isSelected ? 'bg-accent-soft' : 'hover:bg-subtle')}
                          >
                            <span
                              className={cn(
                                'tabular flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-semibold',
                                isSelected ? 'bg-accent text-on-accent' : 'bg-subtle text-ink-2',
                              )}
                            >
                              {isSelected ? <Check className="h-4 w-4" /> : index + 1}
                            </span>
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-sm font-semibold text-ink">{station.name}</div>
                              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                                <span className="tabular text-xs text-ink-3">{station.distance_km?.toFixed(1)} km</span>
                                {station.phone && (
                                  <Badge className="h-5 px-1.5 text-[11px]">
                                    <Phone className="h-3 w-3" />
                                    Phone
                                  </Badge>
                                )}
                                {station.email && (
                                  <Badge tone="safe" className="h-5 px-1.5 text-[11px]">
                                    <Mail className="h-3 w-3" />
                                    Email
                                  </Badge>
                                )}
                              </div>
                            </div>
                            {choosing === station.id ? (
                              <span className="text-xs font-medium text-ink-3">Saving</span>
                            ) : isSelected ? (
                              <span className="text-xs font-semibold text-accent-ink">Selected</span>
                            ) : (
                              <span className="rounded-lg border border-line bg-surface px-2.5 py-1 text-xs font-semibold text-ink shadow-card">Use</span>
                            )}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </Card>
          </div>
        </div>
      )}
    </>
  );
}
