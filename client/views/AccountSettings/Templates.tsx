import React, { useEffect, useState } from 'react';
import { api } from '../../api/client';

interface T { id: string; name: string; body: string; updatedAt: number; }

export default function Templates() {
  const [list, setList] = useState<T[]>([]);
  const [name, setName] = useState('');
  const [body, setBody] = useState('');

  async function load() { setList(await api<T[]>('/api/templates')); }
  useEffect(() => { void load(); }, []);

  async function add() {
    await api('/api/templates', { method: 'POST', body: JSON.stringify({ name, body }) });
    setName(''); setBody('');
    await load();
  }
  async function del(id: string) {
    await api(`/api/templates/${id}`, { method: 'DELETE' });
    await load();
  }
  return (
    <div>
      <h2>Templates</h2>
      <div>
        <input placeholder="name" value={name} onChange={(e) => setName(e.target.value)} />
        <textarea placeholder="body, use {item.name}, {column.Status}" value={body} onChange={(e) => setBody(e.target.value)} />
        <button onClick={add}>Add</button>
      </div>
      <table>
        <thead><tr><th>Name</th><th>Body</th><th>Updated</th><th></th></tr></thead>
        <tbody>
          {list.map((t) => (
            <tr key={t.id}>
              <td>{t.name}</td>
              <td>{t.body.slice(0, 60)}</td>
              <td>{new Date(t.updatedAt).toLocaleString()}</td>
              <td><button onClick={() => del(t.id)}>Delete</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
