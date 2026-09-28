import { describe, it, expect } from 'vitest';
import { minimalChange } from './sync';

describe('minimalChange', () => {
  it('null when equal', () => expect(minimalChange('abc', 'abc')).toBeNull());
  it('insert in middle', () => expect(minimalChange('abcd', 'abXcd')).toEqual({ from: 2, to: 2, insert: 'X' }));
  it('delete at end', () => expect(minimalChange('abcd', 'ab')).toEqual({ from: 2, to: 4, insert: '' }));
  it('append to repeated chars', () => expect(minimalChange('aaa', 'aaaa')).toEqual({ from: 3, to: 3, insert: 'a' }));
  it('whole replace', () => expect(minimalChange('abc', 'xyz')).toEqual({ from: 0, to: 3, insert: 'xyz' }));
  it('applying the change reproduces the new text', () => {
    const a = '# T\n\nPara one.\n\nend';
    const b = '# T\n\nPara one. Edited\n\nend';
    const c = minimalChange(a, b)!;
    expect(a.slice(0, c.from) + c.insert + a.slice(c.to)).toBe(b);
  });
});

import { createVisualSync } from './sync';

function harness(initial: string) {
  let text = initial;
  let serialized = initial;
  const applied: unknown[] = [];
  const sync = createVisualSync({
    serialize: () => serialized,
    getText: () => text,
    apply: (ch) => {
      applied.push(ch);
      text = text.slice(0, ch.from) + ch.insert + text.slice(ch.to);
    },
  });
  sync.loaded(initial);
  return { sync, applied, setSerialized: (s: string) => (serialized = s), text: () => text };
}

describe('visual sync', () => {
  it('no edit, no write: flushing an untouched view changes nothing even if TipTap would normalise', () => {
    const h = harness('* a\n');
    h.setSerialized('- a\n'); // what TipTap would write
    h.sync.flush();
    expect(h.applied).toHaveLength(0);
    expect(h.text()).toBe('* a\n');
  });
  it('an edit is written on flush (Ctrl+S right after typing)', () => {
    const h = harness('hello');
    h.sync.edited();
    h.setSerialized('hello!');
    h.sync.flush();
    expect(h.text()).toBe('hello!');
    expect(h.applied).toEqual([{ from: 5, to: 5, insert: '!' }]);
  });
  it("keeps the file's own trailing newlines", () => {
    const h = harness('a\n');
    h.sync.edited();
    h.setSerialized('ab\n\n');
    h.sync.flush();
    expect(h.text()).toBe('ab\n');
    const none = harness('a');
    none.sync.edited();
    none.setSerialized('ab\n\n');
    none.sync.flush();
    expect(none.text()).toBe('ab');
  });
  it('flush is idempotent after writing', () => {
    const h = harness('a');
    h.sync.edited();
    h.setSerialized('ab');
    h.sync.flush();
    h.sync.flush();
    expect(h.applied).toHaveLength(1);
  });
  it('needsReload is false for text it wrote itself and true for outside changes', () => {
    const h = harness('a');
    h.sync.edited();
    h.setSerialized('ab');
    h.sync.flush();
    expect(h.sync.needsReload('ab')).toBe(false);
    expect(h.sync.needsReload('ab (edited in Source)')).toBe(true);
  });
});
