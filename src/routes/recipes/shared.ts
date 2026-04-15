import { AuthedRequest } from '../../middleware/monday-jwt';
import { getTemplate } from '../../storage/template-store';
import { send } from '../../core/send-pipeline';
import initMondayClient from 'monday-sdk-js';

export interface RecipePayload {
  payload: {
    inputFields: {
      boardId: string;
      itemId: string;
      phoneColumnId: string;
      statusColumnId?: string;
      templateId: string;
      senderIdOverride?: string;
      statusValue?: string;
      columnId?: string;
      dateColumnId?: string;
      daysBefore?: number;
    };
  };
}

export async function runRecipe(
  req: AuthedRequest,
  payload: RecipePayload['payload'],
  source: 'recipe',
): Promise<void> {
  const accountId = req.monday!.accountId;
  const tmpl = await getTemplate(accountId, payload.inputFields.templateId);
  const body = tmpl?.body ?? '';
  const mondayToken = (req.headers.authorization ?? '').replace(/^Bearer\s+/, '');
  const m = initMondayClient();
  m.setToken(mondayToken);

  const q = `query($itemId: [ID!]) {
    items(ids: $itemId) {
      id name
      column_values { id title text value }
      board { id name }
    }
  }`;
  const r = (await m.api(q, { variables: { itemId: payload.inputFields.itemId } })) as any;
  const item = r.data.items[0];
  const columns: Record<string, string> = {};
  for (const cv of item.column_values) columns[cv.title] = cv.text ?? '';
  const phoneRaw = item.column_values.find((c: any) => c.id === payload.inputFields.phoneColumnId)?.text ?? '';

  await send(
    [
      {
        phoneRaw,
        ctx: {
          item: { id: item.id, name: item.name },
          columns,
          user: { name: 'monday' },
          board: { name: item.board.name },
        },
        itemId: item.id,
        boardId: item.board.id,
        statusColumnId: payload.inputFields.statusColumnId,
      },
    ],
    {
      accountId,
      source,
      body,
      senderIdOverride: payload.inputFields.senderIdOverride,
      mondayAccessToken: mondayToken,
      postBell: async () => {},
    },
  );
}
