import React, { useEffect, useMemo, useRef, useState } from 'react';
import mondaySdk from 'monday-sdk-js';
import { api, prewarm, reportValueCreated } from '../../api/client';
import { countSms } from '../../utils/smsCount';
import { buildSingleItemSources, PhoneSource } from '../../utils/phoneSources';
import { ITEM_CORE_FIELDS, buildItemBag, fetchMe } from '../../utils/templateContext';
import NewTemplateButton from '../../components/NewTemplateButton';
import PlaceholdersHelp from '../../components/PlaceholdersHelp';

const monday = mondaySdk();

interface ItemData {
  id: string;
  name: string;
  columns: Record<string, string>;
  phoneSources: PhoneSource[];
  itemBag: Record<string, unknown>;
  boardBag: Record<string, unknown>;
}

async function fetchItem(itemId: string): Promise<ItemData | null> {
  if (!itemId) return null;
  const query = `query($id:[ID!]) {
    items(ids:$id) {
      ${ITEM_CORE_FIELDS}
      column_values {
        id
        text
        type
        column { title }
        ... on PhoneValue { phone }
        ... on PeopleValue { persons_and_teams { id kind } }
      }
    }
  }`;
  const r: any = await monday.api(query, { variables: { id: [itemId] } });
  const it = r?.data?.items?.[0];
  if (!it) return null;
  const columns: Record<string, string> = {};
  for (const cv of it.column_values ?? []) {
    const title = cv.column?.title ?? cv.id;
    columns[title] = cv.text ?? '';
  }
  const phoneSources = await buildSingleItemSources({ column_values: it.column_values });
  return {
    id: String(it.id),
    name: it.name,
    columns,
    phoneSources,
    itemBag: buildItemBag(it),
    boardBag: {
      id: String(it.board?.id ?? ''),
      name: it.board?.name ?? '',
      url: it.board?.url ?? '',
    },
  };
}

export default function SendOne() {
  const [ctx, setCtx] = useState<any>(null);
  const [item, setItem] = useState<ItemData | null>(null);
  const [tmpls, setTmpls] = useState<any[]>([]);
  const [tid, setTid] = useState('');
  const [body, setBody] = useState('');
  const [phoneMode, setPhoneMode] = useState<'item' | 'custom'>('item');
  const [sourceId, setSourceId] = useState<string>('');
  const [customPhone, setCustomPhone] = useState('');
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [userBag, setUserBag] = useState<Record<string, unknown>>({});

  useEffect(() => {
    monday.get('context').then(async (r: any) => {
      setCtx(r.data);
      try {
        const id = String(r.data?.itemId ?? r.data?.pulseId ?? '');
        if (id) {
          const data = await fetchItem(id);
          setItem(data);
          if (data && data.phoneSources.length > 0) {
            setSourceId(data.phoneSources[0].id);
          } else {
            setPhoneMode('custom');
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
    void (async () => {
      const me = await fetchMe();
      setUserBag(me);
    })();
  }, []);

  function pickTemplate(id: string) {
    setTid(id);
    const t = tmpls.find((x) => x.id === id);
    setBody(t?.body ?? '');
  }

  const resolvedPhone = useMemo(() => {
    if (phoneMode === 'custom') return customPhone.trim();
    return item?.phoneSources.find((s) => s.id === sourceId)?.value ?? '';
  }, [phoneMode, customPhone, item, sourceId]);

  const sendLockRef = useRef(false);

  async function doSend() {
    if (sendLockRef.current) return;
    sendLockRef.current = true;
    setSending(true);
    setMsg('');
    setErr('');
    try {
      await prewarm();
      const r = await api<{ sent: number; failed: number; skipped: number; placeholderWarnings?: string[] }>('/api/send', {
        method: 'POST',
        body: JSON.stringify({
          source: 'item_menu',
          body,
          targets: [
            {
              phoneRaw: resolvedPhone,
              ctx: {
                item: item?.itemBag ?? {},
                columns: item?.columns ?? {},
                board: item?.boardBag ?? {},
                user: userBag,
              },
              itemId: item?.id ?? String(ctx?.itemId ?? ''),
              boardId: String(ctx?.boardId ?? ''),
            },
          ],
        }),
      });
      const warn = r.placeholderWarnings && r.placeholderWarnings.length
        ? ` · empty: ${r.placeholderWarnings.join(', ')}`
        : '';
      setMsg(`Sent ${r.sent}, skipped ${r.skipped}, failed ${r.failed}${warn}`);
      if (r.sent > 0) reportValueCreated();
    } catch (e) {
      setErr('Send failed: ' + String(e));
    } finally {
      setSending(false);
      sendLockRef.current = false;
    }
  }

  if (!ctx) return <div className="kwt-loading">Loading…</div>;

  const smsCount = countSms(body);
  const hasItemSources = (item?.phoneSources.length ?? 0) > 0;

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
        {hasItemSources && (
          <div className="kwt-radio-group">
            <label>
              <input
                type="radio"
                checked={phoneMode === 'item'}
                onChange={() => setPhoneMode('item')}
              />
              From this item
            </label>
            <label>
              <input
                type="radio"
                checked={phoneMode === 'custom'}
                onChange={() => setPhoneMode('custom')}
              />
              Custom number
            </label>
          </div>
        )}
        {phoneMode === 'item' && hasItemSources ? (
          <select
            className="kwt-select"
            value={sourceId}
            onChange={(e) => setSourceId(e.target.value)}
          >
            {item!.phoneSources.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label} — {s.value}
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
        {!hasItemSources && item && (
          <div className="kwt-hint" style={{ color: 'var(--c-ink-500)' }}>
            No Phone column or assigned Person with a phone on this item.
          </div>
        )}
        <div className="kwt-hint">
          Sending to: <b>{resolvedPhone || <span style={{ color: 'var(--c-danger)' }}>(none)</span>}</b>
        </div>
      </div>

      <div className="kwt-field">
        <div className="kwt-row kwt-row--between" style={{ marginBottom: 6 }}>
          <label className="kwt-label" style={{ margin: 0 }}>Template</label>
          <NewTemplateButton
            onCreated={(t) => {
              setTmpls((xs) => [...xs, t]);
              setTid(t.id);
              setBody(t.body);
            }}
          />
        </div>
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
        <div className="kwt-row" style={{ marginBottom: 6 }}>
          <label className="kwt-label" style={{ margin: 0 }}>Message</label>
          <PlaceholdersHelp />
        </div>
        <textarea className="kwt-textarea" value={body} onChange={(e) => setBody(e.target.value)} rows={4} />
        <div className="kwt-row kwt-mt-3" style={{ gap: 8 }}>
          <span className={'kwt-counter' + (smsCount.unicode ? ' kwt-counter--unicode' : '')}>
            {smsCount.count} chars · {smsCount.pages} page{smsCount.pages === 1 ? '' : 's'} · {smsCount.unicode ? 'Arabic' : 'English'}
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
