import { Storage } from '@mondaycom/apps-sdk';

const storage = new Storage(process.env.MONDAY_STORAGE_TOKEN ?? '');

export async function kvGet<T>(key: string): Promise<T | null> {
  const r = await storage.get(key);
  return (r?.value as T) ?? null;
}

export async function kvSet(key: string, value: unknown, ttlSec?: number): Promise<void> {
  await storage.set(key, value as any, ttlSec ? { ttl: ttlSec } : undefined);
}

export async function kvDelete(key: string): Promise<void> {
  await storage.delete(key);
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
