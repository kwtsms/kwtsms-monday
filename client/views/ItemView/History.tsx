import React, { useEffect, useState } from 'react';
import { api } from '../../api/client';

function statusPill(status: string) {
  if (status.startsWith('Delivered')) return 'kwt-pill kwt-pill--success';
  if (status.startsWith('Failed')) return 'kwt-pill kwt-pill--danger';
  if (status.startsWith('Skipped')) return 'kwt-pill kwt-pill--warn';
  return 'kwt-pill';
}

export default function History({ itemId }: { itemId: string }) {
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => {
    void (async () => {
      try {
        const now = new Date();
        const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        const r = await api<{ entries: any[] }>(`/api/logs?month=${month}&page=0&itemId=${encodeURIComponent(itemId)}`);
        setRows(r.entries);
      } catch {
        /* silently - kwt-empty shows */
      }
    })();
  }, [itemId]);

  return (
    <div className="kwt-card kwt-mt-3">
      <h3>History</h3>
      {rows.length === 0 ? (
        <div style={{ color: 'var(--c-ink-500)', fontStyle: 'italic' }}>No messages yet.</div>
      ) : (
        <div style={{ display: 'grid', gap: 8 }}>
          {rows.map((r) => (
            <div key={r.logId} style={{ padding: '8px 12px', background: 'var(--c-surface-alt)', borderRadius: 8, border: '1px solid var(--c-border)' }}>
              <div className="kwt-row kwt-row--between">
                <span style={{ fontSize: 12, color: 'var(--c-ink-500)' }}>{new Date(r.timestamp).toLocaleString()}</span>
                <span className={statusPill(r.status)}>{r.status}</span>
              </div>
              {(r.statusReason || r.errorCode) && (
                <div style={{ fontSize: 11, color: 'var(--c-ink-500)', marginTop: 2, fontStyle: 'italic' }}>
                  {r.statusReason || r.errorCode}{r.errorMsg ? `: ${r.errorMsg}` : ''}
                </div>
              )}
              <div style={{ fontSize: 12, color: 'var(--c-ink-500)', marginTop: 4 }}>
                to {r.to} · via {r.senderId}
              </div>
              <div style={{ fontSize: 13, marginTop: 4 }} title={r.body}>
                {r.body.slice(0, 120)}{r.body.length > 120 ? '…' : ''}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
