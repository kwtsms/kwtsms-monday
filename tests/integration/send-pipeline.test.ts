import { send } from '../../src/core/send-pipeline';
import { setConfig, getConfig } from '../../src/storage/config-store';
import { setKwtCreds } from '../../src/storage/secret-store';
import { DEFAULT_CONFIG } from '../../src/types/config';

const acc = 'test-account-' + Date.now();
const username = process.env.KWTSMS_USERNAME!;
const password = process.env.KWTSMS_PASSWORD!;
const skip = !username || !password;

(skip ? describe.skip : describe)('send-pipeline (real API, test=1)', () => {
  beforeAll(async () => {
    await setKwtCreds(acc, { username, password });
    await setConfig(acc, {
      ...DEFAULT_CONFIG,
      connected: true,
      defaultSenderId: 'KWT-SMS',
      testMode: true,
      balance: { amount: 100, syncedAt: Date.now() },
      coverage: [{ countryCode: 'KW', prefix: '965' }],
    });
  });

  it('sends a single message with test=1', async () => {
    const r = await send([{ phoneRaw: '96598765432', ctx: {} }], {
      accountId: acc, source: 'item_view', body: 'hello {item.name}',
      mondayAccessToken: 'dev', postBell: async () => {},
    });
    expect(r.sent).toBe(1);
  }, 30000);

  it('skips duplicate within 60s', async () => {
    await send([{ phoneRaw: '96598765432', ctx: {} }], {
      accountId: acc, source: 'item_view', body: 'same body',
      mondayAccessToken: 'dev', postBell: async () => {},
    });
    const r = await send([{ phoneRaw: '96598765432', ctx: {} }], {
      accountId: acc, source: 'item_view', body: 'same body',
      mondayAccessToken: 'dev', postBell: async () => {},
    });
    expect(r.skipped).toBeGreaterThanOrEqual(1);
  }, 30000);

  it('skips on zero balance', async () => {
    const cfg = await getConfig(acc);
    cfg.balance.amount = 0;
    await setConfig(acc, cfg);
    const r = await send([{ phoneRaw: '96598765432', ctx: {} }], {
      accountId: acc, source: 'item_view', body: 'will skip',
      mondayAccessToken: 'dev', postBell: async () => {},
    });
    expect(r.skipped).toBe(1);
  }, 30000);
});
