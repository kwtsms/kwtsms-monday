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

  async function load() {
    setS(await api<Settings>('/api/settings'));
  }
  useEffect(() => { void load(); }, []);

  async function connect() {
    setMsg('');
    try {
      await api('/api/settings/connect', {
        method: 'POST',
        body: JSON.stringify({ username: u, password: p }),
      });
      await load();
    } catch {
      setMsg('Could not connect. Check username and password.');
    }
  }
  async function disconnect() {
    await api('/api/settings/disconnect', { method: 'POST' });
    await load();
  }

  if (!s) return <p>Loading...</p>;
  return (
    <div>
      <h2>Connect</h2>
      {s.connected ? (
        <div>
          <p>Status: Connected. Username: {s.usernameMasked}</p>
          <p>Balance: {s.balance.amount}</p>
          <button onClick={disconnect}>Disconnect</button>
        </div>
      ) : (
        <div>
          <input placeholder="username" value={u} onChange={(e) => setU(e.target.value)} />
          <input placeholder="password" type="password" value={p} onChange={(e) => setP(e.target.value)} />
          <button onClick={connect}>Connect</button>
          {msg && <p style={{ color: 'crimson' }}>{msg}</p>}
        </div>
      )}
    </div>
  );
}
