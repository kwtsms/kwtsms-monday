import { Router } from 'express';
import { mondayAuth, AuthedRequest } from '../../middleware/monday-jwt';
import { runRecipe } from './shared';

const router = Router();

// Single handler for ALL automation triggers. Monday's action block fires
// here regardless of trigger type (item created, status changed, column
// changed, date arrived). The payload always contains boardId + itemId.
router.post('/trigger', mondayAuth, async (req: AuthedRequest, res) => {
  const result = await runRecipe(req, req.body.payload, 'recipe');
  res.json({ ok: true, ...result });
});

// Aliases so existing block configs pointing to old endpoints still work.
router.post('/item-created/trigger', mondayAuth, async (req: AuthedRequest, res) => {
  const result = await runRecipe(req, req.body.payload, 'recipe');
  res.json({ ok: true, ...result });
});
router.post('/status-to-value/trigger', mondayAuth, async (req: AuthedRequest, res) => {
  const result = await runRecipe(req, req.body.payload, 'recipe');
  res.json({ ok: true, ...result });
});
router.post('/column-changed/trigger', mondayAuth, async (req: AuthedRequest, res) => {
  const result = await runRecipe(req, req.body.payload, 'recipe');
  res.json({ ok: true, ...result });
});
router.post('/date-arrived/trigger', mondayAuth, async (req: AuthedRequest, res) => {
  const result = await runRecipe(req, req.body.payload, 'recipe');
  res.json({ ok: true, ...result });
});

export default router;
