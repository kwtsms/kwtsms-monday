import React, { useEffect, useState } from 'react';
import { api } from '../../api/client';

interface T { id: string; name: string; body: string; updatedAt: number; }

export default function Templates() {
  const [list, setList] = useState<T[]>([]);
  const [name, setName] = useState('');
  const [body, setBody] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      setErr('');
      setList(await api<T[]>('/api/templates'));
    } catch (e) {
      setErr('Load templates failed: ' + String(e));
    }
  }
  useEffect(() => { void load(); }, []);

  async function add() {
    if (!name.trim() || !body.trim()) {
      setErr('Name and body are required.');
      return;
    }
    setBusy(true);
    setErr('');
    try {
      await api('/api/templates', { method: 'POST', body: JSON.stringify({ name, body }) });
      setName('');
      setBody('');
      await load();
    } catch (e) {
      setErr('Add template failed: ' + String(e));
    } finally {
      setBusy(false);
    }
  }
  async function del(id: string) {
    setErr('');
    try {
      await api(`/api/templates/${id}`, { method: 'DELETE' });
      await load();
    } catch (e) {
      setErr('Delete template failed: ' + String(e));
    }
  }
  return (
    <div>
      <h2>Templates</h2>
      <div>
        <div>
          <label>Name:</label>
        </div>
        <div>
          <input placeholder="e.g. Order shipped" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div style={{ marginTop: 8 }}>
          <label>Body:</label>
        </div>
        <div>
          <textarea
            placeholder="Hi {item.name}, your order is {column.Status}."
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={4}
            cols={50}
          />
        </div>
        <div style={{ marginTop: 8 }}>
          <button onClick={add} disabled={busy}>{busy ? 'Adding...' : 'Add template'}</button>
        </div>
        {err && <p style={{ color: 'crimson' }}>{err}</p>}
      </div>
      <table style={{ marginTop: 16, borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left', paddingRight: 16 }}>Name</th>
            <th style={{ textAlign: 'left', paddingRight: 16 }}>Body</th>
            <th style={{ textAlign: 'left', paddingRight: 16 }}>Updated</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {list.map((t) => (
            <tr key={t.id}>
              <td style={{ paddingRight: 16 }}>{t.name}</td>
              <td style={{ paddingRight: 16 }}>{t.body.slice(0, 60)}</td>
              <td style={{ paddingRight: 16 }}>{new Date(t.updatedAt).toLocaleString()}</td>
              <td><button onClick={() => del(t.id)}>Delete</button></td>
            </tr>
          ))}
          {list.length === 0 && (
            <tr><td colSpan={4} style={{ color: '#888' }}>No templates yet.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
