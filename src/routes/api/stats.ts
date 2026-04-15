import { Router } from 'express';
import { mondayAuth, AuthedRequest } from '../../middleware/monday-jwt';
import { getConfig } from '../../storage/config-store';
import { listLogs } from '../../storage/log-store';

const router = Router();

router.get('/', mondayAuth, async (req: AuthedRequest, res) => {
  const a = req.monday!.accountId;
  const cfg = await getConfig(a);
  const month = currentMonth();
  const logs = await listLogs(a, month);
  const today = todayPrefix();
  const todaySent = logs.filter((l) => l.status === 'Delivered' && new Date(l.timestamp).toISOString().startsWith(today)).length;
  const monthSent = logs.filter((l) => l.status === 'Delivered').length;
  const monthFailed = logs.filter((l) => l.status === 'Failed').length;
  const windowMs = 7 * 24 * 3600 * 1000;
  const cutoff = Date.now() - windowMs;
  const recent = logs.filter((l) => l.timestamp >= cutoff);
  const recentTotal = recent.length;
  const recentFailed = recent.filter((l) => l.status === 'Failed').length;
  const failureRate = recentTotal ? recentFailed / recentTotal : 0;
  const days: { d: string; sent: number; failed: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.now() - i * 24 * 3600 * 1000).toISOString().slice(0, 10);
    days.push({
      d,
      sent: logs.filter((l) => l.status === 'Delivered' && new Date(l.timestamp).toISOString().startsWith(d)).length,
      failed: logs.filter((l) => l.status === 'Failed' && new Date(l.timestamp).toISOString().startsWith(d)).length,
    });
  }
  res.json({
    balance: cfg.balance.amount,
    todaySent,
    monthSent,
    monthFailed,
    failureRate,
    series: days,
    lastSyncAt: cfg.lastSyncAt,
  });
});

function currentMonth() {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}
function todayPrefix() {
  return new Date().toISOString().slice(0, 10);
}

export default router;
