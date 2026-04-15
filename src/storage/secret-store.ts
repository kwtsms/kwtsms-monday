// In-memory fallback for local dev and integration tests.
// Lazy-imports the SDK so the heavy Google Cloud deps don't load unless
// the real SecureStorage is actually needed (production/monday code only).

type SecureStorageLike = {
  get(key: string): Promise<unknown>;
  set(key: string, value: unknown): Promise<void>;
  delete(key: string): Promise<void>;
};

const USE_MEMORY = !process.env.MONDAY_STORAGE_TOKEN;
const secureMemory: Map<string, unknown> = new Map();

let _secure: SecureStorageLike | null = null;
function getSecure(): SecureStorageLike {
  if (!_secure) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { SecureStorage } = require('@mondaycom/apps-sdk');
    _secure = new SecureStorage() as SecureStorageLike;
  }
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
