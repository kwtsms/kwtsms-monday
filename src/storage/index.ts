// Key-value storage for the app. In monday-code we route everything through
// the SDK's SecureStorage - it authenticates via GCP workload identity so no
// per-request JWT has to be threaded through the call graph. The plain
// Storage class needs the session JWT as an access token and the token we get
// from monday.get('sessionToken') is not accepted by the apps-storage
// backend, so SecureStorage is the one reliable persistence layer we have.
//
// The SDK is detected via K_SERVICE (same check the SDK uses internally in
// isLocalEnvironment). Outside monday-code we keep an in-memory Map so local
// dev and tests don't load the heavy Google Cloud deps.
import { getSecureStorage } from './secure-client';

const USE_MEMORY = !process.env.K_SERVICE;
const memory: Map<string, unknown> = new Map();

function memGet<T>(key: string): T | null {
  const v = memory.get(key);
  return v !== undefined ? (v as T) : null;
}

function memSet(key: string, value: unknown, ttlSec?: number): void {
  memory.set(key, value);
  if (ttlSec && ttlSec > 0) {
    setTimeout(() => {
      memory.delete(key);
    }, ttlSec * 1000);
  }
}

function memDelete(key: string): void {
  memory.delete(key);
}

export async function kvGet<T>(key: string): Promise<T | null> {
  if (USE_MEMORY) return memGet<T>(key);
  const r = await getSecureStorage().get<T>(key);
  return r ?? null;
}

export async function kvSet(key: string, value: unknown, _ttlSec?: number): Promise<void> {
  if (USE_MEMORY) { memSet(key, value, _ttlSec); return; }
  // SecureStorage has no TTL. Caller-supplied ttlSec is ignored in production.
  await getSecureStorage().set(key, value as any);
}

export async function kvDelete(key: string): Promise<void> {
  if (USE_MEMORY) { memDelete(key); return; }
  await getSecureStorage().delete(key);
}

export async function kvList(prefix: string): Promise<string[]> {
  const idx = (await kvGet<string[]>(`${prefix}:__index`)) ?? [];
  return idx.map((id) => `${prefix}:${id}`);
}

export async function kvIndexAdd(prefix: string, id: string): Promise<void> {
  const idx = (await kvGet<string[]>(`${prefix}:__index`)) ?? [];
  if (!idx.includes(id)) {
    idx.push(id);
    await kvSet(`${prefix}:__index`, idx);
  }
}

export async function kvIndexRemove(prefix: string, id: string): Promise<void> {
  const idx = (await kvGet<string[]>(`${prefix}:__index`)) ?? [];
  const next = idx.filter((x) => x !== id);
  await kvSet(`${prefix}:__index`, next);
}
