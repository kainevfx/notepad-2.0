// @vitest-environment happy-dom
// Regression tests for the file-viewers review findings (Important 1, 2, 5, 8).
import { describe, it, expect, vi, beforeEach } from 'vitest';

const P = vi.hoisted(() => {
  const files: Record<string, { bytes: Uint8Array; size?: number }> = {};
  const writes: { path: string; bytes: Uint8Array }[] = [];
  const platform: any = {
    windowLabel: 'main',
    kind: 'tauri',
    stat: async (p: string) => (files[p] ? { exists: true, mtime: 1, size: files[p].size ?? files[p].bytes.length, readonly: false } : { exists: false, mtime: 0, size: 0, readonly: false }),
    readFile: async (p: string) => ({ bytes: files[p].bytes, mtime: 1, readonly: false }),
    writeFile: async (p: string, b: Uint8Array) => {
      writes.push({ path: p, bytes: b });
      files[p] = { bytes: b };
      return 2;
    },
    saveDialog: async () => 'C:\\out\\Budget - Sheet1.csv',
  };
  return { files, writes, platform: new Proxy(platform, { get: (t, k) => (k in t ? t[k] : async () => null) }) };
});
vi.mock('../platform', () => ({ platform: P.platform, isTauri: true }));
const asked: string[] = [];
vi.mock('./ui', async (orig) => ({
  ...(await orig<typeof import('./ui')>()),
  ask: async (spec: { body?: string }) => (asked.push(spec.body ?? ''), { value: 'cancel' }),
  alertMsg: async () => {},
}));

import { EditorView } from '@codemirror/view';
import { docs, tree, activeId, importDocs, duplicateDoc, openFiles, textOf, attachPaneView, cmd, sheetExport, saveSheetCsv, type DocMeta } from './app';
import { createEditorState } from '../editor/setup';

const enc = (s: string) => new TextEncoder().encode(s);
const meta = (patch: Partial<DocMeta>): DocMeta => ({
  id: 'd1', kind: 'file', path: 'C:\\p\\Budget.xlsx', title: 'Budget.xlsx', encoding: 'utf-8', bom: false, eol: 'crlf', language: 'plain',
  mdView: 'visual', dirty: false, mtime: 1, readonly: true, created: 0, modified: 0, ...patch,
});

beforeEach(() => {
  for (const k of Object.keys(P.files)) delete P.files[k];
  P.writes.length = 0;
  asked.length = 0;
  docs.value = {};
  tree.value = [];
  activeId.value = null;
});

describe('Duplicate a binary file', () => {
  it('copies the bytes instead of writing an empty file', async () => {
    P.files['C:\\p\\Budget.xlsx'] = { bytes: new Uint8Array([80, 75, 3, 4, 9]) };
    importDocs([{ meta: meta({ viewer: 'sheet', size: 5 }), text: '' }]);
    await duplicateDoc('d1');
    expect(P.writes).toHaveLength(1);
    expect(P.writes[0].path).toBe('C:\\p\\Budget (2).xlsx');
    expect(Array.from(P.writes[0].bytes)).toEqual([80, 75, 3, 4, 9]);
  });
});

describe('Files over 50 MB', () => {
  const big = 60 * 1024 * 1024;
  it('a big log still opens as text', async () => {
    P.files['C:\\logs\\server.log'] = { bytes: enc('boot ok\nERROR x'), size: big };
    const id = await openFiles(['C:\\logs\\server.log']);
    expect(docs.value[id!].viewer).toBe('code');
    expect(textOf(id!)).toBe('boot ok\nERROR x');
  });
  it('a big CSV opens as its source (no grid)', async () => {
    P.files['C:\\d\\big.csv'] = { bytes: enc('a,b\n1,2'), size: big };
    const id = await openFiles(['C:\\d\\big.csv']);
    expect(docs.value[id!].viewer).toBe('code');
    expect(textOf(id!)).toBe('a,b\n1,2');
  });
  it('a big image keeps its kind (the viewer shows the too-large notice)', async () => {
    P.files['C:\\d\\huge.png'] = { bytes: new Uint8Array(1), size: big };
    const id = await openFiles(['C:\\d\\huge.png']);
    expect(docs.value[id!].viewer).toBe('image');
    expect(docs.value[id!].size).toBe(big);
  });
});

describe('Commands never edit a hidden source', () => {
  it('F5 (time/date) does nothing on a CSV shown as a grid', async () => {
    P.files['C:\\d\\cast.csv'] = { bytes: enc('a,b\n1,2') };
    const id = (await openFiles(['C:\\d\\cast.csv']))!;
    const v = new EditorView({ parent: document.body, state: createEditorState('', false, false, { paper: 'none', settings: {} as any }) });
    attachPaneView('a', v);
    activeId.value = null;
    const { activate } = await import('./app');
    activate(id);
    expect(docs.value[id].mdView).toBe('visual');
    cmd.timeDate();
    cmd.del();
    cmd.paste();
    expect(textOf(id)).toBe('a,b\n1,2');
    expect(docs.value[id].dirty).toBe(false);
    attachPaneView('a', null);
    v.destroy();
  });
});

describe('Save sheet as CSV', () => {
  it('warns before saving a sheet that was cut short, and Cancel saves nothing', async () => {
    P.files['C:\\p\\Budget.xlsx'] = { bytes: new Uint8Array([1]) };
    importDocs([{ meta: meta({ viewer: 'sheet' }), text: '' }]);
    sheetExport.current = () => ({ name: 'Sheet1', rows: [['a']], truncated: true });
    await saveSheetCsv('d1');
    expect(asked.join()).toContain('200,000');
    expect(P.writes).toHaveLength(0);
  });
});
