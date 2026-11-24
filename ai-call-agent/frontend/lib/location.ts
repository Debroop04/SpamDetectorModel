'use client';

import { useCallback, useState } from 'react';
import { mutate } from 'swr';
import { api } from './api';
import { useAuth } from './auth';
import type { Station, User } from './types';

interface LocationResult {
  user: User;
  stations: Station[];
}

function currentPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('This browser cannot share location'));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, (error) => {
      reject(new Error(error.code === error.PERMISSION_DENIED ? 'Location permission was denied' : 'Could not get your location'));
    }, { enableHighAccuracy: true, timeout: 15000 });
  });
}

/** Saves a location, which also finds and selects the nearest police station on the server. */
export function useSaveLocation() {
  const { setUser } = useAuth();
  const [saving, setSaving] = useState<'gps' | 'pick' | null>(null);

  const save = useCallback(
    async (lat: number, lng: number, source: 'gps' | 'pick' = 'pick') => {
      setSaving(source);
      try {
        const result = await api<LocationResult>('/api/me/location', { method: 'PUT', body: { lat, lng } });
        setUser(result.user);
        mutate('/api/stations/nearby', result.stations, { revalidate: false });
        mutate((key) => typeof key === 'string' && key.startsWith('/api/numbers/hotspots'));
        return result;
      } finally {
        setSaving(null);
      }
    },
    [setUser],
  );

  const locateWithGps = useCallback(async () => {
    setSaving('gps');
    try {
      const position = await currentPosition();
      return await save(position.coords.latitude, position.coords.longitude, 'gps');
    } finally {
      setSaving(null);
    }
  }, [save]);

  return { save, locateWithGps, saving };
}
