import { describe, it, expect } from 'vitest';
import { sortRows, nextSort } from './grid-sort';

const rows = [['b', '10'], ['a', '9'], ['c', '']];

describe('sortRows', () => {
  it('numbers sort numerically, blanks last', () => expect(sortRows(rows, { col: 1, dir: 'asc' }).map((r) => r[0])).toEqual(['a', 'b', 'c']));
  it('blanks stay last when descending', () => expect(sortRows(rows, { col: 1, dir: 'desc' }).map((r) => r[0])).toEqual(['b', 'a', 'c']));
  it('text descending', () => expect(sortRows(rows, { col: 0, dir: 'desc' }).map((r) => r[0])).toEqual(['c', 'b', 'a']));
  it('currency and thousands separators count as numbers', () =>
    expect(sortRows([['£1,200'], ['£95'], ['£10.50']], { col: 0, dir: 'asc' }).map((r) => r[0])).toEqual(['£10.50', '£95', '£1,200']));
  it('mixed text sorts naturally', () => expect(sortRows([['Item 10'], ['Item 2']], { col: 0, dir: 'asc' }).map((r) => r[0])).toEqual(['Item 2', 'Item 10']));
  it('null keeps file order', () => expect(sortRows(rows, null)).toBe(rows));
  it('cycle', () => {
    expect(nextSort(null, 2)).toEqual({ col: 2, dir: 'asc' });
    expect(nextSort({ col: 2, dir: 'asc' }, 2)).toEqual({ col: 2, dir: 'desc' });
    expect(nextSort({ col: 2, dir: 'desc' }, 2)).toBe(null);
    expect(nextSort({ col: 1, dir: 'desc' }, 2)).toEqual({ col: 2, dir: 'asc' });
  });
});
