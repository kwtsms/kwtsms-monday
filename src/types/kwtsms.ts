export interface KwtSenderId {
  id: string;
  name: string;
  type: string;
}

export interface KwtCoverageEntry {
  countryCode: string;
  prefix: string;
  rate?: number;
}

export interface KwtBalance {
  amount: number;
  syncedAt: number;
}

export interface KwtSendRequest {
  username: string;
  password: string;
  senderid: string;
  mobile: string;
  message: string;
  test?: 0 | 1;
}

export interface KwtSendResponse {
  result: 'OK' | 'ERROR';
  msgId?: string;
  errorCode?: string;
  errorMessage?: string;
  balance?: number;
}
