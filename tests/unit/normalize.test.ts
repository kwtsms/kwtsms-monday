import { normalize } from '../../src/core/normalize';

const coverage = [
  { countryCode: 'KW', prefix: '965' },
  { countryCode: 'SA', prefix: '966' },
  { countryCode: 'AE', prefix: '971' },
  { countryCode: 'BH', prefix: '973' },
  { countryCode: 'QA', prefix: '974' },
  { countryCode: 'OM', prefix: '968' },
];

describe('normalize', () => {
  it('accepts +E.164 input', () => {
    expect(normalize('+96598765432', '965', coverage)).toEqual({ ok: true, e164: '96598765432' });
  });
  it('converts 00 prefix to +', () => {
    expect(normalize('0096598765432', '965', coverage)).toEqual({ ok: true, e164: '96598765432' });
  });
  it('strips separators and parens', () => {
    expect(normalize('+965 9876-5432', '965', coverage)).toEqual({ ok: true, e164: '96598765432' });
  });
  it('applies default prefix when bare national', () => {
    expect(normalize('98765432', '965', coverage)).toEqual({ ok: true, e164: '96598765432' });
  });
  it('strips leading zero then applies default prefix (UAE default)', () => {
    expect(normalize('0598745126', '971', coverage)).toEqual({ ok: true, e164: '971598745126' });
  });
  it('strips leading zero then applies default prefix (KSA default)', () => {
    expect(normalize('0598745126', '966', coverage)).toEqual({ ok: true, e164: '966598745126' });
  });
  it('rejects ambiguous input that matches multiple coverage countries', () => {
    // 0598745126 is a valid mobile in both SA (+966) and AE (+971) when parsed
    // as a national number. Strict smart-fallback requires EXACTLY ONE match;
    // on ambiguity it falls through to the default-prefix path, which also
    // fails here because 9 national digits is invalid for KW (8-digit national).
    const r = normalize('0598745126', '965', coverage);
    expect(r.ok).toBe(false);
  });
  it('returns an error result for empty input', () => {
    expect(normalize('', '965', coverage)).toEqual({ ok: false, reason: 'empty' });
  });
});
