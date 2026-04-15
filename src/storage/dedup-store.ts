import { kvGet, kvSet } from './index';
import { createHash } from 'crypto';

export function dedupKey(to: string, body: string, senderId: string): string {
  return createHash('sha256').update(`${to}|${body}|${senderId}`).digest('hex');
}

const K = (a: string, hash: string) => `dedup:${a}:${hash}`;

export async function seen(a: string, hash: string): Promise<boolean> {
  const r = await kvGet<number>(K(a, hash));
  return r !== null;
}
export async function mark(a: string, hash: string): Promise<void> {
  await kvSet(K(a, hash), Date.now(), 60);
}
