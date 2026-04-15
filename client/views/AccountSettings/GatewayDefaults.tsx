import React, { useEffect, useState } from 'react';
import { api } from '../../api/client';

export default function GatewayDefaults() {
  const [s, setS] = useState<any>(null);
  useEffect(() => {
    void (async () => setS(await api<any>('/api/settings')))();
  }, []);
  async function update(patch: Record<string, unknown>) {
    await api('/api/settings', { method: 'PUT', body: JSON.stringify(patch) });
    setS({ ...s, ...patch });
  }
  if (!s) return null;
  return (
    <div>
      <h2>Gateway defaults</h2>
      <label>Default sender ID
        <select value={s.defaultSenderId} onChange={(e) => update({ defaultSenderId: e.target.value })}>
          {(s.senderIds ?? []).map((x: any) => <option key={x.id} value={x.id}>{x.name ?? x.id}</option>)}
        </select>
      </label>
      <label>Default country prefix
        <input value={s.defaultCountryPrefix} onChange={(e) => update({ defaultCountryPrefix: e.target.value })} />
      </label>
      <label><input type="checkbox" checked={s.testMode} onChange={(e) => update({ testMode: e.target.checked })} /> Test mode</label>
      <label><input type="checkbox" checked={s.globalEnabled} onChange={(e) => update({ globalEnabled: e.target.checked })} /> Globally enabled</label>
      <label><input type="checkbox" checked={s.debugLogs} onChange={(e) => update({ debugLogs: e.target.checked })} /> Debug logs</label>
    </div>
  );
}
