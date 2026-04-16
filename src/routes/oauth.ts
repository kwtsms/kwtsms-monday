import { Router } from 'express';
import { getSecret, getEnv } from '../core/monday-env';

const router = Router();

router.get('/callback', async (req, res) => {
  const code = String(req.query.code ?? '');
  if (!code) {
    res.status(400).send('missing code');
    return;
  }
  const tokenRes = await fetch('https://auth.monday.com/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: getEnv('MONDAY_CLIENT_ID'),
      client_secret: getSecret('MONDAY_CLIENT_SECRET'),
      code,
      redirect_uri: getEnv('MONDAY_REDIRECT_URI'),
    }),
  });
  if (!tokenRes.ok) {
    res.status(500).send('token exchange failed');
    return;
  }
  await tokenRes.json();
  res.redirect('/views/account-settings');
});

export default router;
