import { getConfig, setConfig } from '../storage/config-store';

const ZERO_BAL_DEBOUNCE_MS = 24 * 60 * 60 * 1000;
const OFFLINE_DEBOUNCE_MS = 15 * 60 * 1000;
const OFFLINE_PAUSE_MS = 5 * 60 * 1000;

type NotifKind = 'zero-balance' | 'gateway-offline';

export async function maybeNotify(
  accountId: string,
  kind: NotifKind,
  postBell: (userIds: string[], text: string) => Promise<void>,
): Promise<void> {
  const cfg = await getConfig(accountId);
  if (!cfg.notifEvents[kind === 'zero-balance' ? 'zeroBalance' : 'gatewayOffline']) return;
  const now = Date.now();
  const last =
    kind === 'zero-balance'
      ? cfg.notifState.lastZeroBalanceAt
      : cfg.notifState.lastGatewayOfflineAt;
  const debounce = kind === 'zero-balance' ? ZERO_BAL_DEBOUNCE_MS : OFFLINE_DEBOUNCE_MS;
  if (now - last < debounce) return;

  const text =
    kind === 'zero-balance'
      ? 'kwtSMS balance is 0. All recipes paused until balance refills.'
      : `kwtSMS gateway unreachable since ${new Date(now).toISOString().slice(11, 16)}. Sends paused for 5 minutes.`;

  await postBell(cfg.notifRecipients, text).catch(() => void 0);

  if (kind === 'zero-balance') cfg.notifState.lastZeroBalanceAt = now;
  else {
    cfg.notifState.lastGatewayOfflineAt = now;
    cfg.notifState.gatewayOfflineUntil = now + OFFLINE_PAUSE_MS;
  }
  await setConfig(accountId, cfg);
}

export async function isGatewayOfflinePaused(accountId: string): Promise<boolean> {
  const cfg = await getConfig(accountId);
  const until = cfg.notifState.gatewayOfflineUntil ?? 0;
  return Date.now() < until;
}
