import { describe, it, expect } from 'vitest';
import { parseCsv, detectDelimiter, toCsv } from './csv';

describe('parseCsv', () => {
  it('quotes, doubled quotes, embedded delimiter and newline', () =>
    expect(parseCsv('a,b\r\n"x, y","say ""hi""\nthere"\r\n', ',').rows).toEqual([['a', 'b'], ['x, y', 'say "hi"\nthere']]));
  it('ragged rows are padded to the widest row', () => expect(parseCsv('a,b,c\n1\n', ',').rows).toEqual([['a', 'b', 'c'], ['1', '', '']]));
  it('no trailing empty row; BOM stripped', () => expect(parseCsv('﻿a\nb', ',').rows).toEqual([['a'], ['b']]));
  it('empty text is no rows', () => expect(parseCsv('', ',').rows).toEqual([]));
  it('empty fields and a trailing delimiter', () => expect(parseCsv('a,,c,\n', ',').rows).toEqual([['a', '', 'c', '']]));
  it('cell cap stops at whole rows', () => {
    const r = parseCsv('a,b\n1,2\n3,4\n', ',', 4);
    expect(r.rows).toEqual([['a', 'b'], ['1', '2']]);
    expect(r.truncated).toBe(true);
  });
  it('tab separated', () => expect(parseCsv('a\tb\n1\t2', '\t').rows).toEqual([['a', 'b'], ['1', '2']]));
});

describe('detectDelimiter', () => {
  it('tsv by extension', () => expect(detectDelimiter('a,b', 'x.tsv')).toBe('\t'));
  it('semicolon when more consistent', () => expect(detectDelimiter('a;b;c\n1;2,5;3\n4;5;6', 'x.csv')).toBe(';'));
  it('comma default', () => expect(detectDelimiter('a,b\n1,2', 'x.csv')).toBe(','));
  it('tab in a .csv', () => expect(detectDelimiter('a\tb\n1\t2', 'x.csv')).toBe('\t'));
  it('commas inside quotes do not count', () => expect(detectDelimiter('"a,b,c";d\n"1,2,3";4', 'x.csv')).toBe(';'));
  it('a single column stays comma', () => expect(detectDelimiter('one\ntwo', null)).toBe(','));
});

describe('toCsv', () => {
  it('quotes only when needed', () => expect(toCsv([['a', 'b,c'], ['say "hi"', 'x\ny']])).toBe('a,"b,c"\r\n"say ""hi""","x\ny"\r\n'));
  it('round trips', () => {
    const rows = [['Name', 'Note'], ['Ann', 'likes "tea", and\ncake']];
    expect(parseCsv(toCsv(rows), ',').rows).toEqual(rows);
  });
});

describe('detectDelimiter across multi-line quoted cells', () => {
  it('a semicolon export with a line break inside a quoted cell', () => {
    const text = 'a;b;c\r\n1;"x\r\ny";3\r\n4;5;6';
    expect(detectDelimiter(text, 'x.csv')).toBe(';');
    expect(parseCsv(text, detectDelimiter(text, 'x.csv')).rows).toEqual([['a', 'b', 'c'], ['1', 'x\r\ny', '3'], ['4', '5', '6']]);
  });
});
