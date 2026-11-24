import type { SystemStatus, User } from './types';

export interface SetupStep {
  key: string;
  label: string;
  done: boolean;
  href: string;
}

export function setupSteps(user: User, system: SystemStatus | undefined): SetupStep[] {
  return [
    { key: 'phone', label: 'Add your phone number', done: Boolean(user.phone), href: '/settings' },
    { key: 'location', label: 'Set your location', done: user.lat !== null, href: '/settings?tab=location' },
    { key: 'station', label: 'Choose your police station', done: Boolean(user.station), href: '/settings?tab=location' },
    { key: 'twilio', label: 'Connect Twilio', done: Boolean(system?.twilio_sync?.ok), href: '/settings?tab=system' },
    { key: 'line', label: 'Activate your protection line', done: Boolean(user.line_number), href: '/settings?tab=line' },
    { key: 'email', label: 'Enable report emails', done: Boolean(system?.smtp_configured), href: '/settings?tab=system' },
  ];
}
