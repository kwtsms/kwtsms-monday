/*
FILE:      src/routes/webhooks/lifecycle.ts
CREATED:   2026-11-24 18:37 +03
TASK:      job 120 monday review board (F1)
AUTHOR:    integration agent
WHAT:      POST /webhooks/monday: monday app lifecycle webhook (install, uninstall, ...).
WHY:       nothing called the uninstall purge; customer data stayed after uninstall.
USAGE:     Developer Center > Webhooks > "All events": <live URL>/webhooks/monday.
           Request carries a JWT in the Authorization header signed with the app Client Secret
           (https://developer.monday.com/apps/docs/webhooks-1). Body: { type, data: { account_id, ... } }.
DEPENDS:   core/monday-env (getSecret), storage/purge.
*/
import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { getSecret } from '../../core/monday-env';
import { purgeAccount } from '../../storage/purge';

const router = Router();

router.post('/monday', async (req, res) => {
  const token = (req.headers.authorization ?? '').replace(/^Bearer\s+/, '');
  const secret = getSecret('MONDAY_CLIENT_SECRET');
  if (!token || !secret) {
    res.status(401).json({ error: 'missing-token' });
    return;
  }
  try {
    jwt.verify(token, secret);
  } catch {
    res.status(401).json({ error: 'invalid-token' });
    return;
  }
  const body = (req.body ?? {}) as { type?: unknown; data?: { account_id?: unknown } };
  if (body.type !== 'uninstall') {
    res.json({ ok: true, ignored: true });
    return;
  }
  const accountId = body.data?.account_id;
  if (accountId === undefined || accountId === null || !/^[0-9]+$/.test(String(accountId))) {
    res.status(400).json({ error: 'account-id-required' });
    return;
  }
  try {
    await purgeAccount(String(accountId));
    res.json({ ok: true, purged: true });
  } catch {
    // Non-2xx so monday can retry the event.
    res.status(500).json({ error: 'purge-failed' });
  }
});

export default router;
