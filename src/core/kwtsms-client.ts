// src/core/kwtsms-client.ts
import { KwtSenderId, KwtCoverageEntry, KwtSendRequest, KwtSendResponse } from '../types/kwtsms';

const API_BASE = process.env.KWTSMS_API_BASE ?? 'https://www.kwtsms.com/API';

// 2026-11-05 15:06 +03: integration name and version on every kwtSMS call (no personal data), so kwtSMS can
// count accounts per integration. Version read from package.json at runtime (src/core and
// dist/core both sit two levels below it; rootDir src rules out a JSON import), #939.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { version } = require('../../package.json') as { version: string };
export const USER_AGENT = `kwtsms-monday/${version}`;

interface AuthCreds {
  username: string;
  password: string;
}

async function post<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    // 2026-11-05 15:06 +03: User-Agent identifies the integration, #939.
    headers: { 'Content-Type': 'application/json', 'User-Agent': USER_AGENT },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`kwtSMS ${path} HTTP ${res.status}`);
  return (await res.json()) as T;
}

export class KwtSmsClient {
  async balance(creds: AuthCreds): Promise<{ amount: number }> {
    // API returns { result, available, purchased } - field is "available", not "balance"
    const r = await post<{ result?: string; available?: number | string; balance?: number | string }>(
      '/balance/',
      creds as unknown as Record<string, unknown>,
    );
    // Non-OK result means bad creds or server error
    if (r.result && r.result !== 'OK') {
      throw new Error(`kwtSMS /balance/ error: ${r.result}`);
    }
    // "available" is the primary field; fall back to "balance" for legacy shapes
    const raw = r.available ?? r.balance ?? 0;
    const amount = typeof raw === 'string' ? parseFloat(raw) : (raw as number);
    return { amount };
  }

  async senderIds(creds: AuthCreds): Promise<KwtSenderId[]> {
    // API returns { result, senderid: [...] } - field is singular "senderid", not "senderids"
    // Each entry is a plain string (e.g., "KWT-SMS"), not an object
    const r = await post<{ result?: string; senderid?: string | string[]; senderids?: KwtSenderId[] }>(
      '/senderid/',
      creds as unknown as Record<string, unknown>,
    );
    // Handle both string[] (real API) and KwtSenderId[] (future/extended shape)
    const rawList = r.senderid ?? r.senderids ?? [];
    const list = Array.isArray(rawList) ? rawList : [rawList];
    return list.map((entry) => {
      if (typeof entry === 'string') {
        // API returns plain strings; normalise to our KwtSenderId shape
        return { id: entry, name: entry, type: 'alpha' };
      }
      return entry as KwtSenderId;
    });
  }

  async coverage(creds: AuthCreds): Promise<KwtCoverageEntry[]> {
    // API returns { result, prefixes: ["965", "971", ...] } - flat string array, not an object array
    const r = await post<{
      result?: string;
      prefixes?: Array<string | number>;
      coverage?: Array<Record<string, unknown>>;
    }>('/coverage/', creds as unknown as Record<string, unknown>);

    // "prefixes" is the real API field - a flat array of prefix strings/numbers
    if (r.prefixes) {
      return r.prefixes.map((p) => ({
        countryCode: '',        // API does not return country code in this endpoint
        prefix: String(p),     // coerce numeric prefix to string
      }));
    }

    // Fallback: handle legacy object-array shape { coverage: [{ countryCode, prefix, rate }] }
    const legacy = r.coverage ?? [];
    return legacy.map((entry) => ({
      countryCode: String(entry['countrycode'] ?? entry['countryCode'] ?? ''),
      prefix: String(entry['prefix'] ?? ''),
      rate: entry['rate'] !== undefined ? Number(entry['rate']) : undefined,
    }));
  }

  async send(req: KwtSendRequest): Promise<KwtSendResponse> {
    // API field mapping:
    //   KwtSendRequest.senderid  → API field "sender"
    //   KwtSendRequest.test      → API expects string "1" or "0", not integer
    //   API response "msg-id"    → our camelCase msgId
    //   API response "code"      → our errorCode
    //   API response "description" → our errorMessage
    //   API response "balance-after" → our balance
    const { senderid, test, ...rest } = req;
    const payload: Record<string, unknown> = {
      ...rest,
      sender: senderid,
    };
    if (test !== undefined) {
      // API requires test as a string "1" or "0", not an integer
      payload['test'] = String(test);
    }

    const raw = await post<Record<string, unknown>>('/send/', payload);
    return {
      result: (raw['result'] as 'OK' | 'ERROR') ?? 'ERROR',
      // API uses hyphenated "msg-id"; map to our camelCase msgId
      msgId: (raw['msg-id'] ?? raw['msgId'] ?? raw['msg_id']) as string | undefined,
      // API uses "code" for error codes (e.g., "ERR011"); map to our errorCode
      errorCode: (raw['code'] ?? raw['errorCode'] ?? raw['error_code']) as string | undefined,
      // API uses "description" for human-readable errors; map to our errorMessage
      errorMessage: (raw['description'] ?? raw['errorMessage'] ?? raw['error_message']) as string | undefined,
      // "balance-after" is returned on successful send
      balance: raw['balance-after'] !== undefined
        ? Number(raw['balance-after'])
        : (raw['balance'] as number | undefined),
    };
  }

  async validate(creds: AuthCreds): Promise<{ ok: boolean }> {
    // API returns { result: "OK" } on valid creds
    const r = await post<{ result: string }>('/validate/', creds as unknown as Record<string, unknown>);
    return { ok: r.result === 'OK' };
  }
}
