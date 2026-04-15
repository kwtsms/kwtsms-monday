import React, { useEffect, useState } from 'react';
import { api } from '../../api/client';
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
    void (async () => setTmpls(await api<any[]>('/api/templates')))();
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
      setMsg(`sent ${r.sent}, skipped ${r.skipped}, failed ${r.failed}`);
      p.onSent();
    } finally {
      setSending(false);
    }
  }

  const smsCount = countSms(body);
  return (
    <div>
      <h3>Send SMS</h3>
      <div>To: {p.phone || '(no phone column on item)'}</div>
      <div style={{ marginTop: 12 }}>
        <label>Template:</label>
      </div>
      <div>
        <select value={tid} onChange={(e) => pickTemplate(e.target.value)}>
          <option value="">(pick template)</option>
          {tmpls.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </div>
      <div style={{ marginTop: 12 }}>
        <label>Message:</label>
      </div>
      <div>
        <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4} cols={40} />
      </div>
      <div style={{ fontSize: 12, color: '#666' }}>
        {smsCount.count} chars, {smsCount.pages} page{smsCount.pages === 1 ? '' : 's'}
        {' '}({smsCount.unicode ? 'Unicode 70/page' : 'GSM 160/page'})
      </div>
      <button onClick={doSend} disabled={!p.phone || !body || sending}>Send</button>
      {msg && <p>{msg}</p>}
    </div>
  );
}
