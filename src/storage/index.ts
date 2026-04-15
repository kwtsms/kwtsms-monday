// In-memory fallback for local dev and integration tests.
// When MONDAY_STORAGE_TOKEN is absent (i.e., not running inside monday code),
// all kv operations use a plain Map instead of the @mondaycom/apps-sdk Storage.
// Production deployments always have the token injected by the runtime, so the
// real Storage is used there. TTL in memory mode is honoured via setTimeout.

import { Storage } from '@mondaycom/apps-sdk';

const USE_MEMORY = !process.env.MONDAY_STORAGE_TOKEN;
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

let _storage: Storage | null = null;
function getStorage(): Storage {
  if (!_storage) _storage = new Storage(process.env.MONDAY_STORAGE_TOKEN ?? '');
  return _storage;
}

export async function kvGet<T>(key: string): Promise<T | null> {
  if (USE_MEMORY) return memGet<T>(key);
  const r = await getStorage().get(key);
  return (r?.value as T) ?? null;
}

export async function kvSet(key: string, value: unknown, ttlSec?: number): Promise<void> {
  if (USE_MEMORY) { memSet(key, value, ttlSec); return; }
  await getStorage().set(key, value as any, ttlSec ? { ttl: ttlSec } : undefined);
}

export async function kvDelete(key: string): Promise<void> {
  if (USE_MEMORY) { memDelete(key); return; }
  await getStorage().delete(key);
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
