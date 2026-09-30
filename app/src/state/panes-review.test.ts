// @vitest-environment happy-dom
// Regression tests for the split-view review findings (C1–C4, I1, I3–I7).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
vi.mock('../platform', () => ({ platform: new Proxy({ windowLabel: 'main' } as any, { get: (t, k) => (k in t ? t[k] : async () => null) }), isTauri: false }));
const answers: string[] = [];
vi.mock('./ui', async (orig) => ({ ...(await orig<typeof import('./ui')>()), ask: async () => ({ value: answers.shift() ?? 'cancel' }) }));

import { EditorView } from '@codemirror/view';
import {
  docs, tree, activeId, newNote, activate, textOf, attachPaneView, getView, panes, focusPane, toggleSplit, closeDoc, removeDocs,
  onQuickNoteUpdated, cmd, cycleMdView, activeView, printSourceElement, activeDoc, type DocMeta,
} from './app';
import { createEditorState } from '../editor/setup';
import { SINGLE, restore } from '../lib/panes';
import { visualApi } from '../editor/visual/sync';
import { targetFor, visualTarget, sourceTarget } from '../editor/format';

let views: EditorView[] = [];
const mk = () => {
  const v = new EditorView({ parent: document.body, state: createEditorState('', false, false, { paper: 'none', settings: { wordWrap: true } as any }) });
  views.push(v);
  return v;
};
const type = (v: EditorView, at: number, text: string) => v.dispatch({ changes: { from: at, insert: text }, userEvent: 'input.type' });

let A: EditorView;
let B: EditorView;
beforeEach(() => {
  docs.value = {};
  tree.value = [];
  activeId.value = null;
  panes.value = SINGLE;
  answers.length = 0;
  A = mk();
  attachPaneView('a', A);
});
afterEach(() => {
  attachPaneView('a', null);
  attachPaneView('b', null);
  for (const v of views) v.destroy();
  views = [];
  visualApi.editor = null;
});

function splitWith(x: string, y: string) {
  activate(x);
  toggleSplit();
  B = mk();
  attachPaneView('b', B);
  focusPane('b');
  activate(y);
  focusPane('a');
}
const quick = (text: string) => {
  const q = newNote({ text, activate: false });
  docs.value = { ...docs.value, [q]: { ...docs.value[q], quick: true } };
  return q;
};

describe('C1/C2: Quick Note updates reach the other pane', () => {
  it('a note shown only in the inactive pane shows the new text, and focusing it keeps it', () => {
    const x = newNote({ text: 'x', activate: false });
    const q = quick('old quick');
    splitWith(x, q);
    onQuickNoteUpdated({ id: q, text: 'NEW from bubble', from: 'quicknote' });
    expect(B.state.doc.toString()).toBe('NEW from bubble');
    focusPane('b');
    expect(textOf(q)).toBe('NEW from bubble');
  });
  it('a note shown on both sides stays identical after an update and more typing', () => {
    const q = quick('old quick');
    const y = newNote({ text: 'y', activate: false });
    splitWith(q, y);
    focusPane('b');
    activate(q);
    onQuickNoteUpdated({ id: q, text: 'NEW from bubble!!', from: 'quicknote' });
    expect(A.state.doc.toString()).toBe('NEW from bubble!!');
    type(B, 0, '> ');
    expect(A.state.doc.toString()).toBe('> NEW from bubble!!');
  });
});

describe('C3: restart with split on, pane B active, same document on both sides', () => {
  it('pane A shows the document, not the empty editor it replaced', () => {
    // Startup: pane A's empty editor mounts first (beforeEach), then the session restores split
    // view with B active, init activates the document, then Preact remounts A and mounts B.
    // (init awaits between restoring the session and activating, so Preact re-renders first).
    const x = newNote({ text: 'important note text', activate: false });
    panes.value = restore({ on: true, ratio: 0.5, active: 'b', docs: { a: x, b: x } }, () => true, x);
    activeId.value = x;
    const A1 = mk();
    B = mk();
    attachPaneView('a', null);
    attachPaneView('a', A1);
    attachPaneView('b', B);
    activate(x);
    expect(A1.state.doc.toString()).toBe('important note text');
    expect(B.state.doc.toString()).toBe('important note text');
    type(B, 0, '1 ');
    focusPane('a');
    type(A1, 0, '2 ');
    expect(textOf(x)).toBe('2 1 important note text');
  });
});

