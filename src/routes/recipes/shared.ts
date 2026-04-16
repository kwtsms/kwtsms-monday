import { AuthedRequest } from '../../middleware/monday-jwt';
import { getTemplate } from '../../storage/template-store';
import { listTemplates } from '../../storage/template-store';
import { send } from '../../core/send-pipeline';
import initMondayClient from 'monday-sdk-js';

interface RecipeFields {
  boardId?: string;
  itemId?: string;
  phoneColumnId?: string;
  statusColumnId?: string;
  templateId?: string;
  senderIdOverride?: string;
  statusValue?: string;
  columnId?: string;
  dateColumnId?: string;
  daysBefore?: number;
}

function extractFields(body: any): RecipeFields {
  const p = body?.payload ?? body;
  return {
    ...(p?.inputFields ?? {}),
    ...(p?.inboundFieldValues ?? {}),
  } as RecipeFields;
}

function extractBoardAndItem(body: any): { boardId: string; itemId: string } {
  const p = body?.payload ?? body;
  const fields = extractFields(body);
  return {
    boardId: String(fields.boardId ?? p?.boardId ?? ''),
    itemId: String(fields.itemId ?? p?.itemId ?? p?.pulseId ?? ''),
  };
}

export async function runRecipe(
  req: AuthedRequest,
  _payload: any,
  source: 'recipe',
): Promise<void> {
  const accountId = req.monday!.accountId;
  const fields = extractFields(req.body);
  const { boardId, itemId } = extractBoardAndItem(req.body);

  if (!itemId) {
    console.error('runRecipe: no itemId found in payload fields:', Object.keys(req.body?.payload ?? {}).join(','));
    return;
  }

  let body = '';
  if (fields.templateId) {
    const tmpl = await getTemplate(accountId, fields.templateId);
    if (tmpl) {
      body = tmpl.body;
    } else {
      const all = await listTemplates(accountId);
      const byName = all.find((t) => t.name === fields.templateId);
      if (byName) body = byName.body;
    }
  }

  const mondayToken = (req.headers.authorization ?? '').replace(/^Bearer\s+/, '');
  const m = initMondayClient();
  m.setToken(mondayToken);

  const q = `query($id:[ID!]) {
    items(ids:$id) {
      id
      name
      board { id name }
      column_values {
        id
        text
        type
        column { title }
        ... on PhoneValue { phone }
      }
    }
  }`;
  const r = (await m.api(q, { variables: { id: [itemId] } })) as any;
  const item = r?.data?.items?.[0];
  if (!item) {
    console.error('runRecipe: item not found', itemId);
    return;
  }

  const columns: Record<string, string> = {};
  let phoneRaw = '';
  for (const cv of item.column_values ?? []) {
    const title = cv.column?.title ?? cv.id;
    columns[title] = cv.text ?? '';
    if (fields.phoneColumnId && cv.id === fields.phoneColumnId) {
      phoneRaw = cv.phone ?? cv.text ?? '';
    }
    if (!phoneRaw && cv.type === 'phone') {
      phoneRaw = cv.phone ?? cv.text ?? '';
    }
  }

  await send(
    [
      {
        phoneRaw,
        ctx: {
          item: { id: item.id, name: item.name },
          columns,
          user: { name: 'monday' },
          board: { name: item.board?.name ?? '' },
        },
        itemId: item.id,
        boardId: item.board?.id ?? boardId,
        statusColumnId: fields.statusColumnId,
      },
    ],
    {
      accountId,
      source,
      body,
      senderIdOverride: fields.senderIdOverride,
      mondayAccessToken: mondayToken,
      postBell: async () => {},
    },
  );
}
