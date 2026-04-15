import { Router } from 'express';

const router = Router();
const CLIENT_ID = process.env.MONDAY_CLIENT_ID ?? '';
const CLIENT_SECRET = process.env.MONDAY_CLIENT_SECRET ?? '';
const REDIRECT_URI = process.env.MONDAY_REDIRECT_URI ?? '';

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
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      code,
      redirect_uri: REDIRECT_URI,
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
