import React, { useEffect, useMemo, useRef, useState } from 'react';
import mondaySdk from 'monday-sdk-js';
import { api, prewarm, reportValueCreated } from '../../api/client';
import { countSms } from '../../utils/smsCount';
import type { PhoneSource } from '../../utils/phoneSources';
import { fetchMe } from '../../utils/templateContext';
import NewTemplateButton from '../../components/NewTemplateButton';
import PlaceholdersHelp from '../../components/PlaceholdersHelp';

const monday = mondaySdk();

interface Props {
  itemId: string;
  boardId: string;
  phoneSources: PhoneSource[];
  columns: Record<string, string>;
  itemBag: Record<string, unknown>;
  boardBag: Record<string, unknown>;
  onSent: () => void;
}

export default function Composer(p: Props) {
  const [tmpls, setTmpls] = useState<any[]>([]);
  const [tid, setTid] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState('');
  const [userBag, setUserBag] = useState<Record<string, unknown>>({});

  const [phoneMode, setPhoneMode] = useState<'item' | 'custom'>('item');
  const [sourceId, setSourceId] = useState<string>('');
  const [customPhone, setCustomPhone] = useState('');

  useEffect(() => {
    void (async () => setTmpls(await api<any[]>('/api/templates').catch(() => [])))();
    void (async () => {
      const me = await fetchMe();
      try {
        const c = await monday.get('context');
        const ctxName = (c?.data as any)?.user?.name;
        if (ctxName && !me.name) me.name = String(ctxName);
      } catch { /* ignore */ }
      setUserBag(me);
    })();
  }, []);

  // Default phone mode is always "from this item" so the item's number is
  // pre-selected on open. If the item has no sources, the user can flip to
  // Custom themselves - never auto-switch.
  useEffect(() => {
    if (p.phoneSources.length === 0) {
      setSourceId('');
      return;
    }
    if (!sourceId || !p.phoneSources.find((s) => s.id === sourceId)) {
      setSourceId(p.phoneSources[0].id);
    }
  }, [p.phoneSources, sourceId]);

  const resolvedPhone = useMemo(() => {
    if (phoneMode === 'custom') return customPhone.trim();
    return p.phoneSources.find((s) => s.id === sourceId)?.value ?? '';
  }, [phoneMode, customPhone, p.phoneSources, sourceId]);

  function pickTemplate(id: string) {
    setTid(id);
    const t = tmpls.find((x) => x.id === id);
    setBody(t?.body ?? '');
  }

  const sendLockRef = useRef(false);

  async function doSend() {
    // React state updates are async; a fast double-click can fire two POSTs
    // before `sending` flips. A ref guard is synchronous so only one send
    // per click wins.
    if (sendLockRef.current) return;
    sendLockRef.current = true;
    setSending(true);
    setMsg('');
    try {
      await prewarm();
      const r = await api<{ sent: number; failed: number; skipped: number; placeholderWarnings?: string[] }>('/api/send', {
        method: 'POST',
        body: JSON.stringify({
          source: 'item_view',
          body,
          targets: [
            {
              phoneRaw: resolvedPhone,
              ctx: {
                item: p.itemBag,
                columns: p.columns,
                board: p.boardBag,
                user: userBag,
              },
              itemId: p.itemId,
              boardId: p.boardId,
            },
          ],
        }),
      });
      const warn = r.placeholderWarnings && r.placeholderWarnings.length
        ? ` · empty: ${r.placeholderWarnings.join(', ')}`
        : '';
      setMsg(`Sent ${r.sent}, skipped ${r.skipped}, failed ${r.failed}${warn}`);
      if (r.sent > 0) reportValueCreated();
      p.onSent();
    } catch (e) {
      setMsg('Send failed: ' + String(e));
    } finally {
      setSending(false);
      sendLockRef.current = false;
    }
  }

  const smsCount = countSms(body);
  const hasItemSources = p.phoneSources.length > 0;

  return (
    <div className="kwt-card">
      <h3>Send SMS</h3>

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
            {p.phoneSources.map((s) => (
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
        {!hasItemSources && (
          <div className="kwt-hint" style={{ color: 'var(--c-ink-500)' }}>
            No Phone column or assigned Person with a phone on this item. Type a custom number above.
          </div>
        )}
        <div className="kwt-hint">
          Sending to: <b>{resolvedPhone || <span style={{ color: 'var(--c-danger)' }}>(none)</span>}</b>
        </div>
      </div>

      <div className="kwt-field kwt-mt-3">
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
          {tmpls.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
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
      <button
        className="kwt-btn kwt-btn--primary kwt-mt-3"
        onClick={doSend}
        disabled={!resolvedPhone || !body || sending}
      >
        {sending ? 'Sending…' : 'Send SMS'}
      </button>
      {msg && <div className="kwt-alert kwt-mt-3">{msg}</div>}
    </div>
  );
}
