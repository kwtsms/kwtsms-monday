// Phone sources surfaced in SMS-composer UIs.
//
// Single-item flows (Item View, right-click SendOne) work with concrete
// resolved numbers: each source is a labelled phone number the user can pick.
// Bulk flows work at the column level: the user picks one source once and we
// resolve a number per item, so bulk's type carries a resolver instead of a
// value.
import mondaySdk from 'monday-sdk-js';

const monday = mondaySdk();

export interface PhoneSource {
  id: string;
  kind: 'column' | 'person';
  label: string;
  value: string;
}

export interface ColumnPhoneSpec {
  // Column-level specifier used by bulk: "use this Phone column" or "use the
  // assigned person on this People column".
  id: string;
  kind: 'column' | 'people';
  columnId: string;
  label: string;
}

export interface BulkItemRaw {
  id: string;
  name: string;
  columnValues: Array<{
    id: string;
    type: string;
    text: string | null;
    phone?: string;
    persons_and_teams?: Array<{ id: number | string; kind: string }>;
    column?: { title?: string };
  }>;
}

async function fetchUsersPhones(
  ids: string[],
): Promise<Record<string, { name: string; phone: string }>> {
  if (ids.length === 0) return {};
  const q = `query($ids:[ID!]) { users(ids:$ids) { id name phone } }`;
  const r: any = await monday.api(q, { variables: { ids } });
  const out: Record<string, { name: string; phone: string }> = {};
  for (const u of r?.data?.users ?? []) {
    out[String(u.id)] = { name: u.name ?? '', phone: u.phone ?? '' };
  }
  return out;
}

// Build the concrete, pickable phone sources for a single item. Assigned
// persons with no phone on their profile are dropped so the picker only shows
// numbers the user can actually send to.
export async function buildSingleItemSources(item: {
  column_values?: BulkItemRaw['columnValues'];
}): Promise<PhoneSource[]> {
  const sources: PhoneSource[] = [];
  const personRefs: { userId: string; columnTitle: string }[] = [];

  for (const cv of item.column_values ?? []) {
    const title = cv.column?.title ?? cv.id;
    if (cv.type === 'phone') {
      const v = cv.phone ?? cv.text ?? '';
      if (v) sources.push({ id: `col:${cv.id}`, kind: 'column', label: `Phone column: ${title}`, value: v });
    } else if (cv.type === 'people' && Array.isArray(cv.persons_and_teams)) {
      for (const pt of cv.persons_and_teams) {
        if (pt?.kind === 'person' && pt.id != null) {
          personRefs.push({ userId: String(pt.id), columnTitle: title });
        }
      }
    }
  }

  if (personRefs.length > 0) {
    const uniq = Array.from(new Set(personRefs.map((p) => p.userId)));
    const phones = await fetchUsersPhones(uniq);
    const seen = new Set<string>();
    for (const p of personRefs) {
      const key = `person:${p.userId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const info = phones[p.userId];
      if (info && info.phone) {
        sources.push({ id: key, kind: 'person', label: `Person: ${info.name || p.userId}`, value: info.phone });
      }
    }
  }

  // Phone columns first, Person entries after, so the default is always the
  // item's phone column when one exists.
  sources.sort((a, b) => {
    if (a.kind === b.kind) return 0;
    return a.kind === 'column' ? -1 : 1;
  });
  return sources;
}

// For bulk: walk all selected items and collect the *column specifiers* that
// could yield phone numbers. Returns one entry per distinct (column id) found
// across the item set. A People column produces a single "People column: X"
// spec that resolves per item to the assigned person's phone.
//
// Phone columns are returned before People columns: Phone columns almost
// always hold the intended recipient, so that order makes the default
// selection (the first entry) the expected one.
export function buildBulkColumnSpecs(items: BulkItemRaw[]): ColumnPhoneSpec[] {
  const byId = new Map<string, ColumnPhoneSpec>();
  for (const it of items) {
    for (const cv of it.columnValues ?? []) {
      if (cv.type === 'phone') {
        const key = `col:${cv.id}`;
        if (!byId.has(key)) {
          byId.set(key, {
            id: key,
            kind: 'column',
            columnId: cv.id,
            label: `Phone column: ${cv.column?.title ?? cv.id}`,
          });
        }
      } else if (cv.type === 'people') {
        const key = `people:${cv.id}`;
        if (!byId.has(key)) {
          byId.set(key, {
            id: key,
            kind: 'people',
            columnId: cv.id,
            label: `People column: ${cv.column?.title ?? cv.id}`,
          });
        }
      }
    }
  }
  const specs = Array.from(byId.values());
  specs.sort((a, b) => {
    if (a.kind === b.kind) return 0;
    return a.kind === 'column' ? -1 : 1;
  });
  return specs;
}

// Resolve a single spec against a single item, returning the phone number (or
// '' if the item has no value for that spec). For People specs, fetches the
// assigned person's profile phone - callers should pass a preloaded map of
// userId → phone to avoid N round-trips across large bulk lists.
export function resolveBulkPhone(
  item: BulkItemRaw,
  spec: ColumnPhoneSpec,
  personPhones: Record<string, { name: string; phone: string }>,
): string {
  const cv = (item.columnValues ?? []).find((x) => x.id === spec.columnId);
  if (!cv) return '';
  if (spec.kind === 'column' && cv.type === 'phone') {
    return cv.phone ?? cv.text ?? '';
  }
  if (spec.kind === 'people' && cv.type === 'people' && Array.isArray(cv.persons_and_teams)) {
    for (const pt of cv.persons_and_teams) {
      if (pt?.kind === 'person' && pt.id != null) {
        const info = personPhones[String(pt.id)];
        if (info && info.phone) return info.phone;
      }
    }
  }
  return '';
}

// Collect every unique person-id referenced by a People column across items,
// for a single batched users(ids:...) fetch.
export function collectPeopleIds(items: BulkItemRaw[]): string[] {
  const out = new Set<string>();
  for (const it of items) {
    for (const cv of it.columnValues ?? []) {
      if (cv.type === 'people' && Array.isArray(cv.persons_and_teams)) {
        for (const pt of cv.persons_and_teams) {
          if (pt?.kind === 'person' && pt.id != null) out.add(String(pt.id));
        }
      }
    }
  }
  return Array.from(out);
}

export { fetchUsersPhones };
