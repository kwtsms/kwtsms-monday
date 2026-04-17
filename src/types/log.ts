export type LogStatus = 'Delivered' | 'Failed' | 'Skipped';

export interface LogEntry {
  logId: string;
  timestamp: number;
  recipeInstanceId?: string;
  source: string;
  to: string;
  body: string;
  senderId: string;
  testMode: boolean;
  dedupKey: string;
  apiRequest: Record<string, unknown>;
  apiResponse: Record<string, unknown>;
  kwtMsgId?: string;
  status: LogStatus;
  statusReason?: string;
  errorCode?: string;
  errorMsg?: string;
  itemId?: string;
  boardId?: string;
}