describe('C4 / I1: a pane with its own view (same document on both sides)', () => {
  it('Find in a Visual override pane switches that pane to Source', () => {
    const x = newNote({ text: '# t', activate: false });
    const y = newNote({ text: 'y', activate: false });
    docs.value = { ...docs.value, [x]: { ...docs.value[x], language: 'markdown', mdView: 'edit' } as DocMeta };
    splitWith(x, y);
    focusPane('b');
    activate(x);
    focusPane('a');
    panes.value = { ...panes.value, override: { a: 'visual', b: null } };
    visualApi.editor = {} as any;
    const q = vi.spyOn(globalThis, 'queueMicrotask').mockImplementation(() => {});
    cmd.find();
    q.mockRestore();
    expect(activeView(docs.value[x])).toBe('edit');
  });
  it('the toolbar follows the pane override', () => {
    const x = newNote({ text: '# t', activate: false });
    const y = newNote({ text: 'y', activate: false });
    docs.value = { ...docs.value, [x]: { ...docs.value[x], language: 'markdown', mdView: 'edit' } as DocMeta };
    splitWith(x, y);
    focusPane('b');
    activate(x);
    panes.value = { ...panes.value, override: { a: null, b: 'visual' } };
    expect(targetFor(activeDoc.value)).toBe(visualTarget);
    panes.value = { ...panes.value, override: { a: null, b: null } };
    expect(targetFor(activeDoc.value)).toBe(sourceTarget);
  });
  it('Ctrl+Shift+V cycles the active pane, not the other', () => {
    const x = newNote({ text: '# t', activate: false });
    const y = newNote({ text: 'y', activate: false });
    docs.value = { ...docs.value, [x]: { ...docs.value[x], language: 'markdown', mdView: 'visual' } as DocMeta };
    splitWith(x, y);
    focusPane('b');
    activate(x);
    cycleMdView();
    expect(activeView(docs.value[x])).toBe('edit');
    focusPane('a');
    expect(activeView(docs.value[x])).toBe('visual');
  });
});

describe('I3: Print uses the active pane', () => {
  it("picks the active pane's rendered page", () => {
    document.body.insertAdjacentHTML(
      'beforeend',
      '<section class="editor-pane in-split"><div class="visual-editor"><div class="ProseMirror">LEFT</div></div></section><section class="editor-pane in-split pane-active"><div class="visual-editor"><div class="ProseMirror">RIGHT</div></div></section>',
    );
    panes.value = { ...SINGLE, on: true, active: 'b', docs: { a: 'x', b: 'y' } };
    expect(printSourceElement()?.textContent).toBe('RIGHT');
    document.querySelectorAll('section.editor-pane').forEach((e) => e.remove());
  });
});

describe('I4 / I5: panes are never left blank', () => {
  it('after every document moves to another window, both panes show the new note', () => {
    const x = newNote({ text: 'x', activate: false });
    const y = newNote({ text: 'y', activate: false });
    splitWith(x, y);
    removeDocs([x, y]);
    const n = newNote({ text: 'fresh' });
    expect(panes.value.docs).toEqual({ a: n, b: n });
    expect(B.state.doc.toString()).toBe('fresh');
  });
  it('restore with no documents left is a single pane', () => expect(restore({ on: true, active: 'a', docs: { a: 'gone', b: 'gone' } }, () => false, null).on).toBe(false));
});

describe('I6: cancelling the save prompt for a file in the other pane', () => {
  it("leaves the active pane's document alone", async () => {
    const x = newNote({ text: 'x', activate: false });
    const y = newNote({ text: 'y', activate: false });
    docs.value = { ...docs.value, [y]: { ...docs.value[y], kind: 'file', path: 'C:\\y.txt', dirty: true } as DocMeta };
    splitWith(x, y);
    answers.push('cancel');
    expect(await closeDoc(y)).toBe(false);
    expect(panes.value.docs).toEqual({ a: x, b: y });
  });
});

describe("I7: closing an unrelated tab keeps the other pane's cursor", () => {
  it('cursor stays put', async () => {
    const x = newNote({ text: 'xxxxxxxx', activate: false });
    const y = newNote({ text: 'yyyyyyyyyy', activate: false });
    const z = newNote({ text: 'z', activate: false });
    splitWith(x, y);
    focusPane('b');
    activate(x);
    B.dispatch({ selection: { anchor: 6 } });
    focusPane('a');
    await closeDoc(z);
    expect(B.state.selection.main.head).toBe(6);
    expect(getView()).toBe(A);
  });
});

import { h, render } from 'preact';
import { VisualEditor } from '../ui/VisualEditor';

describe('I2 / I8: the Visual editor in the inactive pane', () => {
  it('follows edits after a short pause (not on every keystroke) and never stays the toolbar target', async () => {
    const x = newNote({ text: 'abc', activate: false });
    const y = newNote({ text: 'y', activate: false });
    docs.value = { ...docs.value, [x]: { ...docs.value[x], language: 'markdown', mdView: 'visual' } as DocMeta };
    splitWith(x, y);
    focusPane('b');
    activate(x);
    const host = document.createElement('div');
    document.body.appendChild(host);
    render(h(VisualEditor, { pane: 'a' }), host);
    const pm = () => host.querySelector('.ProseMirror')?.textContent;
    for (let i = 0; i < 200 && pm() !== 'abc'; i++) await new Promise((r) => setTimeout(r, 10));
    expect(pm()).toBe('abc');
    expect(visualApi.editor).toBeNull();
    type(B, 3, 'd');
    await new Promise((r) => setTimeout(r, 0));
    expect(pm()).toBe('abc');
    for (let i = 0; i < 200 && pm() !== 'abcd'; i++) await new Promise((r) => setTimeout(r, 10));
    expect(pm()).toBe('abcd');
    render(null, host);
    host.remove();
  });
});
