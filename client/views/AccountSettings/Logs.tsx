import React, { useEffect, useState } from 'react';
import { api } from '../../api/client';

interface Log { logId: string; timestamp: number; to: string; body: string; status: string; senderId: string; source: string; testMode: boolean; }

export default function Logs() {
  const [items, setItems] = useState<Log[]>([]);
  const [month, setMonth] = useState(currentMonth());
  const [page, setPage] = useState(0);

  async function load() {
    const r = await api<{ entries: Log[] }>(`/api/logs?month=${month}&page=${page}`);
    setItems(r.entries);
  }
  useEffect(() => { void load(); }, [month, page]);

  async function clearAll() {
    await api('/api/logs/clear', { method: 'POST', body: JSON.stringify({ month }) });
    await load();
  }
  return (
    <div>
      <h2>Logs</h2>
      <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
      <button onClick={clearAll}>Clear all (this month)</button>
      <table>
        <thead><tr><th>Time</th><th>To</th><th>Body</th><th>Status</th><th>Sender</th><th>Source</th><th>Test</th></tr></thead>
        <tbody>
          {items.map((l) => (
            <tr key={l.logId}>
              <td>{new Date(l.timestamp).toLocaleString()}</td>
              <td>{l.to}</td>
              <td>{l.body.slice(0, 60)}</td>
              <td>{l.status}</td>
              <td>{l.senderId}</td>
              <td>{l.source}</td>
              <td>{l.testMode ? 'test' : ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div>
        <button disabled={page === 0} onClick={() => setPage(page - 1)}>Prev</button>
        <button onClick={() => setPage(page + 1)}>Next</button>
      </div>
    </div>
  );
}
function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
