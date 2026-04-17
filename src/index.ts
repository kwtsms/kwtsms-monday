import express from 'express';
import path from 'path';
import { warmUp as warmUpSecureStorage, startTokenKeepAlive } from './storage/secure-client';

// Structured logger. In monday-code this wraps SDK's Logger so messages
// appear in `mapps code:logs`. Locally falls back to console.
let _logger: { info: (m: string, c?: unknown) => void; error: (m: string, c?: unknown) => void; warn: (m: string, c?: unknown) => void } | null = null;
function logger() {
  if (_logger) return _logger;
  if (process.env.K_SERVICE) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { Logger } = require('@mondaycom/apps-sdk');
      const l = new Logger('kwtsms-monday');
      _logger = { info: (m, c) => l.info(m, c), error: (m, c) => l.error(m, c), warn: (m, c) => l.warn(m, c) };
      return _logger;
    } catch { /* fall through */ }
  }
  _logger = { info: (m, c) => console.log(m, c ?? ''), error: (m, c) => console.error(m, c ?? ''), warn: (m, c) => console.warn(m, c ?? '') };
  return _logger;
}

process.on('unhandledRejection', (reason) => {
  logger().error('unhandledRejection', { reason: String(reason) });
});
process.on('uncaughtException', (err) => {
  logger().error('uncaughtException', { error: String(err), stack: err.stack });
});
import cronRouter from './routes/cron/sync';
import oauthRouter from './routes/oauth';
import settingsRouter from './routes/api/settings';
import templatesRouter from './routes/api/templates';
import logsRouter from './routes/api/logs';
import sendRouter from './routes/api/send';
import statsRouter from './routes/api/stats';
import recipeRouter from './routes/recipes/trigger';

const app = express();
const port = Number(process.env.PORT) || 8080;

app.use(express.json());

// Request/response logger: emits one line per request with method, path,
// status, duration, and accountId when the JWT has already been decoded.
// Critical for reading mapps code:logs during 503/500 diagnosis.
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const dur = Date.now() - start;
    const accountId = (req as any).monday?.accountId;
    const line = `${req.method} ${req.originalUrl} ${res.statusCode} ${dur}ms${accountId ? ' acc=' + accountId : ''}`;
    if (res.statusCode >= 500) logger().error(line);
    else if (res.statusCode >= 400) logger().warn(line);
    else logger().info(line);
  });
  next();
});

app.use('/cron', cronRouter);
app.use('/oauth', oauthRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/templates', templatesRouter);
app.use('/api/logs', logsRouter);
app.use('/api/send', sendRouter);
app.use('/api/stats', statsRouter);
// Single recipe endpoint: all automation triggers use the same action block
// which calls runRecipe(). The old 4 separate endpoints were redundant.
// Keep /recipes/item-created/trigger as an alias since the existing block
// in Developer Center points to it.
app.use('/recipes', recipeRouter);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', version: '0.1.0' });
});

