import { parsePhoneNumberFromString, CountryCode } from 'libphonenumber-js';

export interface CoverageEntry {
  countryCode: string;
  prefix: string;
}

export interface NormalizeResult {
  ok: boolean;
  e164?: string;
  reason?: string;
}

const PREFIX_TO_CC: Record<string, CountryCode> = {
  '965': 'KW',
  '966': 'SA',
  '971': 'AE',
  '973': 'BH',
  '974': 'QA',
  '968': 'OM',
};

// Arabic-Indic (U+0660-U+0669) and Eastern Arabic-Indic / Persian
// (U+06F0-U+06F9) digit ranges; fold to ASCII before the strip.
function foldDigits(s: string): string {
  return s.replace(/[\u0660-\u0669\u06F0-\u06F9]/g, (ch) => {
    const code = ch.charCodeAt(0);
    return String(code >= 0x06F0 ? code - 0x06F0 : code - 0x0660);
  });
}

function stripSep(s: string): string {
  return foldDigits(s).replace(/[^\d+]/g, '');
}

function tryParse(raw: string, cc: CountryCode): { e164: string; mobile: boolean } | null {
  const p = parsePhoneNumberFromString(raw, cc);
  if (!p || !p.isValid()) return null;
  const type = p.getType();
  const mobile = type === 'MOBILE' || type === 'FIXED_LINE_OR_MOBILE' || type === undefined;
  return { e164: p.number.replace('+', ''), mobile };
}

export function normalize(
  input: string,
  defaultPrefix: string,
  coverage: CoverageEntry[],
): NormalizeResult {
  if (!input) return { ok: false, reason: 'empty' };
  let raw = stripSep(input);
  if (raw.startsWith('00')) raw = '+' + raw.slice(2);

  if (raw.startsWith('+')) {
    const anyCountry = coverage
      .map((c) => PREFIX_TO_CC[c.prefix])
      .find((cc) => cc && tryParse(raw, cc));
    if (!anyCountry) return { ok: false, reason: 'invalid-international' };
    const parsed = tryParse(raw, anyCountry);
    if (!parsed) return { ok: false, reason: 'invalid-international' };
    if (!parsed.mobile) return { ok: false, reason: 'not-mobile' };
    return { ok: true, e164: parsed.e164 };
  }

  for (const c of coverage) {
    if (raw.startsWith(c.prefix)) {
      const attempt = tryParse('+' + raw, PREFIX_TO_CC[c.prefix]);
      if (attempt && attempt.mobile) return { ok: true, e164: attempt.e164 };
    }
  }

  const defaultCC = PREFIX_TO_CC[defaultPrefix];
  if (!defaultCC) return { ok: false, reason: 'unknown-default-prefix' };

  // Try default country first with the raw input
  const national = raw.startsWith('0') ? raw.slice(1) : raw;
  const withDefault = tryParse('+' + defaultPrefix + national, defaultCC);
  if (withDefault && withDefault.mobile) return { ok: true, e164: withDefault.e164 };

  // Fallback: try other countries in coverage. If one or more match, pick
  // the first valid mobile. Prior behaviour rejected on ambiguity which made
  // typical bare national GCC numbers (valid in multiple countries) fail;
  // first-match is opinionated but predictable and matches how humans read
  // the coverage list.
  const matches = coverage
    .filter((c) => c.prefix !== defaultPrefix)
    .reverse()
    .map((c) => {
      const cc = PREFIX_TO_CC[c.prefix];
      const parsed = cc ? tryParse('+' + c.prefix + national, cc as CountryCode) : null;
      return { parsed, prefix: c.prefix };
    })
    .filter((x) => x.parsed && x.parsed.mobile);
  if (matches.length > 0) {
    return { ok: true, e164: matches[0].parsed!.e164 };
  }

  if (!withDefault) return { ok: false, reason: 'invalid-for-default-country' };
  return { ok: false, reason: 'not-mobile' };
}
