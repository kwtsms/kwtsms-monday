import { Router } from 'express';
import { getConfig, setConfig } from '../../storage/config-store';
import { getKwtCreds } from '../../storage/secret-store';
import { KwtSmsClient } from '../../core/kwtsms-client';
import { kvList, kvDelete, kvSet } from '../../storage/index';
import { runWithToken } from '../../core/request-token';

const router = Router();
const client = new KwtSmsClient();

// Cron calls come from monday-code Scheduled Jobs with an Authorization header
// the Storage SDK will reuse. Capture it the same way mondayAuth does.
router.use((req, _res, next) => {
  const token = (req.headers.authorization ?? '').replace(/^Bearer\s+/, '');
  runWithToken(token, () => next());
});

router.post('/sync', async (req, res) => {
  const { accountId } = req.body as { accountId: string };
  if (!accountId) return res.status(400).json({ error: 'accountId required' });
  const creds = await getKwtCreds(accountId);
  if (!creds) return res.json({ ok: false, reason: 'no-creds' });
  const [bal, sids, cov] = await Promise.all([
    client.balance(creds),
    client.senderIds(creds),
    client.coverage(creds),
  ]);
  const cfg = await getConfig(accountId);
  cfg.balance = { amount: bal.amount, syncedAt: Date.now() };
  cfg.senderIds = sids;
  cfg.coverage = cov;
  cfg.lastSyncAt = Date.now();
  await setConfig(accountId, cfg);

  await purgeOldLogs(accountId);
  res.json({ ok: true });
});

async function purgeOldLogs(accountId: string): Promise<void> {
  const cutoffMs = 90 * 24 * 60 * 60 * 1000;
  const nowMonth = new Date();
  const oldMonth = new Date(nowMonth.getTime() - cutoffMs);
  const threshold = `${oldMonth.getUTCFullYear()}-${String(oldMonth.getUTCMonth() + 1).padStart(2, '0')}`;
  for (let i = 4; i <= 24; i++) {
    const d = new Date(nowMonth.getTime() - i * 30 * 24 * 60 * 60 * 1000);
    const m = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
    if (m >= threshold) continue;
    const keys = await kvList(`log:${accountId}:${m}`);
    for (const k of keys) await kvDelete(k);
    await kvSet(`log:${accountId}:${m}:__index`, []);
  }
}

export default router;
