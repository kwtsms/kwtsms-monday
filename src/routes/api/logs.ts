import { Router } from 'express';
import { mondayAuth, AuthedRequest } from '../../middleware/monday-jwt';
import { listLogs, clearLogs } from '../../storage/log-store';

// Verbose logs endpoint logger. This is the API endpoint that keeps
// returning 503 for the user, so every step is instrumented. Each phase
// records how long it took and, on failure, the full error. The output
// shows up in `mapps code:logs -i <v> -t console -s live`.
function log(): { info: (m: string) => void; error: (m: string, c?: unknown) => void } {
  if (process.env.K_SERVICE) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { Logger } = require('@mondaycom/apps-sdk');
      const l = new Logger('api-logs');
      return { info: (m) => l.info(m), error: (m, c) => l.error(m, c) };
    } catch { /* fall through */ }
  }
  return { info: (m) => console.log('[api-logs]', m), error: (m, c) => console.error('[api-logs]', m, c ?? '') };
}

const router = Router();

router.get('/', mondayAuth, async (req: AuthedRequest, res) => {
  const t0 = Date.now();
  const month = String(req.query.month ?? currentMonth());
  const page = Number(req.query.page ?? 0);
  const itemId = req.query.itemId ? String(req.query.itemId) : undefined;
  const boardId = req.query.boardId ? String(req.query.boardId) : undefined;
  const pageSize = 10;
  const acc = req.monday!.accountId;
  log().info(`GET start acc=${acc} month=${month} page=${page} itemId=${itemId ?? '-'} boardId=${boardId ?? '-'}`);
  try {
    const tRead = Date.now();
    const all = await listLogs(acc, month);
    log().info(`listLogs ok acc=${acc} count=${all.length} readMs=${Date.now() - tRead}`);
    // Filter BEFORE paginating so item / board views don't miss entries that
    // landed outside the first page window.
    const filtered = all.filter((e) => {
      if (itemId && e.itemId !== itemId) return false;
      if (boardId && e.boardId !== boardId) return false;
      return true;
    });
    const slice = filtered.slice(page * pageSize, (page + 1) * pageSize);
    log().info(`GET ok acc=${acc} filtered=${filtered.length} sliced=${slice.length} totalMs=${Date.now() - t0}`);
    res.json({ entries: slice, total: filtered.length, month, pageSize });
  } catch (e) {
    log().error(`GET failed acc=${acc} totalMs=${Date.now() - t0}`, { error: String(e), stack: (e as Error)?.stack });
    res.status(500).json({ error: 'logs-read-failed', detail: String(e) });
  }
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
