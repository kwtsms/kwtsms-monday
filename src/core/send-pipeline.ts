import { randomUUID } from 'crypto';
import { cleanMessage } from './clean-message';
import { normalize } from './normalize';
import { verify } from './verify';
import { resolveTemplate, TemplateContext } from './template-engine';
import { dedupKey } from '../storage/dedup-store';
import { statusForReason, redactCreds } from './errors';
import { maybeNotify, isGatewayOfflinePaused } from './notifications';
import { writeStatus } from './writeback';
import { saveLog } from '../storage/log-store';
import { getConfig, setConfig } from '../storage/config-store';
import { getKwtCreds } from '../storage/secret-store';
import { KwtSmsClient } from './kwtsms-client';
import { LogEntry } from '../types/log';

export interface SendTarget {
  phoneRaw: string;
  ctx: TemplateContext;
  itemId?: string;
  boardId?: string;
  statusColumnId?: string;
}

export interface SendOptions {
  accountId: string;
  source: 'recipe' | 'item_view' | 'bulk' | 'bulk_item' | 'bulk_board';
  recipeInstanceId?: string;
  body: string;
  senderIdOverride?: string;
  testModeOverride?: boolean;
  mondayAccessToken: string;
  postBell: (userIds: string[], text: string) => Promise<void>;
}

export interface SendResult {
  sent: number;
  skipped: number;
  failed: number;
  results: Array<{
    to: string;
    status: string;
    kwtMsgId?: string;
    error?: string;
  }>;
  // Placeholder keys that had no value when templates were resolved
  // anywhere in this batch. Deduplicated across targets. Client surfaces
  // this so authors know which {foo.bar} tokens ended up empty.
  placeholderWarnings: string[];
}

const client = new KwtSmsClient();
const BATCH_SIZE = 100;
const BULK_THRESHOLD = 200;
const BATCH_DELAY_MS = 200;
let networkFailWindow: number[] = [];

async function recordLog(
  accountId: string,
  partial: Partial<LogEntry>,
  creds: { username: string; password: string } | null,
): Promise<void> {
  const entry: LogEntry = {
    logId: randomUUID(),
    timestamp: Date.now(),
    source: partial.source!,
    to: partial.to ?? '',
    body: partial.body ?? '',
    senderId: partial.senderId ?? '',
    testMode: partial.testMode ?? false,
    dedupKey: partial.dedupKey ?? '',
    apiRequest: creds ? redactCreds({ ...(partial.apiRequest as object), ...creds }) : (partial.apiRequest ?? {}),
    apiResponse: partial.apiResponse ?? {},
    kwtMsgId: partial.kwtMsgId,
    status: partial.status ?? 'Failed',
    statusReason: partial.statusReason,
    errorCode: partial.errorCode,
    errorMsg: partial.errorMsg,
    itemId: partial.itemId,
    boardId: partial.boardId,
    recipeInstanceId: partial.recipeInstanceId,
  };
  await saveLog(accountId, entry);
}

function recordNetworkFailure(): boolean {
  const now = Date.now();
  networkFailWindow = networkFailWindow.filter((t) => now - t < 60_000);
  networkFailWindow.push(now);
  return networkFailWindow.length >= 3;
}

function clearNetworkFailures(): void {
  networkFailWindow = [];
}

