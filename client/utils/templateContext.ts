// Builders that turn monday GraphQL shapes into the free-form bags the
// template engine resolves against. Any scalar field we fetch is reachable
// as {ns.key}. Object/array fields are flattened or dropped so placeholders
// always stringify cleanly.
import mondaySdk from 'monday-sdk-js';

const monday = mondaySdk();

// Monday user scalar fields worth exposing. The `me` query is blocked in some
// iframe surface contexts, so we fetch via users(ids:[<id from context>])
// which works everywhere users:read is granted. Skipping photo URLs (too
// long for SMS) and admin flags (internal).
export const USER_FIELDS = `
  id
  name
  email
  phone
  title
  location
  country_code
  time_zone_identifier
  url
  birthday
  is_guest
`;

// Fields to include in every item fetch. Group/board/creator get flattened
// into dotted keys (item.group, item.board_name, item.creator_name) so a
// template can reference them as scalar placeholders.
export const ITEM_CORE_FIELDS = `
  id
  name
  state
  created_at
  updated_at
  url
  group { id title }
  board { id name url }
  creator { id name email }
`;

export function sanitiseScalars<T extends Record<string, unknown>>(obj: T | null | undefined): Record<string, unknown> {
  if (!obj) return {};
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === null || v === undefined) continue;
    const t = typeof v;
    if (t === 'string' || t === 'number' || t === 'boolean') out[k] = v;
  }
  return out;
}

export function buildItemBag(it: any): Record<string, unknown> {
  if (!it) return {};
  const base = sanitiseScalars(it);
  if (it.group) {
    base.group = it.group.title ?? '';
  }
  if (it.board) {
    base.board_id = String(it.board.id ?? '');
    base.board_name = it.board.name ?? '';
    base.board_url = it.board.url ?? '';
  }
  if (it.creator) {
    base.creator_name = it.creator.name ?? '';
    base.creator_email = it.creator.email ?? '';
  }
  return base;
}

export function buildUserBag(me: any): Record<string, unknown> {
  return sanitiseScalars(me);
}

export function buildBoardBag(board: any): Record<string, unknown> {
  return sanitiseScalars(board);
}

// Resolve the current user's scalar fields. Strategy:
//   1. Pull user.id from monday.get('context').
//   2. users(ids:[id]) via GraphQL for the rich scalar set.
//   3. Merge any fallback name from context so {user.name} works even if
//      the users-query scope was denied.
// Returns {} on any failure so templates degrade to empty strings rather
// than crash.
export async function fetchMe(): Promise<Record<string, unknown>> {
  let ctxData: any = null;
  try {
    const c: any = await monday.get('context');
    ctxData = c?.data ?? null;
  } catch { /* ignore */ }

  const userId = ctxData?.user?.id ?? ctxData?.userId;
  const ctxName = ctxData?.user?.name ? String(ctxData.user.name) : '';

  const bag: Record<string, unknown> = {};
  if (ctxName) bag.name = ctxName;

  if (userId != null) {
    try {
      const r: any = await monday.api(
        `query($ids:[ID!]) { users(ids:$ids) { ${USER_FIELDS} } }`,
        { variables: { ids: [String(userId)] } },
      );
      const u = r?.data?.users?.[0];
      if (u) Object.assign(bag, buildUserBag(u));
    } catch { /* ignore, bag still has name from context */ }
  }

  return bag;
}
