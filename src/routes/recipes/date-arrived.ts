import { Router } from 'express';
import { mondayAuth, AuthedRequest } from '../../middleware/monday-jwt';
import { runRecipe } from './shared';

const router = Router();

router.post('/trigger', mondayAuth, async (req: AuthedRequest, res) => {
  await runRecipe(req, req.body.payload, 'recipe');
  res.json({ ok: true });
});

export default router;
