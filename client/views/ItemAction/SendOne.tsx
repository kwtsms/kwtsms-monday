import React, { useEffect, useState } from 'react';
import mondaySdk from 'monday-sdk-js';
import { api, reportValueCreated } from '../../api/client';
import { countSms } from '../../utils/smsCount';

const monday = mondaySdk();

interface PhoneCol {
  id: string;
  title: string;
  value: string;
}

interface ItemData {
  id: string;
  name: string;
  columns: Record<string, string>;
  phoneColumns: PhoneCol[];
}

async function fetchItem(itemId: string): Promise<ItemData | null> {
  if (!itemId) return null;
  const query = `query($id:[ID!]) {
    items(ids:$id) {
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
  const r: any = await monday.api(query, { variables: { id: [itemId] } });
  const it = r?.data?.items?.[0];
  if (!it) return null;
  const columns: Record<string, string> = {};
  const phoneColumns: PhoneCol[] = [];
  for (const cv of it.column_values ?? []) {
    const title = cv.column?.title ?? cv.id;
    columns[title] = cv.text ?? '';
    if (cv.type === 'phone') {
      phoneColumns.push({ id: cv.id, title, value: cv.phone ?? cv.text ?? '' });
    }
  }
  return { id: String(it.id), name: it.name, columns, phoneColumns };
}

export default function SendOne() {
  const [ctx, setCtx] = useState<any>(null);
  const [item, setItem] = useState<ItemData | null>(null);
  const [tmpls, setTmpls] = useState<any[]>([]);
  const [tid, setTid] = useState('');
  const [body, setBody] = useState('');
  const [phoneSource, setPhoneSource] = useState<'column' | 'custom'>('column');
  const [selectedPhoneCol, setSelectedPhoneCol] = useState<string>('');
  const [customPhone, setCustomPhone] = useState('');
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  useEffect(() => {
    monday.get('context').then(async (r: any) => {
      setCtx(r.data);
      try {
        const id = String(r.data?.itemId ?? r.data?.pulseId ?? '');
        if (id) {
          const data = await fetchItem(id);
          setItem(data);
          if (data && data.phoneColumns.length > 0) {
            setSelectedPhoneCol(data.phoneColumns[0].id);
          } else {
            setPhoneSource('custom');
          }
        }
      } catch (e) {
        setErr('Failed to load item: ' + String(e));
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

  const resolvedPhone = (() => {
    if (phoneSource === 'custom') return customPhone.trim();
    const pc = item?.phoneColumns.find((p) => p.id === selectedPhoneCol);
    return pc?.value ?? '';
  })();

  async function doSend() {
    setSending(true);
    setMsg('');
    setErr('');
    try {
      const r = await api<{ sent: number; failed: number; skipped: number }>('/api/send', {
        method: 'POST',
        body: JSON.stringify({
          source: 'item_view',
          body,
          targets: [
            {
              phoneRaw: resolvedPhone,
              ctx: {
                item: { id: item?.id ?? '', name: item?.name ?? '' },
                columns: item?.columns ?? {},
                board: { name: ctx?.boardName ?? '' },
                user: {},
              },
              itemId: item?.id ?? String(ctx?.itemId ?? ''),
              boardId: String(ctx?.boardId ?? ''),
            },
          ],
        }),
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

  return (
    <div className="kwt-panel">
      <h3>Send SMS via kwtSMS</h3>
      {item && (
        <dl className="kwt-kv">
          <dt>Item</dt>
          <dd><b>{item.name}</b></dd>
        </dl>
      )}
      {err && <div className="kwt-alert kwt-alert--danger">{err}</div>}

      <div className="kwt-field">
        <label className="kwt-label">To</label>
        {item && item.phoneColumns.length > 0 && (
          <div className="kwt-radio-group">
            <label>
              <input
                type="radio"
                checked={phoneSource === 'column'}
                onChange={() => setPhoneSource('column')}
              />
              Phone column
            </label>
            <label>
              <input
                type="radio"
                checked={phoneSource === 'custom'}
                onChange={() => setPhoneSource('custom')}
              />
              Custom number
            </label>
          </div>
        )}
        {phoneSource === 'column' && item && item.phoneColumns.length > 0 ? (
          <select
            className="kwt-select"
            value={selectedPhoneCol}
            onChange={(e) => setSelectedPhoneCol(e.target.value)}
          >
            {item.phoneColumns.map((pc) => (
              <option key={pc.id} value={pc.id}>
                {pc.title}: {pc.value || '(empty)'}
              </option>
            ))}
          </select>
        ) : (
          <input
            className="kwt-input"
            value={customPhone}
            onChange={(e) => setCustomPhone(e.target.value)}
            placeholder="+965…"
          />
        )}
        <div className="kwt-hint">
          Sending to: <b>{resolvedPhone || <span style={{ color: 'var(--c-danger)' }}>(none)</span>}</b>
        </div>
      </div>

      <div className="kwt-field">
        <label className="kwt-label">Template</label>
        <select className="kwt-select" value={tid} onChange={(e) => pickTemplate(e.target.value)}>
          <option value="">(pick template)</option>
          {tmpls.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </div>

      <div className="kwt-field">
        <label className="kwt-label">Message</label>
        <textarea className="kwt-textarea" value={body} onChange={(e) => setBody(e.target.value)} rows={4} />
        <div className="kwt-row kwt-mt-3" style={{ gap: 8 }}>
          <span className={'kwt-counter' + (smsCount.unicode ? ' kwt-counter--unicode' : '')}>
            {smsCount.count} chars · {smsCount.pages} page{smsCount.pages === 1 ? '' : 's'} · {smsCount.unicode ? 'Unicode (70/page)' : 'GSM (160/page)'}
          </span>
        </div>
      </div>

      <button className="kwt-btn kwt-btn--primary" onClick={doSend} disabled={!resolvedPhone || !body || sending}>
        {sending ? 'Sending…' : 'Send SMS'}
      </button>
      {msg && <div className="kwt-alert kwt-mt-3">{msg}</div>}
    </div>
  );
}
