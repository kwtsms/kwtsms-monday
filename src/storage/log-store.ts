import { LogEntry } from '../types/log';
import { kvGet, kvSet, kvDelete, kvIndexAdd, kvList } from './index';
import { cacheGet, cacheSet, cacheInvalidatePrefix } from './kv-cache';

function monthKey(ts: number): string {
  const d = new Date(ts);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}
const K = (a: string, m: string, id: string) => `log:${a}:${m}:${id}`;
const P = (a: string, m: string) => `log:${a}:${m}`;
const LIST_CACHE = (a: string, m: string) => `cache:logs:${a}:${m}`;
const LIST_TTL = 10;

export async function saveLog(a: string, entry: LogEntry): Promise<void> {
  const m = monthKey(entry.timestamp);
  await kvSet(K(a, m, entry.logId), entry);
  await kvIndexAdd(P(a, m), entry.logId);
  cacheInvalidatePrefix(`cache:logs:${a}`);
}

// 10s TTL on the list so a rapid page-load after a send shows the new entry,
// while repeated refreshes within the window skip SecureStorage entirely.
export async function listLogs(a: string, month: string): Promise<LogEntry[]> {
  const cacheKey = LIST_CACHE(a, month);
  const hit = cacheGet<LogEntry[]>(cacheKey);
  if (hit) return hit;
  const keys = await kvList(P(a, month));
  const entries = await Promise.all(keys.map((k) => kvGet<LogEntry>(k)));
  const list = entries
    .filter((e): e is LogEntry => !!e)
    .sort((x, y) => y.timestamp - x.timestamp);
  cacheSet(cacheKey, list, LIST_TTL);
  return list;
}

export async function clearLogs(a: string, month: string): Promise<void> {
  const keys = await kvList(P(a, month));
  for (const k of keys) await kvDelete(k);
  await kvSet(`${P(a, month)}:__index`, []);
  cacheInvalidatePrefix(`cache:logs:${a}`);
}
