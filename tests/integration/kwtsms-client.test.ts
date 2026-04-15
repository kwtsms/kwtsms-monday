// tests/integration/kwtsms-client.test.ts
import { KwtSmsClient } from '../../src/core/kwtsms-client';

const creds = {
  username: process.env.KWTSMS_USERNAME!,
  password: process.env.KWTSMS_PASSWORD!,
};

const skipReal = !creds.username || !creds.password;

(skipReal ? describe.skip : describe)('KwtSmsClient (real API)', () => {
  const client = new KwtSmsClient();

  it('/balance/ returns positive balance for valid creds', async () => {
    const r = await client.balance(creds);
    expect(r.amount).toBeGreaterThanOrEqual(0);
  }, 30000);

  it('/balance/ throws for bad password', async () => {
    await expect(client.balance({ ...creds, password: 'WRONG' })).rejects.toThrow();
  }, 30000);

  it('/senderid/ returns approved list', async () => {
    const r = await client.senderIds(creds);
    expect(Array.isArray(r)).toBe(true);
  }, 30000);

  it('/coverage/ returns non-empty list containing KW', async () => {
    const r = await client.coverage(creds);
    expect(r.find((c) => c.prefix === '965')).toBeTruthy();
  }, 30000);

  it('/send/ with test=1 to synthetic number returns OK with msgId', async () => {
    const r = await client.send({
      ...creds,
      senderid: 'KWT-SMS',
      mobile: '96598765432',
      message: 'test ping',
      test: 1,
    });
    expect(r.result).toBe('OK');
    expect(r.msgId).toBeTruthy();
  }, 30000);
});
