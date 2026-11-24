/*
FILE:      src/routes/webhooks/lifecycle.ts
CREATED:   2026-11-24 18:37 +03
TASK:      job 120 monday review board (F1)
AUTHOR:    M Alhassoun
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
  // 2026-11-24 18:45 +03: accept the Client Secret (webhooks-1 doc) or the Signing Secret (repo notes: webhook JWTs), same as the session middleware; job 120
  const secrets = [getSecret('MONDAY_CLIENT_SECRET'), getSecret('MONDAY_SIGNING_SECRET')].filter((s): s is string => !!s);
  if (!token || secrets.length === 0) {
    res.status(401).json({ error: 'missing-token' });
    return;
  }
  const valid = secrets.some((s) => {
    try {
      jwt.verify(token, s);
      return true;
    } catch {
      return false;
    }
  });
  if (!valid) {
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
