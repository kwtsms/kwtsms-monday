import { AccountConfig, DEFAULT_CONFIG } from '../types/config';
import { kvGet, kvSet, kvDelete } from './index';

const K = (accountId: string) => `config:${accountId}`;

export async function getConfig(accountId: string): Promise<AccountConfig> {
  const c = await kvGet<AccountConfig>(K(accountId));
  return c ?? { ...DEFAULT_CONFIG };
}

export async function setConfig(accountId: string, cfg: AccountConfig): Promise<void> {
  await kvSet(K(accountId), cfg);
}

export async function deleteConfig(accountId: string): Promise<void> {
  await kvDelete(K(accountId));
}
