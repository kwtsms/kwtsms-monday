import React, { useEffect, useState } from 'react';
import { api } from '../../api/client';

export default function Notifications() {
  const [s, setS] = useState<any>(null);
  useEffect(() => {
    void (async () => setS(await api<any>('/api/settings')))();
  }, []);
  async function update(patch: any) {
    await api('/api/settings', { method: 'PUT', body: JSON.stringify(patch) });
    setS({ ...s, ...patch });
  }
  if (!s) return null;
  return (
    <div>
      <h2>Notifications</h2>
      <p>Recipient user IDs (comma-separated):</p>
      <input
        value={(s.notifRecipients ?? []).join(',')}
        onChange={(e) => update({ notifRecipients: e.target.value.split(',').map((x: string) => x.trim()).filter(Boolean) })}
      />
      <label><input type="checkbox" checked={s.notifEvents?.zeroBalance} onChange={(e) => update({ notifEvents: { ...s.notifEvents, zeroBalance: e.target.checked } })} /> Zero balance</label>
      <label><input type="checkbox" checked={s.notifEvents?.gatewayOffline} onChange={(e) => update({ notifEvents: { ...s.notifEvents, gatewayOffline: e.target.checked } })} /> Gateway offline</label>
    </div>
  );
}
