import React, { useEffect, useState } from 'react';
import mondaySdk from 'monday-sdk-js';
import { api } from '../../api/client';

const monday = mondaySdk();

export default function BoardMenuBulk() {
  const [ctx, setCtx] = useState<any>(null);
  const [tmpls, setTmpls] = useState<any[]>([]);
  const [tid, setTid] = useState('');
  const [body, setBody] = useState('');
  const [preflight, setPreflight] = useState<{ to: string; status: string }[]>([]);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    monday.get('context').then((r: any) => setCtx(r.data));
    void (async () => setTmpls(await api<any[]>('/api/templates')))();
  }, []);

  async function runPreflight() {
    if (!ctx) return;
    const dryTargets = (ctx.selectedItems ?? []).map((it: any) => ({
      phoneRaw: it.phone,
      ctx: { item: { id: it.id, name: it.name }, columns: it.columns },
      itemId: it.id,
      boardId: String(ctx.boardId),
    }));
    setPreflight(dryTargets.map((d: any) => ({ to: d.phoneRaw, status: 'Ready' })));
  }

  async function confirmSend() {
    const targets = (ctx.selectedItems ?? []).map((it: any) => ({
      phoneRaw: it.phone,
      ctx: { item: { id: it.id, name: it.name }, columns: it.columns },
      itemId: it.id,
      boardId: String(ctx.boardId),
    }));
    const r = await api<{ sent: number; skipped: number; failed: number }>('/api/send', {
      method: 'POST',
      body: JSON.stringify({ source: 'bulk', body, targets }),
    });
    setMsg(`sent ${r.sent}, skipped ${r.skipped}, failed ${r.failed}`);
  }

  if (!ctx) return <p>Loading...</p>;
  const count = (ctx.selectedItems ?? []).length;

  return (
    <div style={{ padding: 16 }}>
      <h2>Send SMS to {count} selected items</h2>
      <select value={tid} onChange={(e) => { setTid(e.target.value); setBody(tmpls.find((x) => x.id === e.target.value)?.body ?? ''); }}>
        <option value="">(pick template)</option>
        {tmpls.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
      </select>
      <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4} cols={50} />
      <div>
        <button onClick={runPreflight}>Preflight</button>
        <button onClick={confirmSend} disabled={!body}>Confirm send</button>
      </div>
      {preflight.length > 0 && (
        <ul>
          {preflight.map((p, i) => <li key={i}>{p.to} - {p.status}</li>)}
        </ul>
      )}
      {msg && <p>{msg}</p>}
    </div>
  );
}
