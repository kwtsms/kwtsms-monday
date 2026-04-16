import React, { useEffect, useState } from 'react';
import { api } from '../../api/client';

interface Log {
  logId: string;
  timestamp: number;
  to: string;
  body: string;
  status: string;
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
    try {
      await api('/api/logs/clear', { method: 'POST', body: JSON.stringify({ month }) });
      await load();
    } catch (e) {
      setErr('Clear failed: ' + String(e));
    }
  }
  return (
    <div>
      <h2>Logs</h2>
      <div className="kwt-row kwt-mb-3">
        <input className="kwt-input" style={{ width: 180 }} type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
        <button className="kwt-btn kwt-btn--ghost" onClick={clearAll}>Clear this month</button>
      </div>
      {err && <div className="kwt-alert kwt-alert--danger">{err}</div>}
      <table className="kwt-table">
        <thead>
          <tr>
            <th>Time</th>
            <th>To</th>
            <th>Status</th>
            <th>Body</th>
            <th>Sender</th>
            <th>Source</th>
            <th>Test</th>
          </tr>
        </thead>
        <tbody>
          {items.map((l) => (
            <tr key={l.logId}>
              <td>{new Date(l.timestamp).toLocaleString()}</td>
              <td>{l.to}</td>
              <td><span className={statusPill(l.status)}>{l.status}</span></td>
              <td>{l.body.slice(0, 80)}{l.body.length > 80 ? '…' : ''}</td>
              <td>{l.senderId}</td>
              <td>{l.source}</td>
              <td>{l.testMode ? <span className="kwt-pill kwt-pill--accent">test</span> : ''}</td>
            </tr>
          ))}
          {items.length === 0 && <tr><td colSpan={7} className="kwt-empty">No log entries for {month}.</td></tr>}
        </tbody>
      </table>
      <div className="kwt-row kwt-mt-3">
        <button className="kwt-btn kwt-btn--ghost kwt-btn--sm" disabled={page === 0} onClick={() => setPage(page - 1)}>← Previous</button>
        <button className="kwt-btn kwt-btn--ghost kwt-btn--sm" onClick={() => setPage(page + 1)}>Next →</button>
      </div>
    </div>
  );
}
function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
