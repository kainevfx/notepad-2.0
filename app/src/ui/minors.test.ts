// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest';
vi.mock('../platform', () => ({ platform: new Proxy({ windowLabel: 'main', assetUrl: (p: string) => p } as any, { get: (t, k) => (k in t ? t[k] : async () => null) }), isTauri: false }));
import { h, render } from 'preact';
import { MenuBar } from './MenuBar';
import { PaperButton } from './PaperButton';
import { EditorArea } from './EditorPane';
import { settingsOpen, paperPopoverOpen } from '../state/ui';
import { newNote, activate, toggleSplit, panes } from '../state/app';
import { GUIDE_STEPS } from './guide-steps';

const tick = () => new Promise((r) => setTimeout(r, 20));
const mount = (vnode: any) => {
  const host = document.createElement('div');
  document.body.appendChild(host);
  render(vnode, host);
  return { host, done: () => (render(null, host), host.remove()) };
};

describe('split-view minors', () => {
  it('the Settings menu-bar item opens with a click (keyboard Enter/Space fire click)', async () => {
    settingsOpen.value = false;
    const m = mount(h(MenuBar, {}));
    const btn = [...m.host.querySelectorAll('.menubar-btn')].find((b) => b.textContent === 'Settings') as HTMLButtonElement;
    btn.click();
    await tick();
    expect(settingsOpen.value).toBe(true);
    btn.click();
    await tick();
    expect(settingsOpen.value).toBe(false);
    m.done();
  });

  it('only the Paper button you pressed shows its popover', async () => {
    paperPopoverOpen.value = false;
    const m = mount(h('div', {}, h(PaperButton as any, {}), h(PaperButton as any, { label: false })));
    (m.host.querySelector('.paper-anchor button') as HTMLButtonElement).click();
    await tick();
    expect(m.host.querySelectorAll('.paper-pop')).toHaveLength(1);
    m.done();
    paperPopoverOpen.value = false;
  });

  it('dragging over or focusing a pane makes it the active one', async () => {
    const x = newNote({ text: 'left', activate: false });
    newNote({ text: 'right', activate: false });
    const m = mount(h(EditorArea, {}));
    await tick();
    activate(x);
    toggleSplit();
    await tick();
    const panesEls = m.host.querySelectorAll('.editor-pane');
    panesEls[1].dispatchEvent(new Event('dragenter', { bubbles: true }));
    expect(panes.value.active).toBe('b');
    panesEls[0].dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    expect(panes.value.active).toBe('a');
    toggleSplit();
    m.done();
  });

  it("the guide's view-switch step prefers the active pane and always has a fallback", () => {
    const step = GUIDE_STEPS.find((s) => s.title === 'Visual, Source and Split')!;
    expect(step.target?.[0]).toBe('.pane-active .view-switch');
    expect(step.target).toContain('.editor-split');
  });
});
