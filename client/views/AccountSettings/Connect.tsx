import React, { useEffect, useState } from 'react';
import { api, prewarm } from '../../api/client';

interface Settings {
  connected: boolean;
  username: string | null;
  balance: { amount: number; syncedAt: number };
}

export default function Connect() {
  const [s, setS] = useState<Settings | null>(null);
  const [u, setU] = useState('');
  const [p, setP] = useState('');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [reloading, setReloading] = useState(false);

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
      setMsg('Could not log in. Check your API username and password.');
    } finally {
      setBusy(false);
    }
  }
  async function disconnect() {
    await api('/api/settings/disconnect', { method: 'POST' });
    await load();
  }
  async function reload() {
    setReloading(true);
    setMsg('');
    try {
      await prewarm();
      await api('/api/settings/reload', { method: 'POST' });
      await load();
      setMsg('Reloaded · ' + new Date().toLocaleTimeString());
    } catch (e) {
      setMsg('Reload failed: ' + String(e));
    } finally {
      setReloading(false);
    }
  }

  if (err) return (
    <div className="kwt-alert kwt-alert--danger">
      <b>Error loading settings:</b> {err}
    </div>
  );
  if (!s) return <div className="kwt-loading">Loading settings…</div>;

  return (
    <div>
      <div className="kwt-row kwt-row--between">
        <h2>Login</h2>
        <a href="https://www.kwtsms.com/login" target="_blank" rel="noreferrer" className="kwt-btn kwt-btn--ghost kwt-btn--sm">
          kwtSMS Dashboard
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" style={{ marginLeft: 4 }} aria-hidden="true">
            <path d="M6 2h8v8m0-8L6.5 9.5M3 5v8h8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </a>
      </div>
      {s.connected ? (
        <div className="kwt-card">
          <div className="kwt-row kwt-row--between">
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span className="kwt-pill kwt-pill--success">Connected</span>
                <span style={{ color: 'var(--c-ink-500)', fontSize: 13 }}>
                  as <b style={{ color: 'var(--c-ink-900)' }}>{s.username}</b>
                </span>
              </div>
              <dl className="kwt-kv kwt-mt-3">
                <dt>Balance</dt>
                <dd><b>{s.balance.amount}</b></dd>
                <dt>Last sync</dt>
                <dd>{s.balance.syncedAt ? new Date(s.balance.syncedAt).toLocaleString() : 'n/a'}</dd>
              </dl>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="kwt-btn kwt-btn--ghost" onClick={reload} disabled={reloading}>
                {reloading ? 'Reloading…' : 'Reload'}
              </button>
              <button className="kwt-btn kwt-btn--danger" onClick={disconnect}>Logout</button>
            </div>
          </div>
          {msg && (
            <div
              className={'kwt-alert kwt-mt-3 ' + (msg.startsWith('Reload failed') ? 'kwt-alert--danger' : '')}
              style={{ fontSize: 13 }}
            >
              {msg}
            </div>
          )}
        </div>
      ) : (
        <div className="kwt-card">
          <div className="kwt-field">
            <label className="kwt-label" htmlFor="kwt-u">API Username</label>
            <input id="kwt-u" className="kwt-input" placeholder="kwtSMS API username" value={u} onChange={(e) => setU(e.target.value)} />
          </div>
          <div className="kwt-field">
            <label className="kwt-label" htmlFor="kwt-p">API Password</label>
            <input id="kwt-p" className="kwt-input" type="password" placeholder="••••••••" value={p} onChange={(e) => setP(e.target.value)} />
          </div>
          <button className="kwt-btn kwt-btn--primary" onClick={connect} disabled={!u || !p || busy}>
            {busy ? 'Logging in…' : 'Login'}
          </button>
          {msg && <div className="kwt-alert kwt-alert--danger kwt-mt-3">{msg}</div>}
        </div>
      )}
    </div>
  );
}
