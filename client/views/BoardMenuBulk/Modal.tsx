import React, { useEffect, useState } from 'react';
import mondaySdk from 'monday-sdk-js';
import { api, reportValueCreated } from '../../api/client';
import { countSms } from '../../utils/smsCount';

const monday = mondaySdk();

interface Item {
  id: string;
  name: string;
  phone: string;
  columns: Record<string, string>;
}

function extractItemIds(ctx: any): string[] {
  // Named field probes (documented + observed)
  const named = [
    ctx?.selectedItemIds,
    ctx?.itemIds,
    ctx?.selectedItems,
    ctx?.pulseIds,
    ctx?.selectedPulseIds,
  ];
  for (const c of named) {
    if (Array.isArray(c) && c.length > 0) return c.map((x: any) => String(x?.id ?? x));
  }

  // ItemsConfig may hold { itemIds: [...] } or similar nested structure
  if (ctx?.itemsConfig || ctx?.ItemsConfig) {
    const ic = ctx.itemsConfig ?? ctx.ItemsConfig;
    if (typeof ic === 'object') {
      for (const v of Object.values(ic)) {
        if (Array.isArray(v) && v.length > 0) return (v as any[]).map((x: any) => String(x?.id ?? x));
      }
    }
  }

  // Fallback: scan ALL context fields for any array of numbers/strings
  if (ctx && typeof ctx === 'object') {
    for (const [, v] of Object.entries(ctx)) {
      if (Array.isArray(v) && v.length > 0) {
        const first = (v as any[])[0];
        if (typeof first === 'number' || (typeof first === 'string' && /^\d+$/.test(first))) {
          return (v as any[]).map((x: any) => String(x));
        }
        if (typeof first === 'object' && first?.id) {
          return (v as any[]).map((x: any) => String(x.id));
        }
      }
    }
  }

  if (ctx?.itemId) return [String(ctx.itemId)];
  if (ctx?.pulseId) return [String(ctx.pulseId)];
  return [];
}

async function fetchItems(ids: string[]): Promise<Item[]> {
  if (ids.length === 0) return [];
  const q = `query($ids:[ID!]) {
    items(ids:$ids) {
      id
      name
      column_values {
        id
        text
        type
        column { title }
        ... on PhoneValue { phone }
      }
    }
  }`;
  const r: any = await monday.api(q, { variables: { ids } });
  const items = r?.data?.items ?? [];
  return items.map((it: any) => {
    const cols: Record<string, string> = {};
    let phone = '';
    for (const cv of it.column_values ?? []) {
      const title = cv.column?.title ?? cv.id;
      cols[title] = cv.text ?? '';
      if (!phone && cv.type === 'phone') phone = cv.phone ?? cv.text ?? '';
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
          setErr('No selected items found. Context dump: ' + JSON.stringify(r.data, null, 2));
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
      if (r.sent > 0) reportValueCreated();
    } catch (e) {
      setErr('Send failed: ' + String(e));
    } finally {
      setSending(false);
    }
  }

  if (!ctx) return <div className="kwt-loading">Loading…</div>;

  const smsCount = countSms(body);
  const hasPhone = items.filter((i) => i.phone).length;
  const noPhone = items.length - hasPhone;

  return (
    <div className="kwt-panel">
      <h2 style={{ marginTop: 0 }}>
        Send SMS to {items.length} selected item{items.length === 1 ? '' : 's'}
      </h2>
      {err && <div className="kwt-alert kwt-alert--danger">{err}</div>}
      {items.length > 0 && noPhone > 0 && (
        <div className="kwt-alert kwt-alert--warn">
          {noPhone} of {items.length} have no phone column value. They will be skipped.
        </div>
      )}

      <div className="kwt-field">
        <label className="kwt-label">Template</label>
        <select className="kwt-select" value={tid} onChange={(e) => pickTemplate(e.target.value)}>
          <option value="">(pick template)</option>
          {tmpls.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
      </div>

      <div className="kwt-field">
        <label className="kwt-label">Message</label>
        <textarea className="kwt-textarea" value={body} onChange={(e) => setBody(e.target.value)} rows={4} />
        <div className="kwt-row kwt-mt-3" style={{ gap: 8 }}>
          <span className={'kwt-counter' + (smsCount.unicode ? ' kwt-counter--unicode' : '')}>
            {smsCount.count} chars · {smsCount.pages} page{smsCount.pages === 1 ? '' : 's'} · {smsCount.unicode ? 'Arabic (70/page)' : 'English (160/page)'}
          </span>
        </div>
      </div>

      {items.length > 0 && (
        <details style={{ marginTop: 12 }}>
          <summary style={{ cursor: 'pointer', color: 'var(--c-ink-500)', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700 }}>
            Recipients ({hasPhone} with phone / {items.length} selected)
          </summary>
          <ul style={{ maxHeight: 160, overflow: 'auto', fontSize: 13, marginTop: 8, paddingLeft: 16 }}>
            {items.map((it) => (
              <li key={it.id} style={{ marginBottom: 2 }}>
                <b>{it.name}</b>{' '}
                {it.phone ? it.phone : <span style={{ color: 'var(--c-danger)' }}>(no phone)</span>}
              </li>
            ))}
          </ul>
        </details>
      )}

      <button className="kwt-btn kwt-btn--primary kwt-mt-3" onClick={confirmSend} disabled={!body || hasPhone === 0 || sending}>
        {sending ? 'Sending…' : `Send to ${hasPhone}`}
      </button>
      {msg && <div className="kwt-alert kwt-mt-3">{msg}</div>}
    </div>
  );
}
