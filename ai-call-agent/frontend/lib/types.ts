export type Verdict = 'pending' | 'safe' | 'suspicious' | 'spam';
export type CallStatus = 'screening' | 'forwarding' | 'connected' | 'voicemail' | 'blocked' | 'missed' | 'ended';
export type ReportStatus = 'queued' | 'sent' | 'needs_email' | 'failed' | 'acknowledged';

export interface Station {
  id: number;
  name: string;
  lat: number;
  lng: number;
  address: string | null;
  phone: string | null;
  email: string | null;
  email_source: string | null;
  distance_km: number | null;
}

export interface User {
  id: number;
  name: string;
  email: string;
  role: 'user' | 'admin';
  phone: string | null;
  line_number: string | null;
  lat: number | null;
  lng: number | null;
  address: string | null;
  language: 'ask' | 'en' | 'hi';
  block_threshold: number;
  auto_report: boolean;
  police_delivery: 'test' | 'live';
  station: Station | null;
  created_at: string;
}

export interface Session {
  token: string;
  user: User;
}

export interface Call {
  id: number;
  channel: 'phone' | 'browser';
  caller_number: string;
  caller_name: string | null;
  status: CallStatus;
  language: string;
  verdict: Verdict;
  risk_score: number;
  category: string | null;
  reasons: string[];
  turns_count: number;
  started_at: string;
  ended_at: string | null;
  duration: number | null;
  has_recording: boolean;
}

export interface Turn {
  id: number;
  speaker: 'assistant' | 'caller';
  text: string;
  text_en: string | null;
  confidence: number | null;
  created_at: string;
}

export interface ReportBrief {
  id: number;
  reference: string;
  status: ReportStatus;
  mode: 'test' | 'live';
  station_name: string | null;
  sent_to: string | null;
  acknowledged_at: string | null;
  created_at: string;
}

export interface CallDetail extends Call {
  signals: {
    model_score?: number | null;
    rule_score?: number;
    reputation_score?: number;
    reputation_reports?: number;
    matched_rules?: string[];
  };
  turns: Turn[];
  report: ReportBrief | null;
  rule: 'allow' | 'block' | null;
  number_reports: number;
}

export interface CallPage {
  items: Call[];
  total: number;
}

export interface Report {
  id: number;
  reference: string;
  source: 'auto' | 'user' | 'manual';
  call_id: number | null;
  caller_number: string;
  category: string;
  summary: string;
  risk_score: number | null;
  lat: number | null;
  lng: number | null;
  address: string | null;
  station_name: string | null;
  station_lat: number | null;
  station_lng: number | null;
  station_phone: string | null;
  station_email: string | null;
  station_address: string | null;
  distance_km: number | null;
  status: ReportStatus;
  mode: 'test' | 'live';
  sent_to: string | null;
  sent_at: string | null;
  error: string | null;
  acknowledged_at: string | null;
  ack_by: string | null;
  ack_note: string | null;
  created_at: string;
  public_url: string | null;
}

export interface NumberLookup {
  number: string;
  reports: number;
  category: string | null;
  risk: number;
  level: 'unknown' | 'reported' | 'dangerous';
  last_reported_at: string | null;
  rule: 'allow' | 'block' | null;
}

export interface SpamNumber {
  number: string;
  category: string;
  reports: number;
  source: string;
  last_reported_at: string;
}

export interface NumberRule {
  id: number;
  number: string;
  kind: 'allow' | 'block';
  created_at: string;
}

export interface Hotspot {
  lat: number;
  lng: number;
  count: number;
  category: string;
}

export interface ManualReportResult {
  number: string;
  counted: boolean;
  report: Report | null;
  duplicate_report: boolean;
}

export interface Stats {
  screened: number;
  blocked: number;
  safe: number;
  connected: number;
  suspicious: number;
  reports_sent: number;
  reports_acknowledged: number;
  last_7_days: { date: string; total: number; spam: number }[];
  top_categories: { category: string; count: number }[];
}

export interface SystemStatus {
  public_url: string | null;
  public_url_source: string | null;
  twilio_configured: boolean;
  twilio_number: string | null;
  twilio_sync: {
    ok: boolean;
    at?: string;
    base_url?: string | null;
    number_configured?: boolean;
    browser_calling?: boolean;
    error?: string | null;
  } | null;
  smtp_configured: boolean;
  smtp_sender: string | null;
  live_delivery_allowed: boolean;
  fallback_police_email: boolean;
  model_loaded: boolean;
  model_error: string | null;
  translator: string;
  line_owner_is_you: boolean;
  line_claimed: boolean;
}

export interface AdminOverview {
  users: number;
  admins: number;
  calls: number;
  scams_blocked: number;
  reports_sent: number;
  reports_acknowledged: number;
  reported_numbers: number;
  last_7_days: { date: string; total: number; spam: number }[];
}

export interface AdminUserRow {
  id: number;
  name: string;
  email: string;
  role: 'user' | 'admin';
  phone: string | null;
  address: string | null;
  calls: number;
  scams: number;
  reports: number;
  created_at: string;
}

export interface AdminReportRow extends Report {
  user_name: string;
  user_email: string;
}

export interface LiveTurn {
  call_id: number;
  speaker: 'assistant' | 'caller';
  text: string;
  text_en: string | null;
  created_at: string;
}