export async function send(
  targets: SendTarget[],
  options: SendOptions,
): Promise<SendResult> {
  const cfg = await getConfig(options.accountId);
  const result: SendResult = { sent: 0, skipped: 0, failed: 0, results: [], placeholderWarnings: [] };
  const warnSet = new Set<string>();

  if (!cfg.globalEnabled || !cfg.connected) {
    for (const t of targets) {
      const reason = !cfg.connected ? 'not-connected' : 'app-disabled';
      const status = statusForReason(reason);
      result.skipped++;
      result.results.push({ to: t.phoneRaw, status });
      await recordLog(options.accountId, {
        source: options.source, to: t.phoneRaw, body: options.body,
        status: 'Skipped', statusReason: reason, itemId: t.itemId, boardId: t.boardId,
        recipeInstanceId: options.recipeInstanceId,
        testMode: options.testModeOverride ?? cfg.testMode,
      }, null);
    }
    return result;
  }

  if (await isGatewayOfflinePaused(options.accountId)) {
    for (const t of targets) {
      result.skipped++;
      result.results.push({ to: t.phoneRaw, status: statusForReason('gateway-offline') });
      await recordLog(options.accountId, {
        source: options.source, to: t.phoneRaw, body: options.body,
        status: 'Skipped', statusReason: 'gateway-offline',
        itemId: t.itemId, boardId: t.boardId, recipeInstanceId: options.recipeInstanceId,
        testMode: options.testModeOverride ?? cfg.testMode,
      }, null);
    }
    return result;
  }

  const creds = await getKwtCreds(options.accountId);
  if (!creds) return result;

  const testMode = options.testModeOverride ?? cfg.testMode;
  const senderId = options.senderIdOverride ?? cfg.defaultSenderId;

  const resolved: Array<{
    t: SendTarget; to: string; body: string;
    status?: { reason: string; label: string };
    dedup?: string;
  }> = [];
  const batchKeys = new Set<string>();

  for (const t of targets) {
    const r = resolveTemplate(options.body, t.ctx);
    for (const w of r.warnings) warnSet.add(w);
    const c = cleanMessage(r.body);
    if (!c.body) {
      resolved.push({ t, to: t.phoneRaw, body: '', status: { reason: 'empty-message', label: statusForReason('empty-message') } });
      continue;
    }
    if (!t.phoneRaw) {
      resolved.push({ t, to: '', body: c.body, status: { reason: 'no-phone', label: statusForReason('no-phone') } });
      continue;
    }
    const n = normalize(t.phoneRaw, cfg.defaultCountryPrefix, cfg.coverage);
    if (!n.ok) {
      const reason = n.reason === 'not-mobile' ? 'not-mobile' : 'invalid-phone';
      resolved.push({ t, to: t.phoneRaw, body: c.body, status: { reason, label: statusForReason(reason) } });
      continue;
    }
    const v = verify(n.e164!);
    if (!v.ok) {
      const reason = v.reason === 'not-mobile' ? 'not-mobile' : 'invalid-phone';
      resolved.push({ t, to: n.e164!, body: c.body, status: { reason, label: statusForReason(reason) } });
      continue;
    }
    const countryPrefix = cfg.coverage.find((cc2) => n.e164!.startsWith(cc2.prefix));
    if (!countryPrefix) {
      resolved.push({ t, to: n.e164!, body: c.body, status: { reason: 'no-coverage', label: statusForReason('no-coverage') } });
      continue;
    }
    // Dedup is per-batch: inside a single send() call, if the same
    // (phone, body, sender) appears more than once (common in bulk where a
    // customer is on two rows), send once and mark the repeats as duplicate.
    // No persistence, no time window - manual follow-up sends to the same
    // number minutes later are always allowed.
    const key = dedupKey(n.e164!, c.body, senderId);
    if (batchKeys.has(key)) {
      resolved.push({ t, to: n.e164!, body: c.body, status: { reason: 'duplicate', label: statusForReason('duplicate') } });
      continue;
    }
    batchKeys.add(key);
    resolved.push({ t, to: n.e164!, body: c.body, dedup: key });
  }

  if (cfg.balance.amount <= 0) {
    for (const r of resolved) {
      if (r.status) continue;
      r.status = { reason: 'zero-balance', label: statusForReason('zero-balance') };
    }
    await maybeNotify(options.accountId, 'zero-balance', options.postBell);
  }

  for (const r of resolved) {
    if (!r.status) continue;
    const isFailure = r.status.label.startsWith('Failed');
    if (isFailure) result.failed++;
    else result.skipped++;
    result.results.push({ to: r.to, status: r.status.label, error: r.status.reason });
    await recordLog(options.accountId, {
      source: options.source, to: r.to, body: r.body, senderId, testMode,
      status: isFailure ? 'Failed' : 'Skipped',
      statusReason: r.status.reason,
      itemId: r.t.itemId, boardId: r.t.boardId, recipeInstanceId: options.recipeInstanceId,
    }, null);
    if (r.t.itemId && r.t.statusColumnId) {
      await writeStatus({
        mondayAccessToken: options.mondayAccessToken,
        boardId: r.t.boardId!, itemId: r.t.itemId!,
        statusColumnId: r.t.statusColumnId, value: r.status.label,
      }).catch(() => void 0);
    }
  }

  const toSend = resolved.filter((r) => !r.status);
  const batches = toSend.length > BULK_THRESHOLD ? chunk(toSend, BATCH_SIZE) : [toSend];
  for (let i = 0; i < batches.length; i++) {
    if (i > 0) await delay(BATCH_DELAY_MS);
    for (const r of batches[i]) {
      try {
        const resp = await client.send({
          username: creds.username, password: creds.password,
          senderid: senderId, mobile: r.to, message: r.body, test: testMode ? 1 : 0,
        });
        clearNetworkFailures();
        if (resp.result === 'OK') {
          result.sent++;
          result.results.push({ to: r.to, status: 'Delivered', kwtMsgId: resp.msgId });
          await recordLog(options.accountId, {
            source: options.source, to: r.to, body: r.body, senderId, testMode, dedupKey: r.dedup,
            apiRequest: { senderid: senderId, mobile: r.to, message: r.body, test: testMode ? 1 : 0 },
            apiResponse: resp as unknown as Record<string, unknown>,
            kwtMsgId: resp.msgId, status: 'Delivered',
            itemId: r.t.itemId, boardId: r.t.boardId, recipeInstanceId: options.recipeInstanceId,
          }, creds);
          if (r.t.itemId && r.t.statusColumnId) {
            await writeStatus({
              mondayAccessToken: options.mondayAccessToken,
              boardId: r.t.boardId!, itemId: r.t.itemId!,
              statusColumnId: r.t.statusColumnId, value: 'Delivered',
            }).catch(() => void 0);
          }
          if (typeof resp.balance === 'number') {
            cfg.balance = { amount: resp.balance, syncedAt: Date.now() };
            await setConfig(options.accountId, cfg);
          }
        } else {
          const errCode = resp.errorCode ?? 'ERR';
          const label = statusForReason('api-err', errCode);
          result.failed++;
          result.results.push({ to: r.to, status: label, error: errCode });
          await recordLog(options.accountId, {
            source: options.source, to: r.to, body: r.body, senderId, testMode,
            apiResponse: resp as unknown as Record<string, unknown>,
            status: 'Failed', errorCode: errCode, errorMsg: resp.errorMessage,
            itemId: r.t.itemId, boardId: r.t.boardId, recipeInstanceId: options.recipeInstanceId,
          }, creds);
          if (r.t.itemId && r.t.statusColumnId) {
            await writeStatus({
              mondayAccessToken: options.mondayAccessToken,
              boardId: r.t.boardId!, itemId: r.t.itemId!,
              statusColumnId: r.t.statusColumnId, value: label,
            }).catch(() => void 0);
          }
        }
      } catch (err) {
        const shouldTrip = recordNetworkFailure();
        if (shouldTrip) {
          await maybeNotify(options.accountId, 'gateway-offline', options.postBell);
        }
        result.failed++;
        const label = shouldTrip ? statusForReason('gateway-offline') : statusForReason('unknown');
        result.results.push({ to: r.to, status: label, error: String(err) });
        await recordLog(options.accountId, {
          source: options.source, to: r.to, body: r.body, senderId, testMode,
          status: shouldTrip ? 'Skipped' : 'Failed',
          statusReason: shouldTrip ? 'gateway-offline' : 'unknown',
          errorMsg: String(err),
          itemId: r.t.itemId, boardId: r.t.boardId, recipeInstanceId: options.recipeInstanceId,
        }, null);
      }
    }
  }
  result.placeholderWarnings = Array.from(warnSet);
  return result;
}

function chunk<T>(a: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < a.length; i += n) out.push(a.slice(i, i + n));
  return out;
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
