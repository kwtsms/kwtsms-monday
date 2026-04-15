import React, { useEffect, useState } from 'react';
import mondaySdk from 'monday-sdk-js';
import History from './History';
import Composer from './Composer';

const monday = mondaySdk();

export default function ItemView() {
  const [ctx, setCtx] = useState<any>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    monday.get('context').then((r: any) => setCtx(r.data));
  }, []);

  if (!ctx) return <p>Loading...</p>;
  const itemId = String(ctx.itemId ?? '');
  const boardId = String(ctx.boardId ?? '');
  return (
    <div style={{ padding: 12 }}>
      <Composer
        itemId={itemId}
        boardId={boardId}
        phone={ctx.itemPhone ?? ''}
        columns={ctx.columns ?? {}}
        itemName={ctx.itemName ?? ''}
        boardName={ctx.boardName ?? ''}
        onSent={() => setRefreshKey((k) => k + 1)}
      />
      <div key={refreshKey}>
        <History itemId={itemId} />
      </div>
    </div>
  );
}
