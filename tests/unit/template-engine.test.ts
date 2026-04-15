import { resolveTemplate } from '../../src/core/template-engine';

const ctx = {
  item: { id: '42', name: 'Order 4421' },
  columns: { Status: 'Shipped', 'Due Date': '2026-05-01' },
  user: { name: 'Mo' },
  board: { name: 'Orders' },
};

describe('resolveTemplate', () => {
  it('replaces item tokens', () => {
    expect(resolveTemplate('Hi {item.name} (#{item.id})', ctx).body).toBe(
      'Hi Order 4421 (#42)',
    );
  });
  it('replaces column tokens with spaces', () => {
    expect(resolveTemplate('Status: {column.Status}', ctx).body).toBe('Status: Shipped');
  });
  it('replaces multi-word column titles', () => {
    expect(resolveTemplate('{column.Due Date}', ctx).body).toBe('2026-05-01');
  });
  it('leaves unknown tokens as literals and records warning', () => {
    const r = resolveTemplate('X={item.unknown}', ctx);
    expect(r.body).toBe('X={item.unknown}');
    expect(r.warnings).toContain('item.unknown');
  });
  it('replaces user and board tokens', () => {
    expect(resolveTemplate('by {user.name} on {board.name}', ctx).body).toBe(
      'by Mo on Orders',
    );
  });
  it('handles empty body', () => {
    expect(resolveTemplate('', ctx).body).toBe('');
  });
});
