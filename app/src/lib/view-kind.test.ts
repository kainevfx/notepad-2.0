import { describe, it, expect } from 'vitest';
import { viewKindFor, isBinaryKind, hasViewPane, formatBytes } from './view-kind';

describe('viewKindFor', () => {
  const cases: [string, string][] = [
    ['a.csv', 'table'], ['a.TSV', 'table'], ['a.xlsx', 'sheet'], ['a.xls', 'sheet'], ['a.ods', 'sheet'],
    ['a.json', 'tree'], ['a.yaml', 'tree'], ['a.yml', 'tree'], ['a.xml', 'tree'], ['a.toml', 'code'], ['a.log', 'code'],
    ['a.ini', 'code'], ['a.cfg', 'code'], ['a.conf', 'code'], ['a.html', 'html'], ['a.htm', 'html'], ['a.png', 'image'],
    ['a.JPEG', 'image'], ['a.svg', 'image'], ['a.ico', 'image'], ['a.pdf', 'pdf'], ['a.docx', 'docx'], ['a.txt', 'text'],
    ['a.md', 'text'], ['README', 'text'], ['C:\\my.dir\\file', 'text'],
  ];
  for (const [p, k] of cases) it(p, () => expect(viewKindFor(p)).toBe(k));
  it('untitled is text', () => expect(viewKindFor(null)).toBe('text'));
  it('binary and view-pane kinds', () => {
    expect((['sheet', 'image', 'pdf', 'docx'] as const).every((k) => isBinaryKind(k))).toBe(true);
    expect(isBinaryKind('table')).toBe(false);
    expect(isBinaryKind(undefined)).toBe(false);
    expect((['table', 'tree', 'html'] as const).every((k) => hasViewPane(k))).toBe(true);
    expect(hasViewPane('code')).toBe(false);
  });
});

describe('formatBytes', () => {
  it('sizes', () => {
    expect(formatBytes(0)).toBe('0 bytes');
    expect(formatBytes(900)).toBe('900 bytes');
    expect(formatBytes(1536)).toBe('1.5 KB');
    expect(formatBytes(5 * 1024 * 1024)).toBe('5.0 MB');
    expect(formatBytes(undefined)).toBe('');
  });
});
