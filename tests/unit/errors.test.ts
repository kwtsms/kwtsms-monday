import { statusForReason, redactCreds } from '../../src/core/errors';

describe('statusForReason', () => {
  it('maps reasons to status strings', () => {
    expect(statusForReason('no-coverage')).toBe('Skipped: country not covered');
    expect(statusForReason('duplicate')).toBe('Skipped: duplicate');
    expect(statusForReason('zero-balance')).toBe('Skipped: insufficient balance');
    expect(statusForReason('invalid-phone')).toBe('Failed: invalid phone');
    expect(statusForReason('gateway-offline')).toBe('Skipped: gateway offline');
    expect(statusForReason('api-err', 'ERR009')).toBe('Failed: ERR009');
    expect(statusForReason('unknown')).toBe('Failed: internal error');
  });
});

describe('redactCreds', () => {
  it('redacts username and password in request objects', () => {
    const r = redactCreds({ username: 'x', password: 'y', foo: 'bar' });
    expect(r).toEqual({ username: '***', password: '***', foo: 'bar' });
  });
  it('does not mutate the original', () => {
    const orig = { username: 'x', password: 'y' };
    redactCreds(orig);
    expect(orig.username).toBe('x');
  });
});
