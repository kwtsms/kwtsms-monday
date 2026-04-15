import { LogEntry } from '../types/log';
import { kvGet, kvSet, kvDelete, kvIndexAdd, kvList } from './index';

function monthKey(ts: number): string {
  const d = new Date(ts);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}
const K = (a: string, m: string, id: string) => `log:${a}:${m}:${id}`;
const P = (a: string, m: string) => `log:${a}:${m}`;

export async function saveLog(a: string, entry: LogEntry): Promise<void> {
  const m = monthKey(entry.timestamp);
  await kvSet(K(a, m, entry.logId), entry);
  await kvIndexAdd(P(a, m), entry.logId);
}
export async function listLogs(a: string, month: string): Promise<LogEntry[]> {
  const keys = await kvList(P(a, month));
  const out: LogEntry[] = [];
  for (const k of keys) {
    const e = await kvGet<LogEntry>(k);
    if (e) out.push(e);
  }
  return out.sort((x, y) => y.timestamp - x.timestamp);
}
export async function clearLogs(a: string, month: string): Promise<void> {
  const keys = await kvList(P(a, month));
  for (const k of keys) await kvDelete(k);
  await kvSet(`${P(a, month)}:__index`, []);
}
