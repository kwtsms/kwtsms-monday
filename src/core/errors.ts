export type FailureReason =
  | 'app-disabled'
  | 'not-connected'
  | 'gateway-offline'
  | 'template-error'
  | 'empty-message'
  | 'no-phone'
  | 'invalid-phone'
  | 'not-mobile'
  | 'no-coverage'
  | 'duplicate'
  | 'zero-balance'
  | 'api-err'
  | 'unknown';

const MAP: Record<FailureReason, string> = {
  'app-disabled': 'Skipped: app disabled',
  'not-connected': 'Skipped: not connected',
  'gateway-offline': 'Skipped: gateway offline',
  'template-error': 'Failed: template error',
  'empty-message': 'Failed: empty message',
  'no-phone': 'Failed: no phone',
  'invalid-phone': 'Failed: invalid phone',
  'not-mobile': 'Failed: not a mobile',
  'no-coverage': 'Skipped: country not covered',
  duplicate: 'Skipped: duplicate',
  'zero-balance': 'Skipped: insufficient balance',
  'api-err': 'Failed: internal error',
  unknown: 'Failed: internal error',
};

export function statusForReason(reason: string, errorCode?: string): string {
  if (reason === 'api-err' && errorCode) return `Failed: ${errorCode}`;
  return MAP[reason as FailureReason] ?? MAP.unknown;
}

export function redactCreds<T extends Record<string, unknown>>(obj: T): T {
  const copy: Record<string, unknown> = { ...obj };
  if ('username' in copy) copy.username = '***';
  if ('password' in copy) copy.password = '***';
  return copy as T;
}
