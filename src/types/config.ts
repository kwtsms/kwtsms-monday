import { KwtSenderId, KwtCoverageEntry, KwtBalance } from './kwtsms';

export interface NotifEvents {
  zeroBalance: boolean;
  gatewayOffline: boolean;
}

export interface NotifState {
  lastZeroBalanceAt: number;
  lastGatewayOfflineAt: number;
  gatewayOfflineUntil?: number;
}

export interface AccountConfig {
  connected: boolean;
  senderIds: KwtSenderId[];
  coverage: KwtCoverageEntry[];
  defaultSenderId: string;
  defaultCountryPrefix: string;
  testMode: boolean;
  globalEnabled: boolean;
  debugLogs: boolean;
  notifRecipients: string[];
  notifEvents: NotifEvents;
  notifState: NotifState;
  balance: KwtBalance;
  lastSyncAt: number;
}

export const DEFAULT_CONFIG: AccountConfig = {
  connected: false,
  senderIds: [],
  coverage: [],
  defaultSenderId: 'KWT-SMS',
  defaultCountryPrefix: '965',
  testMode: false,
  globalEnabled: true,
  debugLogs: false,
  notifRecipients: [],
  notifEvents: { zeroBalance: true, gatewayOffline: true },
  notifState: { lastZeroBalanceAt: 0, lastGatewayOfflineAt: 0 },
  balance: { amount: 0, syncedAt: 0 },
  lastSyncAt: 0,
};
