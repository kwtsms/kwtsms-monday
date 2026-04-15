import { parsePhoneNumberFromString } from 'libphonenumber-js';

export interface VerifyResult {
  ok: boolean;
  reason?: 'empty' | 'invalid' | 'not-mobile';
}

export function verify(e164: string): VerifyResult {
  if (!e164) return { ok: false, reason: 'empty' };
  const p = parsePhoneNumberFromString('+' + e164);
  if (!p || !p.isValid()) return { ok: false, reason: 'invalid' };
  const type = p.getType();
  if (type === 'FIXED_LINE') return { ok: false, reason: 'not-mobile' };
  return { ok: true };
}
