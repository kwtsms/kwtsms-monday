import React, { useEffect, useMemo, useRef, useState } from 'react';
import mondaySdk from 'monday-sdk-js';
import { api, prewarm, reportValueCreated } from '../../api/client';
import { countSms } from '../../utils/smsCount';
import {
  BulkItemRaw,
  ColumnPhoneSpec,
  buildBulkColumnSpecs,
  collectPeopleIds,
  fetchUsersPhones,
  resolveBulkPhone,
} from '../../utils/phoneSources';
import { ITEM_CORE_FIELDS, buildItemBag, fetchMe } from '../../utils/templateContext';
import NewTemplateButton from '../../components/NewTemplateButton';
import PlaceholdersHelp from '../../components/PlaceholdersHelp';

const monday = mondaySdk();

interface Item {
  id: string;
  name: string;
  columns: Record<string, string>;
  itemBag: Record<string, unknown>;
  boardBag: Record<string, unknown>;
  raw: BulkItemRaw;
}

function extractItemIds(ctx: any): string[] {
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
  if (ctx?.itemsConfig || ctx?.ItemsConfig) {
    const ic = ctx.itemsConfig ?? ctx.ItemsConfig;
    if (typeof ic === 'object') {
      for (const v of Object.values(ic)) {
        if (Array.isArray(v) && v.length > 0) return (v as any[]).map((x: any) => String(x?.id ?? x));
      }
    }
  }
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
  const r: any = await monday.api(q, { variables: { ids } });
  const items = r?.data?.items ?? [];
  return items.map((it: any) => {
    const cols: Record<string, string> = {};
    for (const cv of it.column_values ?? []) {
      const title = cv.column?.title ?? cv.id;
      cols[title] = cv.text ?? '';
    }
    const raw: BulkItemRaw = {
      id: String(it.id),
      name: it.name,
      columnValues: it.column_values ?? [],
    };
    return {
      id: String(it.id),
      name: it.name,
      columns: cols,
      raw,
      itemBag: buildItemBag(it),
      boardBag: {
        id: String(it.board?.id ?? ''),
        name: it.board?.name ?? '',
        url: it.board?.url ?? '',
      },
    };
  });
}

export default function BoardMenuBulk() {
  const [ctx, setCtx] = useState<any>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [specs, setSpecs] = useState<ColumnPhoneSpec[]>([]);
  const [pickedSpecId, setPickedSpecId] = useState('');
  const [personPhones, setPersonPhones] = useState<Record<string, { name: string; phone: string }>>({});
  const [tmpls, setTmpls] = useState<any[]>([]);
  const [tid, setTid] = useState('');
  const [body, setBody] = useState('');
  const [msg, setMsg] = useState('');
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState('');
  const [userBag, setUserBag] = useState<Record<string, unknown>>({});

  useEffect(() => {
    monday.get('context').then(async (r: any) => {
      setCtx(r.data);
      try {
        const ids = extractItemIds(r.data);
        if (ids.length === 0) {
          setErr('No selected items found.');
          return;
        }
        const fetched = await fetchItems(ids);
        setItems(fetched);
        const rawItems = fetched.map((f) => f.raw);
        const columnSpecs = buildBulkColumnSpecs(rawItems);
        setSpecs(columnSpecs);
        if (columnSpecs.length > 0) setPickedSpecId(columnSpecs[0].id);
        const peopleIds = collectPeopleIds(rawItems);
        if (peopleIds.length > 0) setPersonPhones(await fetchUsersPhones(peopleIds));
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

  const picked = useMemo(
    () => specs.find((s) => s.id === pickedSpecId) ?? null,
    [specs, pickedSpecId],
  );

  const resolvedTargets = useMemo(() => {
    if (!picked) return items.map((it) => ({ it, phone: '' }));
    return items.map((it) => ({ it, phone: resolveBulkPhone(it.raw, picked, personPhones) }));
  }, [items, picked, personPhones]);

  const hasPhone = resolvedTargets.filter((t) => !!t.phone).length;
  const noPhone = resolvedTargets.length - hasPhone;

  const sendLockRef = useRef(false);

  async function confirmSend() {
    if (sendLockRef.current) return;
    sendLockRef.current = true;
    setSending(true);
    setMsg('');
    try {
      await prewarm();
      const ctxUserName = String((ctx as any)?.user?.name ?? '');
      const userBagMerged = { ...userBag };
      if (ctxUserName && !userBagMerged.name) userBagMerged.name = ctxUserName;
      const targets = resolvedTargets
        .filter((t) => t.phone)
        .map((t) => ({
          phoneRaw: t.phone,
          ctx: {
            item: t.it.itemBag,
            columns: t.it.columns,
            user: userBagMerged,
            board: t.it.boardBag,
          },
          itemId: t.it.id,
          boardId: String(ctx?.boardId ?? ''),
        }));
      const r = await api<{ sent: number; skipped: number; failed: number; placeholderWarnings?: string[] }>('/api/send', {
        method: 'POST',
        body: JSON.stringify({ source: 'bulk_item', body, targets }),
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

  return (
    <div className="kwt-panel">
      <h2 style={{ marginTop: 0 }}>
        Send SMS to {items.length} selected item{items.length === 1 ? '' : 's'}
      </h2>
      {err && <div className="kwt-alert kwt-alert--danger">{err}</div>}

      <div className="kwt-field">
        <label className="kwt-label">Pick phone from</label>
        {specs.length === 0 ? (
          <div className="kwt-hint" style={{ color: 'var(--c-danger)' }}>
            None of the selected items have a Phone column or a People column. Nothing to send.
          </div>
        ) : (
          <select
            className="kwt-select"
            value={pickedSpecId}
            onChange={(e) => setPickedSpecId(e.target.value)}
          >
            {specs.map((s) => (
              <option key={s.id} value={s.id}>{s.label}</option>
            ))}
          </select>
        )}
      </div>

      {specs.length > 0 && noPhone > 0 && (
        <div className="kwt-alert kwt-alert--warn">
          {noPhone} of {items.length} have no phone for this source. They will be skipped.
        </div>
      )}

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
            <option key={t.id} value={t.id}>{t.name}</option>
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

      {items.length > 0 && (
        <details style={{ marginTop: 12 }}>
          <summary style={{ cursor: 'pointer', color: 'var(--c-ink-500)', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700 }}>
            Recipients ({hasPhone} with phone / {items.length} selected)
          </summary>
          <ul style={{ maxHeight: 160, overflow: 'auto', fontSize: 13, marginTop: 8, paddingLeft: 16 }}>
            {resolvedTargets.map(({ it, phone }) => (
              <li key={it.id} style={{ marginBottom: 2 }}>
                <b>{it.name}</b>{' '}
                {phone ? phone : <span style={{ color: 'var(--c-danger)' }}>(no phone)</span>}
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
