import React, { useEffect, useState } from 'react';
import mondaySdk from 'monday-sdk-js';
import History from './History';
import Composer from './Composer';

const monday = mondaySdk();

interface ItemData {
  id: string;
  name: string;
  boardName: string;
  columns: Record<string, string>;
  phoneColumnId: string;
  phoneColumnValue: string;
}

async function fetchItem(itemId: string): Promise<ItemData | null> {
  if (!itemId) return null;
  const query = `query($id:[ID!]) {
    items(ids:$id) {
      id
      name
      board { id name }
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
  let phoneColumnId = '';
  let phoneColumnValue = '';
  for (const cv of it.column_values ?? []) {
    const title = cv.column?.title ?? cv.id;
    columns[title] = cv.text ?? '';
    if (cv.type === 'phone' && !phoneColumnId) {
      phoneColumnId = cv.id;
      phoneColumnValue = cv.phone ?? cv.text ?? '';
    }
  }
  return {
    id: String(it.id),
    name: it.name,
    boardName: it.board?.name ?? '',
    columns,
    phoneColumnId,
    phoneColumnValue,
  };
}

export default function ItemView() {
  const [ctx, setCtx] = useState<any>(null);
  const [item, setItem] = useState<ItemData | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [err, setErr] = useState('');

  async function loadItem(c: any) {
    try {
      setErr('');
      const id = String(c?.itemId ?? '');
      if (!id) return;
      const data = await fetchItem(id);
      setItem(data);
    } catch (e) {
      setErr('Failed to load item: ' + String(e));
    }
  }

  useEffect(() => {
    monday.get('context').then((r: any) => {
      setCtx(r.data);
      void loadItem(r.data);
    });
    const unsub = monday.listen('context', (res: any) => {
      setCtx(res.data);
      void loadItem(res.data);
      setRefreshKey((k) => k + 1);
    });
    return () => {
      if (typeof unsub === 'function') (unsub as () => void)();
    };
  }, []);

  if (!ctx) return <div className="kwt-loading">Loading…</div>;
  const itemId = String(ctx.itemId ?? '');
  const boardId = String(ctx.boardId ?? '');

  return (
    <div className="kwt-panel">
      {err && <div className="kwt-alert kwt-alert--danger">{err}</div>}
      <Composer
        itemId={itemId}
        boardId={boardId}
        phone={item?.phoneColumnValue ?? ''}
        columns={item?.columns ?? {}}
        itemName={item?.name ?? ''}
        boardName={item?.boardName ?? ''}
        onSent={() => setRefreshKey((k) => k + 1)}
      />
      <div key={refreshKey}>
        <History itemId={itemId} />
      </div>
    </div>
  );
}
