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
      <div className="kwt-card">
        <div className="kwt-field">
          <label className="kwt-label">Name</label>
          <input
            className="kwt-input"
            placeholder="e.g. Order shipped"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="kwt-field">
          <label className="kwt-label">Body</label>
          <textarea
            className="kwt-textarea"
            placeholder="Hi {item.name}, your order is {column.Status}."
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={4}
          />
          <div className="kwt-hint">
            Placeholders: <code>{`{item.name}`}</code>, <code>{`{item.id}`}</code>, <code>{`{column.<Title>}`}</code>, <code>{`{user.name}`}</code>, <code>{`{board.name}`}</code>
          </div>
        </div>
        <button className="kwt-btn kwt-btn--primary" onClick={add} disabled={busy}>
          {busy ? 'Adding…' : 'Add template'}
        </button>
        {err && <div className="kwt-alert kwt-alert--danger kwt-mt-3">{err}</div>}
      </div>

      <div className="kwt-mt-4">
        <table className="kwt-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Body</th>
              <th>Updated</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {list.map((t) => (
              <tr key={t.id}>
                <td><b>{t.name}</b></td>
                <td>{t.body.slice(0, 80)}{t.body.length > 80 ? '…' : ''}</td>
                <td>{new Date(t.updatedAt).toLocaleString()}</td>
                <td><button className="kwt-btn kwt-btn--sm kwt-btn--danger" onClick={() => del(t.id)}>Delete</button></td>
              </tr>
            ))}
            {list.length === 0 && (
              <tr><td colSpan={4} className="kwt-empty">No templates yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
