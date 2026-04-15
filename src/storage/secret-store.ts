// In-memory fallback for local dev and integration tests.
// When running outside the monday code runtime (no MONDAY_STORAGE_TOKEN),
// SecureStorage construction would fail or throw. We use a plain Map instead.
// Production deployments have the runtime token injected and use SecureStorage normally.

import { SecureStorage } from '@mondaycom/apps-sdk';

const USE_MEMORY = !process.env.MONDAY_STORAGE_TOKEN;
const secureMemory: Map<string, unknown> = new Map();

let _secure: InstanceType<typeof SecureStorage> | null = null;
function getSecure(): InstanceType<typeof SecureStorage> {
  if (!_secure) _secure = new SecureStorage();
  return _secure;
}

const K = (a: string) => `secret:kwtsms:${a}`;

export interface KwtCreds {
  username: string;
  password: string;
}

export async function getKwtCreds(a: string): Promise<KwtCreds | null> {
  if (USE_MEMORY) {
    const v = secureMemory.get(K(a));
    return v !== undefined ? (v as KwtCreds) : null;
  }
  const r = await getSecure().get(K(a));
  return (r as KwtCreds) ?? null;
}

export async function setKwtCreds(a: string, creds: KwtCreds): Promise<void> {
  if (USE_MEMORY) { secureMemory.set(K(a), creds); return; }
  await getSecure().set(K(a), creds as any);
}

export async function deleteKwtCreds(a: string): Promise<void> {
  if (USE_MEMORY) { secureMemory.delete(K(a)); return; }
  await getSecure().delete(K(a));
}
