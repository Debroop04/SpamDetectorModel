'use client';

import dynamic from 'next/dynamic';
import { Skeleton } from '@/components/ui/feedback';
import type { MapViewProps } from './leaflet-map';

/** Leaflet needs the browser, so the map is loaded on the client only. */
export const MapView = dynamic<MapViewProps>(() => import('./leaflet-map'), {
  ssr: false,
  loading: () => <Skeleton className="h-full w-full rounded-none" />,
});
