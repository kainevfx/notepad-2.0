// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest';
vi.mock('../platform', () => ({ platform: new Proxy({ windowLabel: 'main', assetUrl: (p: string) => 'asset:' + p } as any, { get: (t, k) => (k in t ? t[k] : async () => null) }), isTauri: false }));
import { h, render } from 'preact';
import { VisualEditor } from './VisualEditor';
import { docs, newNote, panes, activeId, type DocMeta } from '../state/app';
import { SINGLE } from '../lib/panes';

describe('images in split view', () => {
  it("each pane's Visual editor loads images from its own document's folder", async () => {
    const x = newNote({ text: '![a](pic.png)', activate: false });
    const y = newNote({ text: '![b](pic.png)', activate: false });
    const md = (id: string, path: string) => ({ ...docs.value[id], kind: 'file', path, language: 'markdown', mdView: 'visual' }) as DocMeta;
    docs.value = { ...docs.value, [x]: md(x, 'C:\\Left\\x.md'), [y]: md(y, 'D:\\Right\\y.md') };
    panes.value = { ...SINGLE, on: true, active: 'a', docs: { a: x, b: y } };
    activeId.value = x;
    const host = document.createElement('div');
    document.body.appendChild(host);
    render(h('div', {}, h(VisualEditor, { pane: 'a' }), h(VisualEditor, { pane: 'b' })), host);
    const srcs = () => [...host.querySelectorAll('img:not(.ProseMirror-separator)')].map((i) => i.getAttribute('src'));
    for (let i = 0; i < 100 && srcs().length < 2; i++) await new Promise((r) => setTimeout(r, 10));
    expect(srcs()).toEqual(['asset:C:\\Left\\pic.png', 'asset:D:\\Right\\pic.png']);
    render(null, host);
    host.remove();
  });
});
