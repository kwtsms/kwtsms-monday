import { Router } from 'express';
import { mondayAuth, AuthedRequest } from '../../middleware/monday-jwt';
import { send, SendTarget } from '../../core/send-pipeline';
// 2026-11-24 18:37 +03: F7 message and phone-list limits. Job 120 monday review board.
import { checkMessage, checkTargets } from '../../core/limits';
import initMondayClient from 'monday-sdk-js';

const router = Router();

router.post('/', mondayAuth, async (req: AuthedRequest, res) => {
  const { targets, body, senderIdOverride, source } = req.body as {
    targets: SendTarget[];
    body: string;
    senderIdOverride?: string;
    source?: 'item_view' | 'bulk';
  };
  const bad = checkTargets(targets) ?? checkMessage(body);
  if (bad) {
    res.status(400).json({ error: bad });
    return;
  }
  const mondayToken = (req.headers.authorization ?? '').replace(/^Bearer\s+/, '');
  const result = await send(targets, {
    accountId: req.monday!.accountId,
    source: source ?? 'item_view',
    body,
    senderIdOverride,
    mondayAccessToken: mondayToken,
    postBell: async (users, text) => {
      const m = initMondayClient();
      m.setToken(mondayToken);
      const q = `mutation($userId: ID!, $text: String!, $target: ID!, $targetType: NotificationTargetType!) {
        create_notification(user_id: $userId, text: $text, target_id: $target, target_type: $targetType) { id }
      }`;
      for (const u of users) {
        await m.api(q, {
          variables: {
            userId: u,
            text,
            target: req.monday!.accountId,
            targetType: 'Post',
          },
        }).catch(() => void 0);
      }
    },
  });
  res.json(result);
});

export default router;
