const CONFIGURED_API = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000').replace(/\/$/, '');

/**
 * When the site is opened from another device on the Wi-Fi (for example a phone at http://10.0.0.5:3000),
 * "localhost" would point at that device, so the API is reached on the same host instead.
 */
function resolveApiUrl(): string {
  if (typeof window === 'undefined') return CONFIGURED_API;
  try {
    const configured = new URL(CONFIGURED_API);
    const page = window.location;
    const local = ['localhost', '127.0.0.1'];
    if (local.includes(configured.hostname) && !local.includes(page.hostname)) {
      return `${page.protocol}//${page.hostname}:${configured.port || '8000'}`;
    }
  } catch {
    // fall through to the configured address
  }
  return CONFIGURED_API;
}

export const API_URL = resolveApiUrl();

const TOKEN_KEY = 'callshield.token';

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null) {
  if (typeof window === 'undefined') return;
  if (token) window.localStorage.setItem(TOKEN_KEY, token);
  else window.localStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

type Body = Record<string, unknown> | unknown[] | undefined;

function errorMessage(data: unknown, fallback: string): string {
  if (data && typeof data === 'object' && 'detail' in data) {
    const detail = (data as { detail: unknown }).detail;
    if (typeof detail === 'string') return detail;
    if (Array.isArray(detail) && detail[0]?.msg) {
      const first = detail[0] as { msg: string; loc?: string[] };
      const field = first.loc?.[first.loc.length - 1];
      return field ? `${String(field).replace(/_/g, ' ')}: ${first.msg}` : first.msg;
    }
  }
  return fallback;
}

export async function api<T>(path: string, options: { method?: string; body?: Body } = {}): Promise<T> {
  const headers: Record<string, string> = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';

  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method: options.method || 'GET',
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
  } catch {
    throw new ApiError(0, 'Cannot reach the server. Make sure the backend is running.');
  }

  if (response.status === 204) return undefined as T;
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    if (response.status === 401 && token && typeof window !== 'undefined') {
      window.dispatchEvent(new Event('callshield:unauthorized'));
    }
    throw new ApiError(response.status, errorMessage(data, `Request failed (${response.status})`));
  }
  return data as T;
}

export const fetcher = <T,>(path: string) => api<T>(path);

/** URL with the token in the query string, for links, <audio> and EventSource. */
export function authedUrl(path: string): string {
  const token = getToken();
  const separator = path.includes('?') ? '&' : '?';
  return `${API_URL}${path}${token ? `${separator}token=${encodeURIComponent(token)}` : ''}`;
}
