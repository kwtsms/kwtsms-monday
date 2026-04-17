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
const RETRY_DELAYS_MS = [1000, 2000, 4000, 8000]; // up to ~15s total
const TRANSIENT_STATUSES = new Set([502, 503, 504]);

function isSafeToRetry(method: string | undefined): boolean {
  const m = (method ?? 'GET').toUpperCase();
  return m === 'GET' || m === 'HEAD';
}

export class ApiError extends Error {
  status: number;
  path: string;
  method: string;
  attempts: number;
  serverMessage?: string;
  timestamp: string;
  constructor(init: {
    status: number;
    path: string;
    method: string;
    attempts: number;
    serverMessage?: string;
  }) {
    const msg = `HTTP ${init.status} on ${init.method} ${init.path} after ${init.attempts} attempt${init.attempts === 1 ? '' : 's'}${init.serverMessage ? ' : ' + init.serverMessage : ''}`;
    super(msg);
    this.name = 'ApiError';
    this.status = init.status;
    this.path = init.path;
    this.method = init.method;
    this.attempts = init.attempts;
    this.serverMessage = init.serverMessage;
    this.timestamp = new Date().toISOString();
  }
}

async function rawApi<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = { ...(await authHeader()), ...(init.headers as Record<string, string> | undefined) };
  const method = (init.method ?? 'GET').toUpperCase();
  const canRetry = isSafeToRetry(init.method);
  const attempts = canRetry ? RETRY_DELAYS_MS.length + 1 : 1;
  for (let attempt = 0; attempt < attempts; attempt++) {
    const r = await fetch(path, { ...init, headers });
    if (r.ok) return r.json() as Promise<T>;
    if (!canRetry || !TRANSIENT_STATUSES.has(r.status) || attempt === attempts - 1) {
      let serverMessage: string | undefined;
      try {
        const txt = await r.text();
        serverMessage = txt && txt.length < 400 ? txt : undefined;
      } catch { /* ignore */ }
      throw new ApiError({
        status: r.status, path, method, attempts: attempt + 1, serverMessage,
      });
    }
    await new Promise((res) => setTimeout(res, RETRY_DELAYS_MS[attempt]));
  }
  throw new Error('unreachable');
}

// Shared prewarm promise. The first api() call creates it; every other call
// awaits it before firing. This serialises the cold-start so logs / templates
// / settings don't race a cold Cloud Run instance. On failure the promise is
// cleared so the next call re-tries.
let _prewarmPromise: Promise<void> | null = null;
function ensurePrewarmed(): Promise<void> {
  if (!_prewarmPromise) {
    _prewarmPromise = rawApi<{ ok: boolean }>('/api/prewarm')
      .then(() => {})
      .catch(() => { _prewarmPromise = null; });
  }
  return _prewarmPromise;
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (path !== '/api/prewarm') await ensurePrewarmed();
  return rawApi<T>(path, init);
}

export async function prewarm(): Promise<void> {
  await ensurePrewarmed();
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
