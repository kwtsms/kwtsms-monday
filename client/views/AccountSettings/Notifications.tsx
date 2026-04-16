import React, { useEffect, useState } from 'react';
import { api } from '../../api/client';

export default function Notifications() {
  const [s, setS] = useState<any>(null);
  useEffect(() => {
    void (async () => setS(await api<any>('/api/settings').catch(() => null)))();
  }, []);
  async function update(patch: any) {
    await api('/api/settings', { method: 'PUT', body: JSON.stringify(patch) });
    setS({ ...s, ...patch });
  }
  if (!s) return null;
  return (
    <div>
      <h2>Notifications</h2>
      <div className="kwt-card">
        <div className="kwt-field">
          <label className="kwt-label">Recipient user IDs</label>
          <input
            className="kwt-input"
            placeholder="e.g. 28659824, 10224985 (comma-separated)"
            value={(s.notifRecipients ?? []).join(', ')}
            onChange={(e) =>
              update({
                notifRecipients: e.target.value
                  .split(',')
                  .map((x: string) => x.trim())
                  .filter(Boolean),
              })
            }
          />
          <div className="kwt-hint">These users will get a monday notification bell on critical events.</div>
        </div>
        <div className="kwt-row kwt-mt-3" style={{ gap: 20 }}>
          <label>
            <input
              type="checkbox"
              checked={!!s.notifEvents?.zeroBalance}
              onChange={(e) => update({ notifEvents: { ...s.notifEvents, zeroBalance: e.target.checked } })}
            />
            &nbsp;Zero balance
          </label>
          <label>
            <input
              type="checkbox"
              checked={!!s.notifEvents?.gatewayOffline}
              onChange={(e) => update({ notifEvents: { ...s.notifEvents, gatewayOffline: e.target.checked } })}
            />
            &nbsp;Gateway offline
          </label>
        </div>
      </div>
    </div>
  );
}
