import { cleanMessage } from '../../src/core/clean-message';

describe('cleanMessage', () => {
  it('strips emoji', () => {
    expect(cleanMessage('hello 🎉 world')).toEqual({ body: 'hello  world', changed: true });
  });
  it('strips zero-width characters', () => {
    expect(cleanMessage('ab\u200Bcd')).toEqual({ body: 'abcd', changed: true });
  });
  it('strips ASCII control characters except newline and tab', () => {
    expect(cleanMessage('a\x07b\nc\td')).toEqual({ body: 'ab\nc\td', changed: true });
  });
  it('leaves plain ASCII unchanged', () => {
    expect(cleanMessage('Hello, order ready')).toEqual({
      body: 'Hello, order ready',
      changed: false,
    });
  });
  it('trims trailing whitespace only at ends', () => {
    expect(cleanMessage('  hi  ')).toEqual({ body: 'hi', changed: true });
  });
});
