import mondaySdk from 'monday-sdk-js';

export const monday = mondaySdk();

async function authHeader(): Promise<Record<string, string>> {
  const token = (await monday.get('sessionToken')).data as string;
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

// Cold-start 502/503/504 retry - ONLY for idempotent GET requests. POSTs
// (send, connect, reload, template CUD) are NOT retried because retrying a
// successful server-side side-effect that merely timed out at monday's
// proxy can duplicate the action (e.g. double-fire an SMS).
const RETRY_DELAYS_MS = [1000, 3000, 6000];
const TRANSIENT_STATUSES = new Set([502, 503, 504]);

function isSafeToRetry(method: string | undefined): boolean {
  const m = (method ?? 'GET').toUpperCase();
  return m === 'GET' || m === 'HEAD';
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = { ...(await authHeader()), ...(init.headers as Record<string, string> | undefined) };
  const canRetry = isSafeToRetry(init.method);
  const attempts = canRetry ? RETRY_DELAYS_MS.length + 1 : 1;
  for (let attempt = 0; attempt < attempts; attempt++) {
    const r = await fetch(path, { ...init, headers });
    if (r.ok) return r.json() as Promise<T>;
    if (!canRetry || !TRANSIENT_STATUSES.has(r.status) || attempt === attempts - 1) {
      throw new Error(`HTTP ${r.status}`);
    }
    await new Promise((res) => setTimeout(res, RETRY_DELAYS_MS[attempt]));
  }
  throw new Error('unreachable');
}

// Warm the serving Cloud Run instance before a non-idempotent POST. The GET
// can safely retry on 503 until it lands on a warm instance, so by the time
// this resolves the SDK auth handshake is already paid. Swallows failures -
// the POST will surface them via its own error path.
export async function prewarm(): Promise<void> {
  try {
    await api<{ ok: boolean }>('/api/prewarm');
  } catch {
    /* ignore; the real request will surface any persistent issue */
  }
}

export async function isViewOnly(): Promise<boolean> {
  try {
    const ctx = await monday.get('context');
    return !!(ctx?.data?.user?.isViewOnly);
  } catch {
    return false;
  }
}

export function reportValueCreated(): void {
  try {
    monday.execute('valueCreatedForUser');
  } catch {
    /* non-critical */
  }
}
