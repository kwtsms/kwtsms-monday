import React, { useEffect, useState } from 'react';
import { api } from '../../api/client';

interface Log {
  logId: string;
  timestamp: number;
  to: string;
  body: string;
  status: string;
  statusReason?: string;
  errorCode?: string;
  errorMsg?: string;
  senderId: string;
  source: string;
  testMode: boolean;
}

function statusPill(status: string) {
  if (status.startsWith('Delivered')) return 'kwt-pill kwt-pill--success';
  if (status.startsWith('Failed')) return 'kwt-pill kwt-pill--danger';
  if (status.startsWith('Skipped')) return 'kwt-pill kwt-pill--warn';
  return 'kwt-pill';
}

export default function Logs() {
  const [items, setItems] = useState<Log[]>([]);
  const [month, setMonth] = useState(currentMonth());
  const [page, setPage] = useState(0);
  const [err, setErr] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [clearing, setClearing] = useState(false);

  async function load() {
    try {
      setErr('');
      const r = await api<{ entries: Log[] }>(`/api/logs?month=${month}&page=${page}`);
      setItems(r.entries);
    } catch (e) {
      setErr('Load logs failed: ' + String(e));
    }
  }
  useEffect(() => { void load(); }, [month, page]);

  async function clearAll() {
    setClearing(true);
    try {
      await api('/api/logs/clear', { method: 'POST', body: JSON.stringify({ month }) });
      await load();
      setConfirmOpen(false);
    } catch (e) {
      setErr('Clear failed: ' + String(e));
    } finally {
      setClearing(false);
    }
  }
  return (
    <div>
      <h2>Logs</h2>
      <div className="kwt-row kwt-mb-3">
        <input className="kwt-input" style={{ width: 180 }} type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
      </div>
      {err && <div className="kwt-alert kwt-alert--danger">{err}</div>}
      <table className="kwt-table">
        <thead>
          <tr>
            <th>Time</th>
            <th>To</th>
            <th>Body</th>
            <th>Sender</th>
            <th>Source</th>
            <th>Test</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {items.map((l) => (
            <tr key={l.logId}>
              <td>{new Date(l.timestamp).toLocaleString()}</td>
              <td>{l.to}</td>
              <td title={l.body} style={{ cursor: l.body.length > 80 ? 'help' : 'default' }}>{l.body.slice(0, 80)}{l.body.length > 80 ? '…' : ''}</td>
              <td>{l.senderId}</td>
              <td>{l.source}</td>
              <td>{l.testMode ? <span className="kwt-pill kwt-pill--accent">test</span> : ''}</td>
              <td>
                <span className={statusPill(l.status)}>{l.status}</span>
                {(l.statusReason || l.errorCode) && (
                  <div style={{ fontSize: 11, color: 'var(--c-ink-500)', marginTop: 2 }}>
                    {l.statusReason || l.errorCode}{l.errorMsg ? `: ${l.errorMsg}` : ''}
                  </div>
                )}
              </td>
            </tr>
          ))}
          {items.length === 0 && <tr><td colSpan={7} className="kwt-empty">No log entries for {month}.</td></tr>}
        </tbody>
      </table>
      <div className="kwt-row kwt-row--between kwt-mt-3">
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="kwt-btn kwt-btn--ghost kwt-btn--sm" disabled={page === 0} onClick={() => setPage(page - 1)}>← Previous</button>
          <button className="kwt-btn kwt-btn--ghost kwt-btn--sm" onClick={() => setPage(page + 1)}>Next →</button>
        </div>
        <button
          className="kwt-btn kwt-btn--danger kwt-btn--sm"
          onClick={() => setConfirmOpen(true)}
          disabled={items.length === 0}
        >
          Clear this month
        </button>
      </div>

      {confirmOpen && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => !clearing && setConfirmOpen(false)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(22,26,51,0.4)',
            zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#fff', borderRadius: 10, width: 440, maxWidth: '92vw',
              boxShadow: '0 24px 48px rgba(22,26,51,0.25)', padding: 20,
            }}
          >
            <h3 style={{ margin: 0, marginBottom: 10, fontSize: 16, fontWeight: 700, color: '#d7263d' }}>
              Clear all logs for {month}?
            </h3>
            <p style={{ margin: 0, marginBottom: 14, fontSize: 13, color: '#434345', lineHeight: 1.5 }}>
              This permanently deletes every log entry for this month from this app. Messages you sent still live in your kwtSMS account dashboard — this only clears the local app history. This cannot be undone.
            </p>
            <div className="kwt-row kwt-row--between">
              <button className="kwt-btn kwt-btn--ghost" onClick={() => setConfirmOpen(false)} disabled={clearing}>
                Cancel
              </button>
              <button className="kwt-btn kwt-btn--danger" onClick={clearAll} disabled={clearing}>
                {clearing ? 'Clearing…' : 'Clear logs'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
