import React, { useEffect, useState } from 'react';
import { api } from '../../api/client';

export default function GatewayDefaults() {
  const [s, setS] = useState<any>(null);
  useEffect(() => {
    void (async () => setS(await api<any>('/api/settings').catch(() => null)))();
  }, []);
  async function update(patch: Record<string, unknown>) {
    await api('/api/settings', { method: 'PUT', body: JSON.stringify(patch) });
    setS({ ...s, ...patch });
  }
  if (!s) return null;

  const coveragePrefixes: string[] = (s.coverage ?? []).map((c: any) => String(c.prefix));
  if (coveragePrefixes.length === 0) coveragePrefixes.push('965');
  if (!coveragePrefixes.includes(s.defaultCountryPrefix)) {
    coveragePrefixes.unshift(s.defaultCountryPrefix);
  }

  return (
    <div>
      <h2>Gateway defaults</h2>
      <div className="kwt-card">
        <div className="kwt-field">
          <label className="kwt-label">Default sender ID</label>
          <select
            className="kwt-select"
            value={s.defaultSenderId}
            onChange={(e) => update({ defaultSenderId: e.target.value })}
          >
            {(s.senderIds ?? []).length === 0 && <option value={s.defaultSenderId}>{s.defaultSenderId}</option>}
            {(s.senderIds ?? []).map((x: any) => (
              <option key={x.id ?? x.name} value={x.id ?? x.name}>
                {x.name ?? x.id}
              </option>
            ))}
          </select>
          <div className="kwt-hint">Must be pre-approved by kwtSMS on your account.</div>
        </div>

        <div className="kwt-field">
          <label className="kwt-label">Default country prefix</label>
          <select
            className="kwt-select"
            value={s.defaultCountryPrefix}
            onChange={(e) => update({ defaultCountryPrefix: e.target.value })}
          >
            {coveragePrefixes.map((p: string) => (
              <option key={p} value={p}>+{p}</option>
            ))}
          </select>
          <div className="kwt-hint">Applied to bare national numbers (no + or 00 prefix).</div>
        </div>

        <div className="kwt-row kwt-mt-3" style={{ gap: 20 }}>
          <label>
            <input type="checkbox" checked={!!s.globalEnabled} onChange={(e) => update({ globalEnabled: e.target.checked })} />
            &nbsp;Globally enabled
          </label>
          <label>
            <input type="checkbox" checked={!!s.testMode} onChange={(e) => update({ testMode: e.target.checked })} />
            &nbsp;Test mode
          </label>
          <label>
            <input type="checkbox" checked={!!s.debugLogs} onChange={(e) => update({ debugLogs: e.target.checked })} />
            &nbsp;Verbose debug logs
          </label>
        </div>
      </div>
    </div>
  );
}
