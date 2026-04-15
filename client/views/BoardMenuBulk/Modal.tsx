import React, { useEffect, useState } from 'react';
import mondaySdk from 'monday-sdk-js';
import { api } from '../../api/client';
import { countSms } from '../../utils/smsCount';

const monday = mondaySdk();

interface Item {
  id: string;
  name: string;
  phone: string;
  columns: Record<string, string>;
}

function extractItemIds(ctx: any): string[] {
  const candidates = [
    ctx?.selectedItemIds,
    ctx?.itemIds,
    ctx?.selectedItems,
    ctx?.pulseIds,
    ctx?.selectedPulseIds,
  ];
  for (const c of candidates) {
    if (Array.isArray(c) && c.length > 0) return c.map((x: any) => String(x?.id ?? x));
  }
  if (ctx?.itemId) return [String(ctx.itemId)];
  if (ctx?.pulseId) return [String(ctx.pulseId)];
  return [];
}

async function fetchItems(ids: string[]): Promise<Item[]> {
  if (ids.length === 0) return [];
  const q = `query($ids: [ID!]) {
    items(ids: $ids) {
      id name
      column_values { id title text type }
    }
  }`;
  const r: any = await monday.api(q, { variables: { ids } });
  const items = r?.data?.items ?? [];
  return items.map((it: any) => {
    const cols: Record<string, string> = {};
    let phone = '';
    for (const cv of it.column_values ?? []) {
      cols[cv.title] = cv.text ?? '';
      if (!phone && (cv.type === 'phone' || /phone/i.test(cv.title))) phone = cv.text ?? '';
    }
    return { id: String(it.id), name: it.name, phone, columns: cols };
  });
}

export default function BoardMenuBulk() {
  const [ctx, setCtx] = useState<any>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [tmpls, setTmpls] = useState<any[]>([]);
  const [tid, setTid] = useState('');
  const [body, setBody] = useState('');
  const [msg, setMsg] = useState('');
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    monday.get('context').then(async (r: any) => {
      setCtx(r.data);
      try {
        const ids = extractItemIds(r.data);
        if (ids.length === 0) {
          setErr('No selected items in context. Fields present: ' + Object.keys(r.data ?? {}).join(', '));
          return;
        }
        const fetched = await fetchItems(ids);
        setItems(fetched);
      } catch (e) {
        setErr('Failed to load items: ' + String(e));
      }
    });
    void (async () => {
      try {
        setTmpls(await api<any[]>('/api/templates'));
      } catch (e) {
        setErr('Failed to load templates: ' + String(e));
      }
    })();
  }, []);

  function pickTemplate(id: string) {
    setTid(id);
    const t = tmpls.find((x) => x.id === id);
    setBody(t?.body ?? '');
  }

  async function confirmSend() {
    setSending(true);
    setMsg('');
    try {
      const targets = items.map((it) => ({
        phoneRaw: it.phone,
        ctx: { item: { id: it.id, name: it.name }, columns: it.columns },
        itemId: it.id,
        boardId: String(ctx?.boardId ?? ''),
      }));
      const r = await api<{ sent: number; skipped: number; failed: number }>('/api/send', {
        method: 'POST',
        body: JSON.stringify({ source: 'bulk', body, targets }),
      });
      setMsg(`Sent ${r.sent}, skipped ${r.skipped}, failed ${r.failed}`);
    } catch (e) {
      setErr('Send failed: ' + String(e));
    } finally {
      setSending(false);
    }
  }

  if (!ctx) return <p style={{ padding: 16 }}>Loading...</p>;

  const smsCount = countSms(body);
  const hasPhone = items.filter((i) => i.phone).length;
  const noPhone = items.length - hasPhone;

  return (
    <div style={{ padding: 16, fontFamily: 'system-ui, sans-serif' }}>
      <h2 style={{ marginTop: 0 }}>
        Send SMS to {items.length} selected item{items.length === 1 ? '' : 's'}
      </h2>
      {err && <p style={{ color: 'crimson' }}>{err}</p>}
      {items.length > 0 && noPhone > 0 && (
        <p style={{ color: '#d97706' }}>
          {noPhone} of {items.length} have no phone column value. They will be skipped.
        </p>
      )}
      <div style={{ marginTop: 12 }}>
        <label>Template:</label>
      </div>
      <div>
        <select value={tid} onChange={(e) => pickTemplate(e.target.value)} style={{ width: '100%', padding: 6 }}>
          <option value="">(pick template)</option>
          {tmpls.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </div>
      <div style={{ marginTop: 12 }}>
        <label>Message:</label>
      </div>
      <div>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={4}
          style={{ width: '100%', padding: 6 }}
        />
      </div>
      <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>
        {smsCount.count} chars, {smsCount.pages} page{smsCount.pages === 1 ? '' : 's'}
        {' '}({smsCount.unicode ? 'Unicode 70/page' : 'GSM 160/page'})
      </div>
      {items.length > 0 && (
        <details style={{ marginTop: 12 }}>
          <summary>Recipients ({hasPhone}/{items.length} with phone)</summary>
          <ul style={{ maxHeight: 120, overflow: 'auto', fontSize: 13 }}>
            {items.map((it) => (
              <li key={it.id}>
                <b>{it.name}</b>{' '}
                {it.phone ? it.phone : <span style={{ color: 'crimson' }}>(no phone)</span>}
              </li>
            ))}
          </ul>
        </details>
      )}
      <div style={{ marginTop: 12 }}>
        <button onClick={confirmSend} disabled={!body || hasPhone === 0 || sending}>
          {sending ? 'Sending...' : `Send to ${hasPhone}`}
        </button>
      </div>
      {msg && <p style={{ marginTop: 8 }}>{msg}</p>}
    </div>
  );
}
