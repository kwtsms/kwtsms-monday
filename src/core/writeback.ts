import initMondayClient from 'monday-sdk-js';

interface WritebackCtx {
  mondayAccessToken: string;
  boardId: string;
  itemId: string;
  statusColumnId: string;
  value: string;
}

export async function writeStatus(ctx: WritebackCtx): Promise<void> {
  if (!ctx.itemId || !ctx.statusColumnId) return;
  const m = initMondayClient();
  m.setToken(ctx.mondayAccessToken);
  const query = `
    mutation($boardId: ID!, $itemId: ID!, $columnId: String!, $value: JSON!) {
      change_column_value(
        board_id: $boardId,
        item_id: $itemId,
        column_id: $columnId,
        value: $value
      ) { id }
    }
  `;
  const value = JSON.stringify({ label: ctx.value });
  await m.api(query, {
    variables: {
      boardId: ctx.boardId,
      itemId: ctx.itemId,
      columnId: ctx.statusColumnId,
      value,
    },
  });
}
