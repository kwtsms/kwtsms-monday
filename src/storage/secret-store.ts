// Credential storage. Uses the shared SecureStorage instance so we only pay
// one GCP identity handshake per Cloud Run instance.
import { getSecureStorage } from './secure-client';

const USE_MEMORY = !process.env.K_SERVICE;
const secureMemory: Map<string, unknown> = new Map();

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
  const r = await getSecureStorage().get<KwtCreds>(K(a));
  return r ?? null;
}

export async function setKwtCreds(a: string, creds: KwtCreds): Promise<void> {
  if (USE_MEMORY) { secureMemory.set(K(a), creds); return; }
  await getSecureStorage().set(K(a), creds);
}

export async function deleteKwtCreds(a: string): Promise<void> {
  if (USE_MEMORY) { secureMemory.delete(K(a)); return; }
  await getSecureStorage().delete(K(a));
}
