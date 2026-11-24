import type { CallStatus, ReportStatus, Verdict } from './types';

export function formatPhone(number: string | null | undefined): string {
  if (!number) return 'Unknown';
  if (number.startsWith('+91') && number.length === 13) {
    return `+91 ${number.slice(3, 8)} ${number.slice(8)}`;
  }
  if (number.startsWith('+1') && number.length === 12) {
    return `+1 ${number.slice(2, 5)} ${number.slice(5, 8)} ${number.slice(8)}`;
  }
  return number;
}

export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return '';
  const seconds = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 45) return 'Just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days} d ago`;
  return formatDate(iso);
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '';
  return new Date(iso).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function formatTime(iso: string | null | undefined): string {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
}

export function formatDuration(seconds: number | null | undefined): string {
  if (!seconds) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function percent(value: number | null | undefined): string {
  return `${Math.round((value || 0) * 100)}%`;
}

export const verdictLabel: Record<Verdict, string> = {
  pending: 'Screening',
  safe: 'Safe',
  suspicious: 'Suspicious',
  spam: 'Scam',
};

export const verdictTone: Record<Verdict, Tone> = {
  pending: 'neutral',
  safe: 'safe',
  suspicious: 'warn',
  spam: 'danger',
};

export const statusLabel: Record<CallStatus, string> = {
  screening: 'Screening',
  forwarding: 'Ringing you',
  connected: 'Connected',
  voicemail: 'Voicemail',
  blocked: 'Blocked',
  missed: 'Missed',
  ended: 'Caller hung up',
};

export const reportStatusLabel: Record<ReportStatus, string> = {
  queued: 'Sending',
  sent: 'Sent',
  needs_email: 'Needs email',
  failed: 'Failed',
  acknowledged: 'Acknowledged',
};

export const reportStatusTone: Record<ReportStatus, Tone> = {
  queued: 'neutral',
  sent: 'accent',
  needs_email: 'warn',
  failed: 'danger',
  acknowledged: 'safe',
};

export type Tone = 'neutral' | 'accent' | 'safe' | 'warn' | 'danger';

export function riskTone(score: number): Tone {
  if (score >= 0.75) return 'danger';
  if (score >= 0.45) return 'warn';
  return 'safe';
}

export const FRAUD_CATEGORIES = [
  'Bank or KYC fraud',
  'OTP or PIN theft',
  'Fake police or legal threat',
  'Lottery or prize scam',
  'Payment or fee demand',
  'Remote access request',
  'Utility disconnection threat',
  'Investment or job scam',
  'Telemarketing',
  'Other scam',
];
