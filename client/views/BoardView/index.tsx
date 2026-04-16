import React, { useEffect, useState } from 'react';
import mondaySdk from 'monday-sdk-js';
import { api, reportValueCreated } from '../../api/client';
import { countSms } from '../../utils/smsCount';

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

function statusPill(status: string) {
  if (status.startsWith('Delivered')) return 'kwt-pill kwt-pill--success';
  if (status.startsWith('Failed')) return 'kwt-pill kwt-pill--danger';
  if (status.startsWith('Skipped')) return 'kwt-pill kwt-pill--warn';
  return 'kwt-pill';
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
      if (r.sent > 0) reportValueCreated();
      if (ctx?.boardId) await loadLogs(String(ctx.boardId));
    } catch (e) {
      setErr('Send failed: ' + String(e));
    } finally {
      setSending(false);
    }
  }

  if (!ctx) return <div className="kwt-loading">Loading…</div>;

  const smsCount = countSms(body);

  return (
    <div className="kwtsms-settings">
      <div className="kwt-brand">
        <h1>kwtSMS</h1>
        <span className="kwt-badge">Board activity</span>
      </div>

      <section>
        <h2>Quick send</h2>
        <div className="kwt-card" style={{ maxWidth: 640 }}>
          <div className="kwt-field">
            <label className="kwt-label">To</label>
            <input className="kwt-input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+965…" />
          </div>
          <div className="kwt-field">
            <label className="kwt-label">Template</label>
            <select className="kwt-select" value={tid} onChange={(e) => pickTemplate(e.target.value)}>
              <option value="">(pick template)</option>
              {tmpls.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
          <div className="kwt-field">
            <label className="kwt-label">Message</label>
            <textarea className="kwt-textarea" value={body} onChange={(e) => setBody(e.target.value)} rows={3} />
            <div className="kwt-row kwt-mt-3" style={{ gap: 8 }}>
              <span className={'kwt-counter' + (smsCount.unicode ? ' kwt-counter--unicode' : '')}>
                {smsCount.count} chars · {smsCount.pages} page{smsCount.pages === 1 ? '' : 's'} · {smsCount.unicode ? 'Unicode (70/page)' : 'GSM (160/page)'}
              </span>
            </div>
          </div>
          <button className="kwt-btn kwt-btn--primary" onClick={doSend} disabled={!phone || !body || sending}>
            {sending ? 'Sending…' : 'Send SMS'}
          </button>
          {msg && <div className="kwt-alert kwt-mt-3">{msg}</div>}
        </div>
      </section>

      <section>
        <h2>Recent messages from this board</h2>
        {err && <div className="kwt-alert kwt-alert--danger">{err}</div>}
        <table className="kwt-table">
          <thead>
            <tr>
              <th>Time</th>
              <th>To</th>
              <th>Status</th>
              <th>Body</th>
              <th>Source</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((l) => (
              <tr key={l.logId}>
                <td>{new Date(l.timestamp).toLocaleString()}</td>
                <td>{l.to}</td>
                <td><span className={statusPill(l.status)}>{l.status}</span></td>
                <td>{l.body.slice(0, 80)}{l.body.length > 80 ? '…' : ''}</td>
                <td>{l.source}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={5} className="kwt-empty">No messages yet for this board.</td></tr>}
          </tbody>
        </table>
      </section>
    </div>
  );
}
