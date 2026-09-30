// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest';
vi.mock('../platform', () => ({ platform: new Proxy({ windowLabel: 'main', assetUrl: (p: string) => p } as any, { get: (t, k) => (k in t ? t[k] : async () => null) }), isTauri: false }));
import { h, render } from 'preact';
import { EditorArea } from './EditorPane';
import { newNote, activate, toggleSplit, panes } from '../state/app';

const tick = () => new Promise((r) => setTimeout(r, 20));

describe('EditorArea', () => {
  it('turning split on and off keeps the left pane (and its editor) mounted', async () => {
    const x = newNote({ text: 'left', activate: false });
    newNote({ text: 'right', activate: false });
    const host = document.createElement('div');
    document.body.appendChild(host);
    render(h(EditorArea, {}), host);
    await tick();
    activate(x);
    const left = () => host.querySelector('.editor-pane');
    const before = left();
    const cm = before?.querySelector('.cm-editor');
    toggleSplit();
    await tick();
    expect(panes.value.on).toBe(true);
    expect(host.querySelectorAll('.editor-pane')).toHaveLength(2);
    expect(left()).toBe(before);
    expect(left()?.querySelector('.cm-editor')).toBe(cm);
    toggleSplit();
    await tick();
    expect(host.querySelectorAll('.editor-pane')).toHaveLength(1);
    expect(left()).toBe(before);
    render(null, host);
    host.remove();
  });
});
