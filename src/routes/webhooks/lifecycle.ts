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
  // 2026-11-24 18:59 +03: security c16267: verify with the Client Secret only (lifecycle webhooks, webhooks-1 doc), HS256 only;
  // the account to purge must be the VERIFIED token's accountId and equal data.account_id; client session tokens
  // (dat claim) are refused, so a user of account A cannot purge account B. job 120
  const secret = getSecret('MONDAY_CLIENT_SECRET');
  if (!token || !secret) {
    res.status(401).json({ error: 'missing-token' });
    return;
  }
  // 2026-11-24 23:00 +03: live uninstall test 22:55 got 403: monday's lifecycle JWT wraps its claims in dat
  // ({ dat: { account_id, user_id, client_id, ... } }), not a top-level accountId. Bind to dat.account_id. job 120
  let claims: { accountId?: unknown; dat?: { account_id?: unknown } };
  try {
    claims = jwt.verify(token, secret, { algorithms: ['HS256'] }) as { accountId?: unknown; dat?: { account_id?: unknown } };
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
  const tokenAccount = claims.dat?.account_id;
  if (tokenAccount === undefined || tokenAccount === null || String(tokenAccount) !== String(accountId)) {
    console.warn('lifecycle webhook refused: token account does not match body account');
    res.status(403).json({ error: 'account-mismatch' });
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
