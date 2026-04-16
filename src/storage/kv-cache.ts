// Tiny per-instance memory cache in front of SecureStorage. monday-code
// doesn't offer a managed Redis layer, so we cache reads that happen many
// times per minute (config, templates list, logs list) to take SecureStorage
// out of the hot path. Writes invalidate; TTLs are short so stale data is
// naturally bounded.
//
// Cache is module-local: it lives as long as the Cloud Run instance. Cold
// starts re-populate on first hit. Across instances, each has its own cache
// (acceptable since users stick to one instance during a session and writes
// invalidate locally - mild staleness risk across instances during a burst
// is outweighed by the latency win).

interface Entry<T> { value: T; expiresAt: number }

const store = new Map<string, Entry<unknown>>();

export function cacheGet<T>(key: string): T | undefined {
  const e = store.get(key);
  if (!e) return undefined;
  if (e.expiresAt <= Date.now()) {
    store.delete(key);
    return undefined;
  }
  return e.value as T;
}

export function cacheSet<T>(key: string, value: T, ttlSec: number): void {
  store.set(key, { value, expiresAt: Date.now() + ttlSec * 1000 });
}

export function cacheDelete(key: string): void {
  store.delete(key);
}

export function cacheInvalidatePrefix(prefix: string): void {
  for (const k of store.keys()) {
    if (k.startsWith(prefix)) store.delete(k);
  }
}
