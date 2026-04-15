import React, { useEffect, useState } from 'react';
import mondaySdk from 'monday-sdk-js';
import { api } from '../../api/client';

const monday = mondaySdk();

interface Log {
  logId: string;
  timestamp: number;
  to: string;
  body: string;
  status: string;
  senderId: string;
  source: string;
  testMode: boolean;
  itemId?: string;
  boardId?: string;
}

export default function BoardView() {
  const [ctx, setCtx] = useState<any>(null);
  const [rows, setRows] = useState<Log[]>([]);
  const [err, setErr] = useState('');
  const [phone, setPhone] = useState('');
  const [body, setBody] = useState('');
  const [tmpls, setTmpls] = useState<any[]>([]);
  const [tid, setTid] = useState('');
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState('');

  async function loadLogs(boardId: string) {
    try {
      setErr('');
      const now = new Date();
      const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const r = await api<{ entries: Log[] }>(`/api/logs?month=${month}&page=0`);
      setRows(r.entries.filter((e) => e.boardId === boardId));
    } catch (e) {
      setErr('Load logs failed: ' + String(e));
    }
  }

  useEffect(() => {
    monday.get('context').then((r: any) => {
      setCtx(r.data);
      if (r.data?.boardId) void loadLogs(String(r.data.boardId));
    });
    void (async () => {
      try {
        setTmpls(await api<any[]>('/api/templates'));
      } catch {
        /* ignore */
      }
    })();
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
      const r = await api<{ sent: number; skipped: number; failed: number }>('/api/send', {
        method: 'POST',
        body: JSON.stringify({
          source: 'item_view',
          body,
          targets: [
            {
              phoneRaw: phone,
              ctx: { item: {}, columns: {}, board: { name: ctx?.boardName ?? '' }, user: {} },
              boardId: String(ctx?.boardId ?? ''),
            },
          ],
        }),
      });
      setMsg(`Sent ${r.sent}, skipped ${r.skipped}, failed ${r.failed}`);
      if (ctx?.boardId) await loadLogs(String(ctx.boardId));
    } catch (e) {
      setErr('Send failed: ' + String(e));
    } finally {
      setSending(false);
    }
  }

  if (!ctx) return <p style={{ padding: 16 }}>Loading...</p>;

  const pages = Math.max(1, Math.ceil(body.length / 160));

  return (
    <div style={{ padding: 16, fontFamily: 'system-ui, sans-serif' }}>
      <h2 style={{ marginTop: 0 }}>kwtSMS - Board activity</h2>

      <section style={{ marginTop: 16, paddingBottom: 16, borderBottom: '1px solid #eee' }}>
        <h3>Quick send</h3>
        <div>
          <label>To:</label>
        </div>
        <div>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="phone number"
            style={{ width: 320, padding: 6 }}
          />
        </div>
        <div style={{ marginTop: 8 }}>
          <label>Template:</label>
        </div>
        <div>
          <select value={tid} onChange={(e) => pickTemplate(e.target.value)} style={{ width: 320, padding: 6 }}>
            <option value="">(pick template)</option>
            {tmpls.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
        <div style={{ marginTop: 8 }}>
          <label>Message:</label>
        </div>
        <div>
          <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={3} style={{ width: 500, padding: 6 }} />
        </div>
        <div style={{ fontSize: 12, color: '#666' }}>
          {body.length} chars, {pages} page(s)
        </div>
        <div style={{ marginTop: 8 }}>
          <button onClick={doSend} disabled={!phone || !body || sending}>
            {sending ? 'Sending...' : 'Send SMS'}
          </button>
        </div>
        {msg && <p style={{ marginTop: 8 }}>{msg}</p>}
      </section>

      <section style={{ marginTop: 16 }}>
        <h3>Recent messages from this board</h3>
        {err && <p style={{ color: 'crimson' }}>{err}</p>}
        {rows.length === 0 ? (
          <p style={{ color: '#888' }}>No messages yet.</p>
        ) : (
          <table style={{ borderCollapse: 'collapse', width: '100%' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: 6 }}>Time</th>
                <th style={{ textAlign: 'left', padding: 6 }}>To</th>
                <th style={{ textAlign: 'left', padding: 6 }}>Status</th>
                <th style={{ textAlign: 'left', padding: 6 }}>Body</th>
                <th style={{ textAlign: 'left', padding: 6 }}>Source</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((l) => (
                <tr key={l.logId}>
                  <td style={{ padding: 6 }}>{new Date(l.timestamp).toLocaleString()}</td>
                  <td style={{ padding: 6 }}>{l.to}</td>
                  <td style={{ padding: 6 }}>{l.status}</td>
                  <td style={{ padding: 6 }}>{l.body.slice(0, 60)}</td>
                  <td style={{ padding: 6 }}>{l.source}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
