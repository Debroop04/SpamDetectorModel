'use client';

import 'leaflet/dist/leaflet.css';
import { useEffect, useMemo } from 'react';
import L from 'leaflet';
import { Circle, MapContainer, Marker, Polyline, TileLayer, Tooltip, useMap, useMapEvents } from 'react-leaflet';
import { useTheme } from '@/lib/theme';
import type { Hotspot, Station } from '@/lib/types';

export interface MapViewProps {
  home?: { lat: number; lng: number } | null;
  stations?: Station[];
  selectedStationId?: number | null;
  hotspots?: Hotspot[];
  line?: [[number, number], [number, number]] | null;
  onPick?: (lat: number, lng: number) => void;
  onSelectStation?: (station: Station) => void;
  className?: string;
  zoom?: number;
  interactive?: boolean;
}

const homeIcon = L.divIcon({
  className: '',
  iconSize: [22, 22],
  iconAnchor: [11, 11],
  html: '<div style="width:22px;height:22px;border-radius:9999px;background:var(--c-accent);border:3px solid var(--c-surface);box-shadow:0 0 0 1px var(--c-line-strong)"></div>',
});

function stationIcon(selected: boolean) {
  const size = selected ? 34 : 28;
  const bg = selected ? 'var(--c-ink)' : 'var(--c-surface)';
  const fg = selected ? 'var(--c-surface)' : 'var(--c-ink)';
  return L.divIcon({
    className: '',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    html: `<div style="width:${size}px;height:${size}px;border-radius:9px;background:${bg};border:1.5px solid ${selected ? 'var(--c-surface)' : 'var(--c-line-strong)'};display:grid;place-items:center;box-shadow:0 2px 6px rgba(0,0,0,.18)"><svg width="${selected ? 17 : 14}" height="${selected ? 17 : 14}" viewBox="0 0 24 24" fill="none" stroke="${fg}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg></div>`,
  });
}

function FitBounds({ points }: { points: [number, number][] }) {
  const map = useMap();
  const key = points.map((p) => p.join(',')).join('|');
  useEffect(() => {
    if (points.length === 0) return;
    if (points.length === 1) {
      map.setView(points[0], Math.max(map.getZoom(), 14));
    } else {
      map.fitBounds(L.latLngBounds(points), { padding: [48, 48], maxZoom: 15 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, map]);
  return null;
}

function ClickToPick({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({ click: (event) => onPick(event.latlng.lat, event.latlng.lng) });
  return null;
}

export default function LeafletMap({
  home,
  stations = [],
  selectedStationId,
  hotspots = [],
  line,
  onPick,
  onSelectStation,
  className,
  zoom = 13,
  interactive = true,
}: MapViewProps) {
  const { theme } = useTheme();
  const colors = useMemo(() => {
    const styles = typeof window !== 'undefined' ? getComputedStyle(document.documentElement) : null;
    const read = (name: string, fallback: string) => styles?.getPropertyValue(name).trim() || fallback;
    return { danger: read('--c-danger', '#e5383b'), accent: read('--c-accent', '#0a6fdb') };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme]);
  const center: [number, number] = home ? [home.lat, home.lng] : [22.9734, 78.6569];

  const fitPoints = useMemo(() => {
    const points: [number, number][] = [];
    if (home) points.push([home.lat, home.lng]);
    if (line) points.push(line[1]);
    else {
      const selected = stations.find((s) => s.id === selectedStationId);
      if (selected) points.push([selected.lat, selected.lng]);
    }
    return points;
  }, [home, line, stations, selectedStationId]);

  // Free Esri canvas basemaps (no API key): a muted base layer plus a separate label layer.
  const shade = theme === 'dark' ? 'Dark' : 'Light';
  const baseTiles = `https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_${shade}_Gray_Base/MapServer/tile/{z}/{y}/{x}`;
  const labelTiles = `https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_${shade}_Gray_Reference/MapServer/tile/{z}/{y}/{x}`;

  return (
    <MapContainer
      center={center}
      zoom={home ? zoom : 5}
      scrollWheelZoom={interactive}
      dragging={interactive}
      zoomControl={interactive}
      doubleClickZoom={interactive}
      className={className}
      style={{ height: '100%', width: '100%' }}
    >
      <TileLayer
        key={`base-${theme}`}
        url={baseTiles}
        maxNativeZoom={16}
        maxZoom={19}
        attribution='Tiles &copy; Esri &mdash; Esri, HERE, Garmin, &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      />
      <TileLayer key={`labels-${theme}`} url={labelTiles} maxNativeZoom={16} maxZoom={19} />
      <FitBounds points={fitPoints} />
      {onPick && <ClickToPick onPick={onPick} />}

      {hotspots.map((spot) => (
        <Circle
          key={`${spot.lat},${spot.lng}`}
          center={[spot.lat, spot.lng]}
          radius={250 + Math.min(spot.count, 20) * 60}
          pathOptions={{ color: colors.danger, weight: 1.5, fillColor: colors.danger, fillOpacity: 0.14 }}
        >
          <Tooltip direction="top">
            {spot.count} spam report{spot.count === 1 ? '' : 's'} · {spot.category}
          </Tooltip>
        </Circle>
      ))}

      {line && <Polyline key={colors.accent} positions={line} pathOptions={{ color: colors.accent, weight: 2.5, dashArray: '6 8' }} />}

      {stations.map((station) => (
        <Marker
          key={station.id}
          position={[station.lat, station.lng]}
          icon={stationIcon(station.id === selectedStationId)}
          zIndexOffset={station.id === selectedStationId ? 1000 : 0}
          eventHandlers={onSelectStation ? { click: () => onSelectStation(station) } : undefined}
        >
          <Tooltip direction="top" offset={[0, -14]}>
            {station.name}
            {station.distance_km != null ? ` · ${station.distance_km.toFixed(1)} km` : ''}
          </Tooltip>
        </Marker>
      ))}

      {home && (
        <Marker position={[home.lat, home.lng]} icon={homeIcon} zIndexOffset={2000}>
          <Tooltip direction="top" offset={[0, -10]}>
            Your location
          </Tooltip>
        </Marker>
      )}
    </MapContainer>
  );
}
