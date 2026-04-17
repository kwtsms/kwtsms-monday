import { Router } from 'express';
import { randomUUID } from 'crypto';
import { mondayAuth, AuthedRequest } from '../../middleware/monday-jwt';
import {
  listTemplates,
  saveTemplate,
  getTemplate,
  deleteTemplate,
  Template,
} from '../../storage/template-store';

const router = Router();

router.get('/', mondayAuth, async (req: AuthedRequest, res) => {
  res.json(await listTemplates(req.monday!.accountId));
});

// Remote-options endpoint for monday automation block dropdown fields.
// Returns templates as { title, value } pairs so the automation builder
// shows a pick-list instead of free text for the templateId field.
// Set this URL as the "Remote Options URL" on the templateId input field
// in Developer Center.
router.post('/options', mondayAuth, async (req: AuthedRequest, res) => {
  const all = await listTemplates(req.monday!.accountId);
  res.json(all.map((t) => ({ title: t.name, value: t.name })));
});

router.post('/', mondayAuth, async (req: AuthedRequest, res) => {
  const now = Date.now();
  const t: Template = {
    id: randomUUID(),
    name: String(req.body.name ?? ''),
    body: String(req.body.body ?? ''),
    createdAt: now,
    updatedAt: now,
    usageCount: 0,
  };
  await saveTemplate(req.monday!.accountId, t);
  res.json(t);
});

router.put('/:id', mondayAuth, async (req: AuthedRequest, res) => {
  const existing = await getTemplate(req.monday!.accountId, req.params.id);
  if (!existing) {
    res.status(404).end();
    return;
  }
  existing.name = String(req.body.name ?? existing.name);
  existing.body = String(req.body.body ?? existing.body);
  existing.updatedAt = Date.now();
  await saveTemplate(req.monday!.accountId, existing);
  res.json(existing);
});

router.delete('/:id', mondayAuth, async (req: AuthedRequest, res) => {
  await deleteTemplate(req.monday!.accountId, req.params.id);
  res.json({ ok: true });
});

export default router;
