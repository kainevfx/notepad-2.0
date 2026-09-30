// @vitest-environment happy-dom
// Split view in the app: two real CodeMirror views, one per pane.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
vi.mock('../platform', () => ({ platform: new Proxy({ windowLabel: 'main' } as any, { get: (t, k) => (k in t ? t[k] : async () => null) }), isTauri: false }));

import { EditorView } from '@codemirror/view';
import { undo } from '@codemirror/commands';
import {
  docs, tree, activeId, newNote, activate, textOf, attachPaneView, getView, panes, focusPane, toggleSplit, closeDoc, removeDocs,
  sessionSnapshot, applySessionSplit,
} from './app';
import { createEditorState } from '../editor/setup';
import { SINGLE } from '../lib/panes';

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
  A = mk();
  attachPaneView('a', A);
});
afterEach(() => {
  attachPaneView('a', null);
  attachPaneView('b', null);
  for (const v of views) v.destroy();
  views = [];
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

describe('split view', () => {
  it('turning split on shows the next tab on the right', () => {
    const x = newNote({ text: 'x text', activate: false });
    const y = newNote({ text: 'y text', activate: false });
    activate(x);
    toggleSplit();
    B = mk();
    attachPaneView('b', B);
    expect(panes.value.docs).toEqual({ a: x, b: y });
    expect(A.state.doc.toString()).toBe('x text');
    expect(B.state.doc.toString()).toBe('y text');
    expect(getView()).toBe(A);
  });

  it('a clicked tab loads into the active pane', () => {
    const x = newNote({ text: 'x', activate: false });
    const y = newNote({ text: 'y', activate: false });
    const z = newNote({ text: 'z', activate: false });
    splitWith(x, y);
    focusPane('b');
    activate(z);
    expect(panes.value.docs).toEqual({ a: x, b: z });
    expect(B.state.doc.toString()).toBe('z');
    expect(A.state.doc.toString()).toBe('x');
    expect(getView()).toBe(B);
  });

  it('the same document on both sides stays identical while typing in either pane', () => {
    const x = newNote({ text: 'hello world', activate: false });
    const y = newNote({ text: 'y', activate: false });
    splitWith(x, y);
    focusPane('b');
    activate(x);
    for (let i = 0; i < 50; i++) {
      const v = i % 7 === 3 ? (focusPane('a'), A) : (focusPane('b'), B);
      const len = v.state.doc.length;
      if (i % 5 === 4 && len > 2) v.dispatch({ changes: { from: 1, to: 2 } });
      else type(v, (i * 7) % (len + 1), String.fromCharCode(97 + (i % 26)));
      expect(A.state.doc.toString()).toBe(B.state.doc.toString());
    }
    expect(textOf(x)).toBe(A.state.doc.toString());
  });

  it("undo in a pane undoes that pane's own edit and the other side follows", () => {
    const x = newNote({ text: 'abc', activate: false });
    const y = newNote({ text: 'y', activate: false });
    splitWith(x, y);
    focusPane('b');
    activate(x);
    type(B, 3, 'B');
    focusPane('a');
    type(A, 0, 'A');
    expect(B.state.doc.toString()).toBe('AabcB');
    focusPane('b');
    undo(B);
    expect(B.state.doc.toString()).toBe('Aabc');
    expect(A.state.doc.toString()).toBe('Aabc');
  });

  it('closing the document shown in the right pane moves that pane on', async () => {
    const x = newNote({ text: 'x', activate: false });
    const y = newNote({ text: 'y', activate: false });
    const z = newNote({ text: 'z', activate: false });
    splitWith(x, y);
    await closeDoc(y);
    expect(panes.value.docs.a).toBe(x);
    expect(panes.value.docs.b).toBe(z);
    expect(B.state.doc.toString()).toBe('z');
  });

  it('closing a document shown on both sides moves both', async () => {
    const x = newNote({ text: 'x', activate: false });
    const y = newNote({ text: 'y', activate: false });
    splitWith(x, y);
    focusPane('b');
    activate(x);
    focusPane('a');
    await closeDoc(x);
    expect(panes.value.docs).toEqual({ a: y, b: y });
    expect(A.state.doc.toString()).toBe('y');
    expect(B.state.doc.toString()).toBe('y');
  });

  it("a document moved to another window leaves the right pane", () => {
    const x = newNote({ text: 'x', activate: false });
    const y = newNote({ text: 'y', activate: false });
    splitWith(x, y);
    removeDocs([y]);
    expect(panes.value.docs.b).toBe(x);
  });

  it("turning split off keeps the active pane's document", () => {
    const x = newNote({ text: 'x', activate: false });
    const y = newNote({ text: 'y', activate: false });
    splitWith(x, y);
    focusPane('b');
    toggleSplit();
    attachPaneView('b', null);
    expect(panes.value.on).toBe(false);
    expect(activeId.value).toBe(y);
    expect(A.state.doc.toString()).toBe('y');
    expect(getView()).toBe(A);
  });

  it('the session keeps split view', () => {
    const x = newNote({ text: 'x', activate: false });
    const y = newNote({ text: 'y', activate: false });
    splitWith(x, y);
    const snap = sessionSnapshot();
    panes.value = SINGLE;
    applySessionSplit(snap.split, new Set([x, y]), x);
    expect(panes.value).toMatchObject({ on: true, docs: { a: x, b: y } });
  });
});
