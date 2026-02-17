'use client';

import { getFirebaseAuth } from '@/lib/firebase';

const DEFAULT_API_PORT = 8010;
// Keep the API base deterministic in local dev.
// A fallback port can accidentally hit a different service and cause confusing auth errors.
const FALLBACK_API_PORT = DEFAULT_API_PORT;

let cachedApiBaseUrl: string | null = null;

function normalizeLoopbackBaseUrl(url: string): string {
  if (!url) return url;
  if (typeof window === 'undefined') return url;
  try {
    const parsed = new URL(url);
    const host = (parsed.hostname || '').toLowerCase();
    // On Windows, `localhost` frequently resolves to IPv6 (::1) first.
    // If the backend is only bound to IPv4, fetch() will fail with "Failed to fetch".
    if (host === 'localhost' || host === '::1' || host === '[::1]') {
      parsed.hostname = '127.0.0.1';
      return parsed.toString().replace(/\/$/, '');
    }
    return url.replace(/\/$/, '');
  } catch {
    return url.replace(/\/$/, '');
  }
}

function computeDefaultApiBaseUrl(port: number): string {
  if (typeof window === 'undefined') {
    return `http://localhost:${port}`;
  }
  const protocol = window.location.protocol || 'http:';
  const rawHostname = window.location.hostname || 'localhost';

  // On many Windows setups, browsers resolve `localhost` to IPv6 (::1) first.
  // If the backend is only bound to IPv4 (127.0.0.1), fetch() will fail with
  // a generic "Failed to fetch". Force IPv4 loopback in this case.
  const hostname = rawHostname === 'localhost' || rawHostname === '::1' ? '127.0.0.1' : rawHostname;

  return `${protocol}//${hostname}:${port}`;
}

export function getApiBaseUrl(): string {
  const configured = process.env.NEXT_PUBLIC_API_URL;
  if (configured) return normalizeLoopbackBaseUrl(configured);
  return cachedApiBaseUrl || computeDefaultApiBaseUrl(DEFAULT_API_PORT);
}

async function getFirebaseIdToken(): Promise<string | null> {
  try {
    const auth = getFirebaseAuth();
    const user = auth.currentUser;
    if (!user) return null;
    return await user.getIdToken();
  } catch {
    return null;
  }
}

export async function apiFetch<T>(
  path: string,
  init?: RequestInit,
  token?: string | null
): Promise<T> {
  const baseUrl = getApiBaseUrl();
  const isAbsolute = path.startsWith('http');
  const url = isAbsolute ? path : `${baseUrl}${path}`;

  const headers = new Headers(init?.headers);
  if (!headers.has('content-type') && init?.body && typeof init.body === 'string') {
    headers.set('content-type', 'application/json');
  }

  const authToken = token === undefined ? await getFirebaseIdToken() : token;
  if (authToken && typeof authToken === 'string') {
    headers.set('authorization', `Bearer ${authToken}`);
  }

  const shouldRetryOnNetworkError = !process.env.NEXT_PUBLIC_API_URL && !isAbsolute;

  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      headers,
    });
  } catch (e) {
    // In local dev, the backend port can vary (8000 vs 8001). If we hit a network
    // error and the user didn't explicitly set NEXT_PUBLIC_API_URL, retry once.
    if (shouldRetryOnNetworkError) {
      const fallbackBaseUrl = computeDefaultApiBaseUrl(FALLBACK_API_PORT);
      const retryUrl = `${fallbackBaseUrl}${path}`;
      res = await fetch(retryUrl, { ...init, headers });
      cachedApiBaseUrl = fallbackBaseUrl;
    } else {
      throw e;
    }
  }

  // If the request succeeded, cache the base URL we used (for future calls).
  if (!isAbsolute && res.ok) {
    // When requests succeed, lock onto the working base URL (helps mobile/LAN usage).
    if (url.includes(`${path}`)) {
      const inferredBase = url.slice(0, url.length - path.length);
      cachedApiBaseUrl = inferredBase;
    }
  }

  const contentType = res.headers.get('content-type') || '';
  const isJson = contentType.includes('application/json');

  if (!res.ok) {
    const body: any = isJson ? await res.json().catch(() => ({})) : await res.text().catch(() => '');
    const rawMessage = body?.detail || body?.error || body?.message || `Request failed (${res.status})`;

    const toMessageString = (value: unknown): string => {
      if (typeof value === 'string') return value;
      if (Array.isArray(value)) {
        // FastAPI validation errors often come as an array of { loc, msg, type }.
        const parts = value
          .map((item: any) => {
            const loc = Array.isArray(item?.loc) ? item.loc.join('.') : item?.loc;
            const msg = item?.msg ?? item?.message ?? item;
            if (loc && msg) return `${loc}: ${String(msg)}`;
            return typeof msg === 'string' ? msg : String(msg);
          })
          .filter(Boolean);
        if (parts.length) return parts.join('\n');
      }
      if (value && typeof value === 'object') {
        try {
          return JSON.stringify(value);
        } catch {
          return String(value);
        }
      }
      return String(value);
    };

    throw new Error(toMessageString(rawMessage));
  }

  if (res.status === 204) {
    return undefined as T;
  }

  return (isJson ? await res.json() : await res.text()) as T;
}
