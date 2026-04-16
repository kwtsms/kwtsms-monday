import React, { useEffect, useState } from 'react';
import { api, reportValueCreated } from '../../api/client';
import { countSms } from '../../utils/smsCount';

interface Props {
  itemId: string;
  boardId: string;
  phone: string;
  columns: Record<string, string>;
  itemName: string;
  boardName: string;
  onSent: () => void;
}

export default function Composer(p: Props) {
  const [tmpls, setTmpls] = useState<any[]>([]);
  const [tid, setTid] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    void (async () => setTmpls(await api<any[]>('/api/templates').catch(() => [])))();
  }, []);

  function pickTemplate(id: string) {
    setTid(id);
    const t = tmpls.find((x) => x.id === id);
    setBody(t?.body ?? '');
  }

  async function doSend() {
    setSending(true);
    setMsg('');
    try {
      const r = await api<{ sent: number; failed: number; skipped: number }>('/api/send', {
        method: 'POST',
        body: JSON.stringify({
          source: 'item_view',
          body,
          targets: [
            {
              phoneRaw: p.phone,
              ctx: {
                item: { id: p.itemId, name: p.itemName },
                columns: p.columns,
                board: { name: p.boardName },
                user: {},
              },
              itemId: p.itemId,
              boardId: p.boardId,
            },
          ],
        }),
      });
      setMsg(`Sent ${r.sent}, skipped ${r.skipped}, failed ${r.failed}`);
      if (r.sent > 0) reportValueCreated();
      p.onSent();
    } finally {
      setSending(false);
    }
  }

  const smsCount = countSms(body);
  return (
    <div className="kwt-card">
      <h3>Send SMS</h3>
      <dl className="kwt-kv">
        <dt>To</dt>
        <dd>{p.phone || <span style={{ color: 'var(--c-danger)' }}>No phone column on item</span>}</dd>
      </dl>
      <div className="kwt-field kwt-mt-3">
        <label className="kwt-label">Template</label>
        <select className="kwt-select" value={tid} onChange={(e) => pickTemplate(e.target.value)}>
          <option value="">(pick template)</option>
          {tmpls.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
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
      <button className="kwt-btn kwt-btn--primary kwt-mt-3" onClick={doSend} disabled={!p.phone || !body || sending}>
        {sending ? 'Sending…' : 'Send SMS'}
      </button>
      {msg && <div className="kwt-alert kwt-mt-3">{msg}</div>}
    </div>
  );
}
