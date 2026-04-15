import React, { useEffect, useState } from 'react';
import mondaySdk from 'monday-sdk-js';
import { api } from '../../api/client';

const monday = mondaySdk();

export default function SendOne() {
  const [ctx, setCtx] = useState<any>(null);
  const [tmpls, setTmpls] = useState<any[]>([]);
  const [tid, setTid] = useState('');
  const [body, setBody] = useState('');
  const [phone, setPhone] = useState('');
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    monday.get('context').then((r: any) => {
      setCtx(r.data);
      setPhone(r.data?.itemPhone ?? '');
    });
    void (async () => setTmpls(await api<any[]>('/api/templates')))();
  }, []);

  function pickTemplate(id: string) {
    setTid(id);
    const t = tmpls.find((x) => x.id === id);
    setBody(t?.body ?? '');
  }

  async function doSend() {
    setSending(true);
    setMsg('');
    try {
      const r = await api<{ sent: number; failed: number; skipped: number }>('/api/send', {
        method: 'POST',
        body: JSON.stringify({
          source: 'item_view',
          body,
          targets: [
            {
              phoneRaw: phone,
              ctx: {
                item: { id: String(ctx?.itemId ?? ''), name: ctx?.itemName ?? '' },
                columns: ctx?.columns ?? {},
                board: { name: ctx?.boardName ?? '' },
                user: {},
              },
              itemId: String(ctx?.itemId ?? ''),
              boardId: String(ctx?.boardId ?? ''),
            },
          ],
        }),
      });
      setMsg(`Sent ${r.sent}, skipped ${r.skipped}, failed ${r.failed}`);
    } catch (e) {
      setMsg('Send failed: ' + String(e));
    } finally {
      setSending(false);
    }
  }

  const pages = Math.max(1, Math.ceil(body.length / 160));

  if (!ctx) return <p style={{ padding: 12 }}>Loading...</p>;

  return (
    <div style={{ padding: 16, fontFamily: 'system-ui, sans-serif' }}>
      <h3 style={{ marginTop: 0 }}>Send SMS via kwtSMS</h3>
      <div>Item: <b>{ctx.itemName}</b></div>
      <div style={{ marginTop: 12 }}>
        <label>To:</label>
      </div>
      <div>
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="phone number"
          style={{ width: '100%', padding: 6 }}
        />
      </div>
      <div style={{ marginTop: 12 }}>
        <label>Template:</label>
      </div>
      <div>
        <select value={tid} onChange={(e) => pickTemplate(e.target.value)} style={{ width: '100%', padding: 6 }}>
          <option value="">(pick template)</option>
          {tmpls.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </div>
      <div style={{ marginTop: 12 }}>
        <label>Message:</label>
      </div>
      <div>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={4}
          style={{ width: '100%', padding: 6 }}
        />
      </div>
      <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>
        {body.length} chars, {pages} page(s)
      </div>
      <div style={{ marginTop: 12 }}>
        <button onClick={doSend} disabled={!phone || !body || sending}>
          {sending ? 'Sending...' : 'Send SMS'}
        </button>
      </div>
      {msg && <p style={{ marginTop: 8 }}>{msg}</p>}
    </div>
  );
}