// Temporary debug endpoint: simulates a recipe trigger and returns every
// step's result inline so we can diagnose why automations aren't sending.
// Remove after the bug is fixed.
app.post('/api/debug/recipe', async (req, res) => {
  const steps: string[] = [];
  try {
    const { mondayAuth: auth } = require('./middleware/monday-jwt');
    await new Promise<void>((resolve, reject) => {
      auth(req, res, (err?: unknown) => err ? reject(err) : resolve());
    });
    steps.push(`auth ok: accountId=${(req as any).monday?.accountId}`);

    const { extractFields, extractBoardAndItem } = (() => {
      const p = req.body?.payload ?? req.body;
      const fields = { ...(p?.inputFields ?? {}), ...(p?.inboundFieldValues ?? {}) };
      const boardId = String(fields.boardId ?? p?.boardId ?? '');
      const itemId = String(fields.itemId ?? p?.itemId ?? p?.pulseId ?? '');
      return { extractFields: fields, extractBoardAndItem: { boardId, itemId } };
    })();
    steps.push(`fields: ${JSON.stringify(extractFields)}`);
    steps.push(`ids: boardId=${extractBoardAndItem.boardId} itemId=${extractBoardAndItem.itemId}`);

    if (!extractBoardAndItem.itemId) {
      steps.push('BAIL: no itemId');
      return res.json({ steps });
    }

    const accountId = (req as any).monday?.accountId;
    const { listTemplates } = require('./storage/template-store');
    const all = await listTemplates(accountId);
    steps.push(`templates: ${all.map((t: any) => t.name).join(', ') || '(none)'}`);

    const templateId = extractFields.templateId;
    if (!templateId) {
      steps.push('BAIL: no templateId in fields');
      return res.json({ steps });
    }
    const match = all.find((t: any) => t.id === templateId || t.name === templateId);
    steps.push(match ? `template matched: "${match.name}"` : `BAIL: template "${templateId}" not found`);
    if (!match) return res.json({ steps });

    const shortLivedToken = (req.body?.payload ?? req.body)?.shortLivedToken
      ?? (req.body?.payload ?? req.body)?.token
      ?? (req.headers.authorization ?? '').replace(/^Bearer\s+/, '');
    steps.push(`token source: ${shortLivedToken === (req.headers.authorization ?? '').replace(/^Bearer\s+/, '') ? 'auth-header' : 'shortLivedToken'}`);

    const initMondayClient = require('monday-sdk-js');
    const m = initMondayClient();
    m.setToken(shortLivedToken);
    const q = `query($id:[ID!]) { items(ids:$id) { id name column_values { id text type column { title } ... on PhoneValue { phone } } } }`;
    const r = await m.api(q, { variables: { id: [extractBoardAndItem.itemId] } });
    const item = (r as any)?.data?.items?.[0];
    steps.push(item ? `item found: "${item.name}"` : `BAIL: item ${extractBoardAndItem.itemId} not found via GraphQL`);
    if (!item) return res.json({ steps });

    let phoneRaw = '';
    const phoneColId = extractFields.phoneColumnId;
    for (const cv of item.column_values ?? []) {
      if (phoneColId && cv.id === phoneColId) phoneRaw = cv.phone ?? cv.text ?? '';
      if (!phoneRaw && cv.type === 'phone') phoneRaw = cv.phone ?? cv.text ?? '';
    }
    steps.push(`phone: "${phoneRaw}" (from column "${phoneColId}")`);

    steps.push('ALL CHECKS PASSED: would send SMS');
    res.json({ steps });
  } catch (e) {
    steps.push(`ERROR: ${String(e)}`);
    res.json({ steps });
  }
});

// Pre-warm endpoint: forces SecureStorage auth to happen on the serving
// instance before the client fires a POST. Client calls this first so a
// cold-instance warmup doesn't happen inside the non-idempotent POST
// (which cannot safely retry).
app.get('/api/prewarm', async (_req, res) => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { warmUp } = require('./storage/secure-client') as typeof import('./storage/secure-client');
    await warmUp();
    res.json({ ok: true });
  } catch {
    res.status(503).json({ ok: false });
  }
});

// Serve the Vite-bundled React client. dist-client/ is generated by `npm run
// build:client`. Client-side routing in App.tsx keys off window.location.pathname
// so all monday iframe URLs (/views/*, /actions/*) return the same index.html.
const clientDir = path.resolve(__dirname, '..', 'dist-client');
app.use('/assets', express.static(path.join(clientDir, 'assets')));
app.get(['/views/*', '/actions/*', '/'], (_req, res) => {
  res.sendFile(path.join(clientDir, 'index.html'));
});

// Bind the port as fast as possible so Cloud Run's startup probe succeeds.
// Blocking on SecureStorage warmup before listen() was causing 503s when the
// auth handshake outran the platform's readiness deadline. Instead we kick
// warmup off in the background; the first real request still waits for it
// via ensureReady() inside secure-client (which serializes concurrent auth).
app.listen(port, () => {
  logger().info(`listen bound port=${port} K_SERVICE=${process.env.K_SERVICE ?? '(local)'}`);
  void warmUpSecureStorage()
    .then(() => logger().info('warmup ok'))
    .catch((e) => logger().error('warmup failed', { error: String(e) }));
  startTokenKeepAlive();
});
