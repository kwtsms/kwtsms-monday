/*
FILE:      src/storage/purge.ts
CREATED:   2026-11-24 18:37 +03
TASK:      job 120 monday review board (F1)
AUTHOR:    M Alhassoun
WHAT:      purgeAccount(accountId): deletes EVERY key this app stores for one monday account.
WHY:       uninstall must leave no customer data (credentials, config, templates, recipes, logs, caches).
USAGE:     called by POST /webhooks/monday (uninstall event) and POST /api/settings/uninstall.
DEPENDS:   storage/index (kv*), secret-store, config-store, template-store, recipe-store, log-store.

Key prefixes this app writes (all scoped by account id):
  secret:kwtsms:<a>           kwtSMS credentials (secret-store)
  config:<a>                  account config (config-store)
  template:<a>:<id>           templates, plus template:<a>:__index
  recipe:<a>:<id>             automation bindings, plus recipe:<a>:__index
  logs:<a>:<YYYY-MM>          send logs (log-store)
  log:<a>:<YYYY-MM>:<id>      legacy per-entry logs, plus log:<a>:<YYYY-MM>:__index
  dedup:<a>:<hash>            helper exists but nothing writes it (unused)
  in-process caches           cache:templates:<a>, cache:logs:<a>:<m>, config:<a> cache entry
*/
import { kvGet, kvDelete, kvList } from './index';
import { deleteKwtCreds } from './secret-store';
import { deleteConfig } from './config-store';
import { cacheInvalidatePrefix } from './kv-cache';

const LOG_MONTHS_BACK = 60; // 2026-11-24 18:37 +03: covers well past the 90-day retention plus legacy data
const LOG_MONTHS_FWD = 1;

function months(now: number): string[] {
  const n = new Date(now);
  const out: string[] = [];
  for (let i = -LOG_MONTHS_FWD; i <= LOG_MONTHS_BACK; i++) {
    const d = new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth() - i, 1));
    out.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`);
  }
  return out;
}

async function delIfPresent(key: string): Promise<void> {
  if ((await kvGet<unknown>(key)) !== null) await kvDelete(key);
}

async function purgeIndexed(prefix: string): Promise<void> {
  for (const k of await kvList(prefix)) await delIfPresent(k);
  await delIfPresent(`${prefix}:__index`);
}

export async function purgeAccount(a: string, now: number = Date.now()): Promise<void> {
  if (!a) throw new Error('purgeAccount: accountId required');
  await deleteKwtCreds(a);
  await deleteConfig(a);
  await purgeIndexed(`template:${a}`);
  await purgeIndexed(`recipe:${a}`);
  for (const m of months(now)) {
    await delIfPresent(`logs:${a}:${m}`);
    await purgeIndexed(`log:${a}:${m}`);
  }
  cacheInvalidatePrefix(`cache:templates:${a}`);
  cacheInvalidatePrefix(`cache:logs:${a}:`);
}
