import { AccountConfig, DEFAULT_CONFIG } from '../types/config';
import { kvGet, kvSet, kvDelete } from './index';
import { cacheGet, cacheSet, cacheDelete } from './kv-cache';

const K = (accountId: string) => `config:${accountId}`;
const CACHE_TTL = 60; // seconds - config rarely changes per request

export async function getConfig(accountId: string): Promise<AccountConfig> {
  const k = K(accountId);
  const hit = cacheGet<AccountConfig>(k);
  if (hit) return hit;
  const c = await kvGet<AccountConfig>(k);
  const resolved = c ?? { ...DEFAULT_CONFIG };
  cacheSet(k, resolved, CACHE_TTL);
  return resolved;
}

export async function setConfig(accountId: string, cfg: AccountConfig): Promise<void> {
  const k = K(accountId);
  await kvSet(k, cfg);
  // Refresh cache with the new value so the next read reflects the write
  // without paying a round-trip.
  cacheSet(k, cfg, CACHE_TTL);
}

export async function deleteConfig(accountId: string): Promise<void> {
  const k = K(accountId);
  await kvDelete(k);
  cacheDelete(k);
}
