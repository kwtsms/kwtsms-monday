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
        <p style={{ color: 'var(--c-ink-500)', marginTop: 0, fontSize: 13 }}>
          These monday.com users will receive a bell notification when balance hits zero or the gateway goes offline.
          Enter their monday user IDs (found in monday Admin → Users).
        </p>
        <div className="kwt-field">
          <label className="kwt-label">monday user IDs (comma-separated)</label>
          <input
            className="kwt-input"
            placeholder="e.g. 28659824, 10224985"
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
