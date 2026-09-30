// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
vi.mock('../platform', () => ({ platform: new Proxy({ windowLabel: 'main' } as any, { get: (t, k) => (k in t ? t[k] : async () => null) }), isTauri: false }));
const { started, player } = vi.hoisted(() => {
  const player: any = { state: { status: 'idle', docId: '' } };
  player.stop = vi.fn(() => (player.state = { status: 'idle', docId: '' }));
  return { started: [] as { text: string; docId: string }[], player };
});
vi.mock('./state', () => ({
  speech: player,
  speechState: { value: { status: 'idle' } },
  startReading: vi.fn(async (text: string, docId: string) => {
    started.push({ text, docId });
    player.state = { status: 'playing', docId };
  }),
}));

import { EditorView } from '@codemirror/view';
import { readPage, readSelection, toggleReadAloud, stopIfDocClosed } from './commands';
import { docs, tree, activeId, newNote, activate, attachPaneView, panes, closeDoc, type DocMeta } from '../state/app';
import { createEditorState } from '../editor/setup';
import { SINGLE } from '../lib/panes';

let v: EditorView;
beforeEach(() => {
  started.length = 0;
  player.state = { status: 'idle', docId: '' };
  player.stop.mockClear();
  docs.value = {};
  tree.value = [];
  activeId.value = null;
  panes.value = SINGLE;
  v = new EditorView({ parent: document.body, state: createEditorState('', false, false, { paper: 'none', settings: { wordWrap: true } as any }) });
  attachPaneView('a', v);
});
afterEach(() => {
  attachPaneView('a', null);
  v.destroy();
});

const md = (id: string, patch: Partial<DocMeta> = {}) => (docs.value = { ...docs.value, [id]: { ...docs.value[id], language: 'markdown', mdView: 'edit', ...patch } as DocMeta });

describe('read aloud commands', () => {
  it('reads a Markdown page as plain words (no markup, no code)', async () => {
    const x = newNote({ text: '# Title\n\nHello **world**.\n\n```\nsecret()\n```', activate: false });
    md(x);
    activate(x);
    await readPage();
    expect(started[0].docId).toBe(x);
    expect(started[0].text).toContain('Hello world.');
    expect(started[0].text).not.toMatch(/secret|\*\*|#/);
  });

  it('reads the selection in Source when there is one', async () => {
    const x = newNote({ text: 'one two three', activate: false });
    activate(x);
    // (happy-dom fires selectionchange synchronously for a focused editor; real browsers don't)
    v.contentDOM.blur();
    v.dispatch({ selection: { anchor: 4, head: 7 } });
    await readSelection();
    expect(started[0].text).toBe('two');
  });

  it('Ctrl+Alt+R reads the selection, else the page, and stops when pressed while reading', async () => {
    const x = newNote({ text: 'alpha beta', activate: false });
    activate(x);
    await toggleReadAloud();
    expect(started[0].text).toBe('alpha beta');
    await toggleReadAloud();
    expect(player.stop).toHaveBeenCalled();
    expect(started).toHaveLength(1);
  });

  it('a data file reads its source; spreadsheets, images, PDFs and Word files are not read', async () => {
    const c = newNote({ text: 'a,b\n1,2', activate: false });
    docs.value = { ...docs.value, [c]: { ...docs.value[c], viewer: 'table', mdView: 'edit' } as DocMeta };
    activate(c);
    await readPage();
    expect(started[0].text).toBe('a,b\n1,2');
    const s = newNote({ text: '', activate: false });
    docs.value = { ...docs.value, [s]: { ...docs.value[s], viewer: 'sheet' } as DocMeta };
    activate(s);
    await readPage();
    expect(started).toHaveLength(1);
  });

  it('switching tabs keeps reading; closing the document being read stops it', async () => {
    const x = newNote({ text: 'read me', activate: false });
    const y = newNote({ text: 'other', activate: false });
    activate(x);
    await readPage();
    activate(y);
    stopIfDocClosed();
    expect(player.stop).not.toHaveBeenCalled();
    await closeDoc(x);
    stopIfDocClosed();
    expect(player.stop).toHaveBeenCalled();
  });
});
