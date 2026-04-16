import { AuthedRequest } from '../../middleware/monday-jwt';
import { getTemplate } from '../../storage/template-store';
import { listTemplates } from '../../storage/template-store';
import { send } from '../../core/send-pipeline';
import initMondayClient from 'monday-sdk-js';

// Mirror of client buildItemBag: flatten nested scalars so {item.board_name}
// etc. resolve via the generic template-engine lookup.
function buildItemBagServer(it: any): Record<string, unknown> {
  if (!it) return {};
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(it)) {
    if (v === null || v === undefined) continue;
    const t = typeof v;
    if (t === 'string' || t === 'number' || t === 'boolean') out[k] = v;
  }
  if (it.group) out.group = it.group.title ?? '';
  if (it.board) {
    out.board_id = String(it.board.id ?? '');
    out.board_name = it.board.name ?? '';
    out.board_url = it.board.url ?? '';
  }
  if (it.creator) {
    out.creator_name = it.creator.name ?? '';
    out.creator_email = it.creator.email ?? '';
  }
  return out;
}

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
      state
      created_at
      updated_at
      url
      group { id title }
      board { id name url }
      creator { id name email }
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

  // Try to populate user.* with the recipe invoker. The webhook payload
  // usually carries a userId; if not, fall back to the item's creator so
  // templates that reference {user.name} in an automation get a real name
  // instead of the hard-coded "monday" we used to ship.
  const invokerId = (req.body?.payload?.userId
    ?? req.body?.userId
    ?? req.monday?.userId
    ?? item.creator?.id) as string | number | undefined;
  let userBag: Record<string, unknown> = {};
  if (invokerId != null) {
    try {
      const uq = `query($ids:[ID!]) { users(ids:$ids) { id name email phone title location country_code time_zone_identifier url } }`;
      const ur = (await m.api(uq, { variables: { ids: [String(invokerId)] } })) as any;
      const u = ur?.data?.users?.[0];
      if (u) {
        for (const [k, v] of Object.entries(u)) {
          if (v !== null && v !== undefined && typeof v !== 'object') userBag[k] = v;
        }
      }
    } catch { /* ignore - empty user bag means {user.*} substitutes to empty */ }
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
          item: buildItemBagServer(item),
          columns,
          user: userBag,
          board: {
            id: String(item.board?.id ?? ''),
            name: item.board?.name ?? '',
            url: item.board?.url ?? '',
          },
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
