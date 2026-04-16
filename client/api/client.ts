import mondaySdk from 'monday-sdk-js';

export const monday = mondaySdk();

async function authHeader(): Promise<Record<string, string>> {
  const token = (await monday.get('sessionToken')).data as string;
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = { ...(await authHeader()), ...(init.headers as Record<string, string> | undefined) };
  const r = await fetch(path, { ...init, headers });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json() as Promise<T>;
}

export async function isViewOnly(): Promise<boolean> {
  try {
    const ctx = await monday.get('context');
    return !!(ctx?.data?.user?.isViewOnly);
  } catch {
    return false;
  }
}

export function reportValueCreated(): void {
  try {
    monday.execute('valueCreatedForUser');
  } catch {
    /* non-critical */
  }
}
