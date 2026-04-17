import React, { useEffect, useRef, useState } from 'react';
import mondaySdk from 'monday-sdk-js';
import { api, prewarm, reportValueCreated } from '../../api/client';
import ApiErrorBlock from '../../components/ApiErrorBlock';
import { countSms } from '../../utils/smsCount';
import { fetchMe } from '../../utils/templateContext';
import NewTemplateButton from '../../components/NewTemplateButton';
import PlaceholdersHelp from '../../components/PlaceholdersHelp';

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

  const [logsErr, setLogsErr] = useState<unknown>(null);
  async function loadLogs(boardId: string) {
    try {
      setErr('');
      setLogsErr(null);
      const now = new Date();
      const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const r = await api<{ entries: Log[] }>(`/api/logs?month=${month}&page=0&boardId=${encodeURIComponent(boardId)}`);
      setRows(r.entries);
    } catch (e) {
      setLogsErr(e);
    }
  }

  const [boardName, setBoardName] = useState('');
  const [boardUrl, setBoardUrl] = useState('');
  const [userBag, setUserBag] = useState<Record<string, unknown>>({});

  useEffect(() => {
    monday.get('context').then(async (r: any) => {
      setCtx(r.data);
      if (r.data?.boardId) void loadLogs(String(r.data.boardId));
      // Board View context doesn't always carry boardName; fetch it so
      // {board.name} resolves for free-form quick sends.
      try {
        const bq: any = await monday.api(
          'query($ids:[ID!]) { boards(ids:$ids) { id name url } }',
          { variables: { ids: [String(r.data?.boardId ?? '')] } },
        );
        setBoardName(String(bq?.data?.boards?.[0]?.name ?? ''));
        setBoardUrl(String(bq?.data?.boards?.[0]?.url ?? ''));
      } catch { /* ignore */ }
      setUserBag(await fetchMe());
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

  const sendLockRef = useRef(false);

  async function doSend() {
    if (sendLockRef.current) return;
    sendLockRef.current = true;
    setSending(true);
    setMsg('');
    try {
      await prewarm();
      const numbers = [...new Set(
        phone.split(/[,;\s]+/).map((n) => n.trim()).filter(Boolean)
      )];
      const targets = numbers.map((n) => ({
        phoneRaw: n,
        ctx: {
          item: {},
          columns: {},
          board: {
            id: String(ctx?.boardId ?? ''),
            name: boardName || String((ctx as any)?.boardName ?? ''),
            url: boardUrl,
          },
          user: (() => {
            const ctxName = String((ctx as any)?.user?.name ?? '');
            const merged = { ...userBag };
            if (ctxName && !merged.name) merged.name = ctxName;
            return merged;
          })(),
        },
        boardId: String(ctx?.boardId ?? ''),
      }));
      const r = await api<{ sent: number; skipped: number; failed: number; placeholderWarnings?: string[] }>('/api/send', {
        method: 'POST',
        body: JSON.stringify({ source: 'bulk_board', body, targets }),
      });
      const warn = r.placeholderWarnings && r.placeholderWarnings.length
        ? ` · empty: ${r.placeholderWarnings.join(', ')}`
        : '';
      setMsg(`Sent ${r.sent}, skipped ${r.skipped}, failed ${r.failed}${warn}`);
      if (r.sent > 0) reportValueCreated();
      if (ctx?.boardId) await loadLogs(String(ctx.boardId));
    } catch (e) {
      setErr('Send failed: ' + String(e));
    } finally {
      sendLockRef.current = false;
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
            <input className="kwt-input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="96598765432, 96591234567 .." />
          </div>
          <div className="kwt-field">
            <div className="kwt-row kwt-row--between" style={{ marginBottom: 6 }}>
              <label className="kwt-label" style={{ margin: 0 }}>Template</label>
              <NewTemplateButton
                onCreated={(t) => {
                  setTmpls((xs) => [...xs, t]);
                  setTid(t.id);
                  setBody(t.body);
                }}
              />
            </div>
            <select className="kwt-select" value={tid} onChange={(e) => pickTemplate(e.target.value)}>
              <option value="">(pick template)</option>
              {tmpls.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
          <div className="kwt-field">
            <div className="kwt-row" style={{ marginBottom: 6 }}>
              <label className="kwt-label" style={{ margin: 0 }}>Message</label>
              <PlaceholdersHelp />
            </div>
            <textarea className="kwt-textarea" value={body} onChange={(e) => setBody(e.target.value)} rows={3} />
            <div className="kwt-row kwt-mt-3" style={{ gap: 8 }}>
              <span className={'kwt-counter' + (smsCount.unicode ? ' kwt-counter--unicode' : '')}>
                {smsCount.count} chars · {smsCount.pages} page{smsCount.pages === 1 ? '' : 's'} · {smsCount.unicode ? 'Arabic' : 'English'}
              </span>
            </div>
          </div>
          <button className="kwt-btn kwt-btn--primary" onClick={doSend} disabled={!phone || !body || sending}>
            {sending ? 'Sending…' : 'Send SMS'}
          </button>
          {msg && <div className="kwt-alert kwt-mt-3">{msg}</div>}
          <div className="kwt-hint" style={{ background: '#fff4e0', color: '#b66200', padding: '8px 12px', borderRadius: 6, marginTop: 14, fontSize: 12 }}>
            Board-level quick send: <code>{`{item.*}`}</code> and <code>{`{column.*}`}</code> placeholders have no item to resolve against and will substitute to empty.
          </div>
        </div>
      </section>

      <section>
        <h2>Recent messages from this board</h2>
        {err && <div className="kwt-alert kwt-alert--danger">{err}</div>}
        {logsErr && ctx?.boardId && (
          <ApiErrorBlock
            label="Load logs failed"
            error={logsErr}
            onRetry={() => loadLogs(String(ctx.boardId))}
          />
        )}
        <table className="kwt-table">
          <thead>
            <tr>
              <th>Time</th>
              <th>To</th>
              <th>Body</th>
              <th>Source</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((l) => (
              <tr key={l.logId}>
                <td>{new Date(l.timestamp).toLocaleString()}</td>
                <td>{l.to}</td>
                <td title={l.body} style={{ cursor: l.body.length > 80 ? 'help' : 'default' }}>{l.body.slice(0, 80)}{l.body.length > 80 ? '…' : ''}</td>
                <td>{l.source}</td>
                <td><span className={statusPill(l.status)}>{l.status}</span></td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={5} className="kwt-empty">No messages yet for this board.</td></tr>}
          </tbody>
        </table>
      </section>
    </div>
  );
}
