import React, { useEffect, useState } from 'react';
import { api } from '../../api/client';

export default function History({ itemId }: { itemId: string }) {
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => {
    void (async () => {
      const now = new Date();
      const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const r = await api<{ entries: any[] }>(`/api/logs?month=${month}&page=0`);
      setRows(r.entries.filter((e) => e.itemId === itemId));
    })();
  }, [itemId]);
  return (
    <div>
      <h3>History</h3>
      {rows.length === 0 ? <p>No messages yet.</p> : (
        <ul>
          {rows.map((r) => (
            <li key={r.logId}>
              <b>{r.status}</b> {new Date(r.timestamp).toLocaleString()} to {r.to} via {r.senderId}, "{r.body.slice(0, 80)}"
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
