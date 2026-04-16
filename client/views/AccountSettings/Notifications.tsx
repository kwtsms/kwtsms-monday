import React, { useEffect, useState } from 'react';
import { api, monday } from '../../api/client';

interface MondayUser {
  id: string;
  name: string;
  is_admin: boolean;
}

export default function Notifications() {
  const [s, setS] = useState<any>(null);
  const [users, setUsers] = useState<MondayUser[]>([]);

  useEffect(() => {
    void (async () => setS(await api<any>('/api/settings').catch(() => null)))();
    void (async () => {
      try {
        const r: any = await monday.api(`query { users { id name is_admin } }`);
        const list = (r?.data?.users ?? []).map((u: any) => ({
          id: String(u.id),
          name: u.name,
          is_admin: !!u.is_admin,
        }));
        setUsers(list);
      } catch {
        /* ignore */
      }
    })();
  }, []);

  async function update(patch: any) {
    await api('/api/settings', { method: 'PUT', body: JSON.stringify(patch) });
    setS({ ...s, ...patch });
  }

  function toggleUser(userId: string) {
    const current: string[] = s?.notifRecipients ?? [];
    const next = current.includes(userId)
      ? current.filter((id: string) => id !== userId)
      : [...current, userId];
    update({ notifRecipients: next });
  }

  if (!s) return null;

  const selected: string[] = s.notifRecipients ?? [];

  return (
    <div>
      <h2>Notifications</h2>
      <div className="kwt-card">
        <p style={{ color: 'var(--c-ink-500)', marginTop: 0, fontSize: 13 }}>
          Select which workspace members receive a monday bell notification when balance hits zero or the gateway goes offline.
        </p>
        <div className="kwt-field">
          <label className="kwt-label">Notify these users</label>
          {users.length === 0 ? (
            <div className="kwt-hint">Loading workspace users…</div>
          ) : (
            <div style={{ maxHeight: 200, overflow: 'auto', border: '1px solid var(--c-border)', borderRadius: 'var(--r-md)', padding: 8 }}>
              {users.map((u) => (
                <label
                  key={u.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '6px 4px',
                    borderBottom: '1px solid var(--c-ink-100)',
                    cursor: 'pointer',
                    fontSize: 13,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={selected.includes(u.id)}
                    onChange={() => toggleUser(u.id)}
                  />
                  <span>
                    <b>{u.name}</b>
                    {u.is_admin && <span className="kwt-pill kwt-pill--accent" style={{ marginLeft: 6, fontSize: 10 }}>Admin</span>}
                  </span>
                </label>
              ))}
            </div>
          )}
        </div>
        <div className="kwt-row kwt-mt-3" style={{ gap: 20 }}>
          <label>
            <input
              type="checkbox"
              checked={!!s.notifEvents?.zeroBalance}
              onChange={(e) => update({ notifEvents: { ...s.notifEvents, zeroBalance: e.target.checked } })}
            />
            &nbsp;Zero balance alert
          </label>
          <label>
            <input
              type="checkbox"
              checked={!!s.notifEvents?.gatewayOffline}
              onChange={(e) => update({ notifEvents: { ...s.notifEvents, gatewayOffline: e.target.checked } })}
            />
            &nbsp;Gateway offline alert
          </label>
        </div>
      </div>
    </div>
  );
}
