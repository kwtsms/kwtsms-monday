import { verify } from '../../src/core/verify';

describe('verify', () => {
  it('accepts a valid E.164 mobile', () => {
    expect(verify('96598765432')).toEqual({ ok: true });
  });
  it('rejects empty', () => {
    expect(verify('')).toEqual({ ok: false, reason: 'empty' });
  });
  it('rejects invalid', () => {
    expect(verify('96512')).toEqual({ ok: false, reason: 'invalid' });
  });
});
