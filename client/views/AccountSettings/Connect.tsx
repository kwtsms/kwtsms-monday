import React, { useEffect, useState } from 'react';
import { api } from '../../api/client';

interface Settings {
  connected: boolean;
  usernameMasked: string | null;
  balance: { amount: number; syncedAt: number };
}

export default function Connect() {
  const [s, setS] = useState<Settings | null>(null);
  const [u, setU] = useState('');
  const [p, setP] = useState('');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      setErr('');
      const data = await api<Settings>('/api/settings');
      setS(data);
    } catch (e) {
      setErr(String(e));
    }
  }
  useEffect(() => { void load(); }, []);

  async function connect() {
    setMsg('');
    setBusy(true);
    try {
      await api('/api/settings/connect', {
        method: 'POST',
        body: JSON.stringify({ username: u, password: p }),
      });
      await load();
    } catch {
      setMsg('Could not connect. Check username and password.');
    } finally {
      setBusy(false);
    }
  }
  async function disconnect() {
    await api('/api/settings/disconnect', { method: 'POST' });
    await load();
  }

  if (err) return (
    <div className="kwt-alert kwt-alert--danger">
      <b>Error loading settings:</b> {err}
    </div>
  );
  if (!s) return <div className="kwt-loading">Loading settings…</div>;

  return (
    <div>
      <h2>Connect</h2>
      {s.connected ? (
        <div className="kwt-card">
          <div className="kwt-row kwt-row--between">
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span className="kwt-pill kwt-pill--success">Connected</span>
                <span style={{ color: 'var(--c-ink-500)', fontSize: 13 }}>
                  as <b style={{ color: 'var(--c-ink-900)' }}>{s.usernameMasked}</b>
                </span>
              </div>
              <dl className="kwt-kv kwt-mt-3">
                <dt>Balance</dt>
                <dd><b>{s.balance.amount}</b></dd>
                <dt>Last sync</dt>
                <dd>{s.balance.syncedAt ? new Date(s.balance.syncedAt).toLocaleString() : '—'}</dd>
              </dl>
            </div>
            <button className="kwt-btn kwt-btn--danger" onClick={disconnect}>Disconnect</button>
          </div>
        </div>
      ) : (
        <div className="kwt-card">
          <p style={{ color: 'var(--c-ink-500)', marginTop: 0 }}>
            Enter your kwtSMS gateway credentials. We validate against the live API before saving.
          </p>
          <div className="kwt-field">
            <label className="kwt-label" htmlFor="kwt-u">Username</label>
            <input id="kwt-u" className="kwt-input" placeholder="kwtsms username" value={u} onChange={(e) => setU(e.target.value)} />
          </div>
          <div className="kwt-field">
            <label className="kwt-label" htmlFor="kwt-p">Password</label>
            <input id="kwt-p" className="kwt-input" type="password" placeholder="••••••••" value={p} onChange={(e) => setP(e.target.value)} />
          </div>
          <button className="kwt-btn kwt-btn--primary" onClick={connect} disabled={!u || !p || busy}>
            {busy ? 'Connecting…' : 'Connect'}
          </button>
          {msg && <div className="kwt-alert kwt-alert--danger kwt-mt-3">{msg}</div>}
        </div>
      )}
    </div>
  );
}
