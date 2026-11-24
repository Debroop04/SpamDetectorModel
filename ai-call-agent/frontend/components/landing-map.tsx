'use client';

import { MapView } from '@/components/map';

const HOME = { lat: 28.6315, lng: 77.2167 };
const STATION = {
  id: 1,
  name: 'Police Station Connaught Place',
  lat: 28.6295,
  lng: 77.2208,
  address: null,
  phone: null,
  email: null,
  email_source: null,
  distance_km: 0.4,
};

/** Static example map for the home page. */
export function LandingMap() {
  return (
    <MapView
      home={HOME}
      stations={[STATION]}
      selectedStationId={1}
      line={[
        [HOME.lat, HOME.lng],
        [STATION.lat, STATION.lng],
      ]}
      interactive={false}
    />
  );
}
