import React, { useEffect, useState } from 'react';
import mondaySdk from 'monday-sdk-js';
import { api } from '../../api/client';
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
      id name
      column_values {
        id title text type
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
    columns[cv.title] = cv.text ?? '';
    if (cv.type === 'phone') {
      phoneColumns.push({ id: cv.id, title: cv.title, value: cv.phone ?? cv.text ?? '' });
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
    } catch (e) {
      setErr('Send failed: ' + String(e));
    } finally {
      setSending(false);
    }
  }

  if (!ctx) return <p style={{ padding: 12 }}>Loading...</p>;

  const smsCount = countSms(body);

  return (
    <div style={{ padding: 16, fontFamily: 'system-ui, sans-serif' }}>
      <h3 style={{ marginTop: 0 }}>Send SMS via kwtSMS</h3>
      {item && <div>Item: <b>{item.name}</b></div>}
      {err && <p style={{ color: 'crimson' }}>{err}</p>}

      <div style={{ marginTop: 12 }}>
        <label>To:</label>
      </div>
      <div>
        {item && item.phoneColumns.length > 0 && (
          <label style={{ fontSize: 13, marginRight: 12 }}>
            <input
              type="radio"
              checked={phoneSource === 'column'}
              onChange={() => setPhoneSource('column')}
            />{' '}
            Phone column
          </label>
        )}
        <label style={{ fontSize: 13 }}>
          <input
            type="radio"
            checked={phoneSource === 'custom'}
            onChange={() => setPhoneSource('custom')}
          />{' '}
          Custom number
        </label>
      </div>
      {phoneSource === 'column' && item && item.phoneColumns.length > 0 ? (
        <div>
          <select
            value={selectedPhoneCol}
            onChange={(e) => setSelectedPhoneCol(e.target.value)}
            style={{ width: '100%', padding: 6 }}
          >
            {item.phoneColumns.map((pc) => (
              <option key={pc.id} value={pc.id}>
                {pc.title}: {pc.value || '(empty)'}
              </option>
            ))}
          </select>
        </div>
      ) : (
        <div>
          <input
            value={customPhone}
            onChange={(e) => setCustomPhone(e.target.value)}
            placeholder="phone number"
            style={{ width: '100%', padding: 6 }}
          />
        </div>
      )}
      <div style={{ fontSize: 12, color: '#666', marginTop: 2 }}>
        Sending to: {resolvedPhone || <span style={{ color: 'crimson' }}>(none)</span>}
      </div>

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

      <div style={{ marginTop: 12 }}>
        <button onClick={doSend} disabled={!resolvedPhone || !body || sending}>
          {sending ? 'Sending...' : 'Send SMS'}
        </button>
      </div>
      {msg && <p style={{ marginTop: 8 }}>{msg}</p>}
    </div>
  );
}
