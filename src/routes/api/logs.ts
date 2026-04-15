import { Router } from 'express';
import { mondayAuth, AuthedRequest } from '../../middleware/monday-jwt';
import { listLogs, clearLogs } from '../../storage/log-store';

const router = Router();

router.get('/', mondayAuth, async (req: AuthedRequest, res) => {
  const month = String(req.query.month ?? currentMonth());
  const page = Number(req.query.page ?? 0);
  const pageSize = 50;
  const all = await listLogs(req.monday!.accountId, month);
  const slice = all.slice(page * pageSize, (page + 1) * pageSize);
  res.json({ entries: slice, total: all.length, month });
});

router.post('/clear', mondayAuth, async (req: AuthedRequest, res) => {
  const month = String(req.body.month ?? currentMonth());
  await clearLogs(req.monday!.accountId, month);
  res.json({ ok: true });
});

function currentMonth(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

export default router;
