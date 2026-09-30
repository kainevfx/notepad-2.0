import { describe, it, expect, vi, beforeEach } from 'vitest';
vi.mock('../platform', () => ({ platform: new Proxy({}, { get: () => async () => null }), isTauri: false }));
import { docs, activeId, setMdView, cycleMdView, type DocMeta } from './app';

const base: DocMeta = {
  id: 'x', kind: 'file', path: 'C:\\a.csv', title: 'a.csv', encoding: 'utf-8', bom: false, eol: 'crlf', language: 'plain',
  mdView: 'visual', dirty: false, mtime: 0, readonly: false, created: 0, modified: 0,
};
const put = (patch: Partial<DocMeta>) => {
  docs.value = { x: { ...base, ...patch } };
  activeId.value = 'x';
};

beforeEach(() => put({}));

describe('View / Source / Split for data files', () => {
  it('switching a CSV to Source keeps it plain text (not Markdown)', () => {
    put({ viewer: 'table' });
    setMdView('x', 'edit');
    expect(docs.value.x.mdView).toBe('edit');
    expect(docs.value.x.language).toBe('plain');
  });
  it('cycling goes View -> Source -> Split -> View', () => {
    put({ viewer: 'tree', mdView: 'visual' });
    cycleMdView();
    expect(docs.value.x.mdView).toBe('edit');
    cycleMdView();
    expect(docs.value.x.mdView).toBe('split');
    cycleMdView();
    expect(docs.value.x.mdView).toBe('visual');
    expect(docs.value.x.language).toBe('plain');
  });
  it('binary and source-only kinds do not cycle', () => {
    put({ viewer: 'sheet', mdView: 'visual' });
    cycleMdView();
    expect(docs.value.x.mdView).toBe('visual');
    put({ viewer: 'code', mdView: 'edit' });
    cycleMdView();
    expect(docs.value.x.mdView).toBe('edit');
    expect(docs.value.x.language).toBe('plain');
  });
  it('a plain .txt still becomes Markdown when cycled (unchanged behaviour)', () => {
    put({ path: 'C:\\a.txt', mdView: 'edit' });
    cycleMdView();
    expect(docs.value.x.language).toBe('markdown');
  });
});
