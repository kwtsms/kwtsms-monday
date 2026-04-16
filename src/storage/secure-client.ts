// Single shared SecureStorage client. Both the key-value store (storage/index)
// and the secret store use this module. Keeping one instance means one auth
// flow per Cloud Run instance instead of one per store.
//
// We also expose warmUp() so the Express boot sequence can pay the GCP
// identity handshake up front (typically 1-3 seconds). Without warm-up the
// first user request triggers auth and frequently exceeds monday's proxy
// timeout, returning 503 to the UI.
//
// Lazy require keeps the heavy SDK (and its Google Cloud deps) out of local
// dev boot when K_SERVICE is unset.
export type SecureStorageLike = {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T): Promise<boolean>;
  delete(key: string): Promise<boolean>;
};

let _raw: SecureStorageLike | null = null;
let _instance: SecureStorageLike | null = null;
// Serialize the very first call so concurrent cold-start requests share a
// single authentication handshake instead of each triggering their own.
let _authInFlight: Promise<void> | null = null;

function raw(): SecureStorageLike {
  if (!_raw) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { SecureStorage } = require('@mondaycom/apps-sdk');
    _raw = new SecureStorage() as SecureStorageLike;
  }
  return _raw;
}

async function ensureReady(): Promise<void> {
  if (!process.env.K_SERVICE) return;
  if (!_authInFlight) {
    _authInFlight = (async () => {
      try { await raw().get('__warmup__'); } catch { /* ignore, surface later */ }
    })();
  }
  await _authInFlight;
}

// Retry transient SecureStorage failures (auth blips, network resets) before
// bubbling the error up to the route handler. 3 attempts total, short backoff.
async function withRetry<T>(op: () => Promise<T>): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await op();
    } catch (e) {
      lastErr = e;
      // Force a fresh re-auth on next call by resetting the in-flight guard.
      _authInFlight = null;
      if (attempt < 2) {
        await new Promise((r) => setTimeout(r, [300, 900][attempt]));
      }
    }
  }
  throw lastErr;
}

export function getSecureStorage(): SecureStorageLike {
  if (!_instance) {
    _instance = {
      async get<T>(key: string) {
        await ensureReady();
        return withRetry(() => raw().get<T>(key));
      },
      async set<T>(key: string, value: T) {
        await ensureReady();
        return withRetry(() => raw().set<T>(key, value));
      },
      async delete(key: string) {
        await ensureReady();
        return withRetry(() => raw().delete(key));
      },
    };
  }
  return _instance;
}

// Fire a benign get() so the SDK performs the GCP identity handshake before
// the first user request. We don't care about the value - we swallow errors
// and let real requests surface any persistent problem.
export async function warmUp(): Promise<void> {
  if (!process.env.K_SERVICE) return;
  // Reset the in-flight guard so the keep-alive cycle forces a fresh auth
  // handshake each time, not reuse a stale cached token.
  _authInFlight = null;
  try {
    await getSecureStorage().get('__warmup__');
  } catch {
    /* swallow; real requests will surface errors */
  }
}

// SecureStorage's internal auth token TTL is 3 minutes. After idle time the
// token expires and the next user request triggers a full re-auth (GCP
// identity handshake + Vault login, multi-second). That routinely exceeds
// monday's proxy timeout and surfaces as 503. Poll a harmless get() every
// 2 minutes so the token is always warm and never crosses the TTL threshold
// mid-request. No-op locally where USE_MEMORY is true.
let _keepAliveTimer: NodeJS.Timeout | null = null;
export function startTokenKeepAlive(): void {
  if (!process.env.K_SERVICE) return;
  if (_keepAliveTimer) return;
  _keepAliveTimer = setInterval(() => {
    void warmUp();
  }, 2 * 60 * 1000);
  // setInterval holds the event loop; don't block clean shutdown.
  if (typeof (_keepAliveTimer as NodeJS.Timeout).unref === 'function') {
    (_keepAliveTimer as NodeJS.Timeout).unref();
  }
}
