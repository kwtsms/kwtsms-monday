import { kvGet, kvSet, kvDelete, kvIndexAdd, kvIndexRemove, kvList } from './index';

export interface Template {
  id: string;
  name: string;
  body: string;
  createdAt: number;
  updatedAt: number;
  usageCount: number;
}

const K = (a: string, id: string) => `template:${a}:${id}`;
const P = (a: string) => `template:${a}`;

export async function getTemplate(a: string, id: string): Promise<Template | null> {
  return kvGet<Template>(K(a, id));
}
export async function saveTemplate(a: string, t: Template): Promise<void> {
  await kvSet(K(a, t.id), t);
  await kvIndexAdd(P(a), t.id);
}
export async function deleteTemplate(a: string, id: string): Promise<void> {
  await kvDelete(K(a, id));
  await kvIndexRemove(P(a), id);
}
export async function listTemplates(a: string): Promise<Template[]> {
  const keys = await kvList(P(a));
  const out: Template[] = [];
  for (const k of keys) {
    const t = await kvGet<Template>(k);
    if (t) out.push(t);
  }
  return out;
}
