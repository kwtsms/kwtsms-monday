import { SecureStorage } from '@mondaycom/apps-sdk';

// SecureStorage constructor takes no arguments - it uses context automatically
const secure = new SecureStorage();

const K = (a: string) => `secret:kwtsms:${a}`;

export interface KwtCreds {
  username: string;
  password: string;
}

export async function getKwtCreds(a: string): Promise<KwtCreds | null> {
  const r = await secure.get(K(a));
  return (r as KwtCreds) ?? null;
}
export async function setKwtCreds(a: string, creds: KwtCreds): Promise<void> {
  await secure.set(K(a), creds as any);
}
export async function deleteKwtCreds(a: string): Promise<void> {
  await secure.delete(K(a));
}
