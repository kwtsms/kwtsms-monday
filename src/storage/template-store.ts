import { kvGet, kvSet, kvDelete, kvIndexAdd, kvIndexRemove, kvList } from './index';
import { cacheGet, cacheSet, cacheInvalidatePrefix } from './kv-cache';

export interface Template {
  id: string;
  name: string;
  body: string;
  createdAt: number;
  updatedAt: number;
  usageCount: number;
}

const K = (a: string, id: string) => `template:${a}:${id}`;
const P = (a: string) => `template:${a}`;
const LIST_CACHE = (a: string) => `cache:templates:${a}`;
const LIST_TTL = 30;

export async function getTemplate(a: string, id: string): Promise<Template | null> {
  return kvGet<Template>(K(a, id));
}

export async function saveTemplate(a: string, t: Template): Promise<void> {
  await kvSet(K(a, t.id), t);
  await kvIndexAdd(P(a), t.id);
  cacheInvalidatePrefix(LIST_CACHE(a));
}

export async function deleteTemplate(a: string, id: string): Promise<void> {
  await kvDelete(K(a, id));
  await kvIndexRemove(P(a), id);
  cacheInvalidatePrefix(LIST_CACHE(a));
}

// Parallel kvGet + 30s memory cache. Bulk send and every composer surface
// hits this on load, so a warm instance answers instantly.
export async function listTemplates(a: string): Promise<Template[]> {
  const cacheKey = LIST_CACHE(a);
  const hit = cacheGet<Template[]>(cacheKey);
  if (hit) return hit;
  const keys = await kvList(P(a));
  const entries = await Promise.all(keys.map((k) => kvGet<Template>(k)));
  const list = entries.filter((t): t is Template => !!t);
  cacheSet(cacheKey, list, LIST_TTL);
  return list;
}
