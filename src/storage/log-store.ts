import { LogEntry } from '../types/log';
import { kvGet, kvSet, kvDelete, kvList } from './index';
import { cacheGet, cacheSet, cacheInvalidatePrefix } from './kv-cache';

function log(): { info: (m: string) => void; error: (m: string, c?: unknown) => void } {
  if (process.env.K_SERVICE) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { Logger } = require('@mondaycom/apps-sdk');
      const l = new Logger('log-store');
      return { info: (m) => l.info(m), error: (m, c) => l.error(m, c) };
    } catch { /* fall through */ }
  }
  return { info: (m) => console.log('[log-store]', m), error: (m, c) => console.error('[log-store]', m, c ?? '') };
}

// Monthly logs live in a SINGLE SecureStorage key per (account, month) as a
// flat array. Reading a month is one kvGet instead of index + N round-trips.
// Appending is one kvSet of the updated array. Legacy per-entry keys remain
// readable via the fallback path below so existing installs don't lose
// history on first load after this change.

function monthKey(ts: number): string {
  const d = new Date(ts);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

const K = (a: string, m: string) => `logs:${a}:${m}`;                  // new: array-valued key
const LEGACY_P = (a: string, m: string) => `log:${a}:${m}`;            // legacy prefix for per-entry scheme
const LEGACY_K = (a: string, m: string, id: string) => `log:${a}:${m}:${id}`;
const LIST_CACHE = (a: string, m: string) => `cache:logs:${a}:${m}`;
const LIST_TTL = 10;
const RETENTION = 500; // Cap per month to keep the value under SecureStorage size limits

// One SecureStorage read per listLogs call. No legacy fallback - previous
// per-entry-keyed logs are no longer read here because the migration path
// was dominant on first load (kvList + N parallel kvGet + kvSet), tripping
// monday's proxy timeout and making /api/logs return 503 while /api/templates
// stayed fast. New logs written going forward use this single-key format.
async function readMonth(a: string, m: string): Promise<LogEntry[]> {
  const t = Date.now();
  try {
    const v = await kvGet<LogEntry[]>(K(a, m));
    log().info(`readMonth ok key=${K(a, m)} count=${v?.length ?? 0} ms=${Date.now() - t}`);
    return v ?? [];
  } catch (e) {
    log().error(`readMonth failed key=${K(a, m)} ms=${Date.now() - t}`, { error: String(e), stack: (e as Error)?.stack });
    throw e;
  }
}

// 2026-11-24 18:37 +03: F2 retention purge. The old purge in cron/sync.ts looked at the legacy "log:" prefix and
// never touched the real "logs:<acct>:<YYYY-MM>" keys, so nothing was ever deleted. Deletes every
// month whose calendar month is entirely older than 90 days. 500/month cap (RETENTION) is unchanged.
// Why: data-handling gap before marketplace review. Job 120 monday review board.
export const LOG_RETENTION_DAYS = 90;
const PURGE_LOOKBACK_MONTHS = 36;

export function monthsToPurge(now: number): string[] {
  const cutoff = new Date(now - LOG_RETENTION_DAYS * 24 * 60 * 60 * 1000);
  const out: string[] = [];
  for (let i = 1; i <= PURGE_LOOKBACK_MONTHS; i++) {
    // Month strictly before the month that contains the cutoff.
    const d = new Date(Date.UTC(cutoff.getUTCFullYear(), cutoff.getUTCMonth() - i, 1));
    out.push(monthKey(d.getTime()));
  }
  return out;
}

export async function purgeOldLogs(a: string, now: number = Date.now()): Promise<number> {
  let removed = 0;
  for (const m of monthsToPurge(now)) {
    if ((await kvGet<unknown>(K(a, m))) !== null) {
      await kvDelete(K(a, m));
      removed++;
    }
  }
  cacheInvalidatePrefix(`cache:logs:${a}:`);
  return removed;
}

// 2026-11-24 18:37 +03: run the purge at most once a day per account per instance, after a write, never blocking the send.
const lastPurge = new Map<string, number>();
function maybePurge(a: string): void {
  const now = Date.now();
  if (now - (lastPurge.get(a) ?? 0) < 24 * 60 * 60 * 1000) return;
  lastPurge.set(a, now);
  void purgeOldLogs(a, now).catch((e) => log().error('purgeOldLogs failed', { error: String(e) }));
}

export async function saveLog(a: string, entry: LogEntry): Promise<void> {
  const m = monthKey(entry.timestamp);
  const list = await readMonth(a, m);
  list.push(entry);
  // Bound the array so long-tail growth can't exceed SecureStorage's value
  // size. Oldest entries drop first.
  const capped = list.length > RETENTION ? list.slice(list.length - RETENTION) : list;
  await kvSet(K(a, m), capped);
  cacheInvalidatePrefix(`cache:logs:${a}`);
  maybePurge(a); // 2026-11-24 18:37 +03: F2, job 120
}

export async function listLogs(a: string, month: string): Promise<LogEntry[]> {
  const cacheKey = LIST_CACHE(a, month);
  const hit = cacheGet<LogEntry[]>(cacheKey);
  if (hit) {
    log().info(`listLogs cache-hit acc=${a} month=${month} count=${hit.length}`);
    return hit;
  }
  const list = (await readMonth(a, month)).sort((x, y) => y.timestamp - x.timestamp);
  cacheSet(cacheKey, list, LIST_TTL);
  log().info(`listLogs cache-miss acc=${a} month=${month} count=${list.length}`);
  return list;
}

export async function clearLogs(a: string, month: string): Promise<void> {
  await kvDelete(K(a, month));
  // Also wipe legacy per-entry data so it doesn't re-surface on reads.
  const keys = await kvList(LEGACY_P(a, month));
  for (const k of keys) await kvDelete(k);
  await kvSet(`${LEGACY_P(a, month)}:__index`, []);
  cacheInvalidatePrefix(`cache:logs:${a}`);
}
