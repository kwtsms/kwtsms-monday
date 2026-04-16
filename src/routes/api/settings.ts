import { Router } from 'express';
import { mondayAuth, AuthedRequest } from '../../middleware/monday-jwt';
import { getConfig, setConfig, deleteConfig } from '../../storage/config-store';
import { getKwtCreds, setKwtCreds, deleteKwtCreds } from '../../storage/secret-store';
import { KwtSmsClient } from '../../core/kwtsms-client';

const router = Router();
const client = new KwtSmsClient();

router.get('/', mondayAuth, async (req: AuthedRequest, res) => {
  const cfg = await getConfig(req.monday!.accountId);
  const creds = await getKwtCreds(req.monday!.accountId);
  res.json({
    ...cfg,
    username: creds ? creds.username : null,
  });
});

router.put('/', mondayAuth, async (req: AuthedRequest, res) => {
  const cfg = await getConfig(req.monday!.accountId);
  const allowed: (keyof typeof cfg)[] = [
    'defaultSenderId',
    'defaultCountryPrefix',
    'testMode',
    'globalEnabled',
    'notifRecipients',
    'notifEvents',
  ];
  for (const k of allowed) {
    if (k in req.body) (cfg as any)[k] = req.body[k];
  }
  await setConfig(req.monday!.accountId, cfg);
  res.json({ ok: true });
});

router.post('/connect', mondayAuth, async (req: AuthedRequest, res) => {
  const { username, password } = req.body as { username: string; password: string };
  if (!username || !password) {
    res.status(400).json({ error: 'generic' });
    return;
  }
  try {
    const bal = await client.balance({ username, password });
    const [sids, cov] = await Promise.all([
      client.senderIds({ username, password }),
      client.coverage({ username, password }),
    ]);
    await setKwtCreds(req.monday!.accountId, { username, password });
    const cfg = await getConfig(req.monday!.accountId);
    cfg.connected = true;
    cfg.balance = { amount: bal.amount, syncedAt: Date.now() };
    cfg.senderIds = sids;
    cfg.coverage = cov;
    if (!sids.find((s) => s.id === 'KWT-SMS' || s.name === 'KWT-SMS')) {
      cfg.defaultSenderId = sids[0]?.id ?? 'KWT-SMS';
    }
    cfg.lastSyncAt = Date.now();
    await setConfig(req.monday!.accountId, cfg);
    res.json({ ok: true });
  } catch {
    res.status(401).json({ error: 'generic' });
  }
});

// Re-sync balance / sender IDs / coverage using stored credentials. Called
// by the Reload button on the Connect card so the user can refresh gateway
// state without re-entering their password.
router.post('/reload', mondayAuth, async (req: AuthedRequest, res) => {
  const creds = await getKwtCreds(req.monday!.accountId);
  if (!creds) {
    res.status(400).json({ error: 'not-connected' });
    return;
  }
  try {
    const [bal, sids, cov] = await Promise.all([
      client.balance(creds),
      client.senderIds(creds),
      client.coverage(creds),
    ]);
    const cfg = await getConfig(req.monday!.accountId);
    cfg.balance = { amount: bal.amount, syncedAt: Date.now() };
    cfg.senderIds = sids;
    cfg.coverage = cov;
    cfg.lastSyncAt = Date.now();
    await setConfig(req.monday!.accountId, cfg);
    res.json({ ok: true, balance: cfg.balance, senderIds: sids, coverage: cov });
  } catch {
    res.status(502).json({ error: 'gateway' });
  }
});

router.post('/disconnect', mondayAuth, async (req: AuthedRequest, res) => {
  await deleteKwtCreds(req.monday!.accountId);
  const cfg = await getConfig(req.monday!.accountId);
  cfg.connected = false;
  await setConfig(req.monday!.accountId, cfg);
  res.json({ ok: true });
});

router.post('/uninstall', mondayAuth, async (req: AuthedRequest, res) => {
  await deleteKwtCreds(req.monday!.accountId);
  await deleteConfig(req.monday!.accountId);
  res.json({ ok: true });
});

export default router;
