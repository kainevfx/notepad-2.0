// @vitest-environment happy-dom
// Regression tests for the read-aloud review (I2, I3, I4, I5 and minors).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
vi.mock('../platform', () => ({ platform: new Proxy({ windowLabel: 'main' } as any, { get: (t, k) => (k in t ? t[k] : async () => null) }), isTauri: false }));

import { EditorView } from '@codemirror/view';
import { currentSelection, readableFor } from './commands';
import { docs, tree, activeId, newNote, activate, attachPaneView, panes, cmd, type DocMeta } from '../state/app';
import { createEditorState } from '../editor/setup';
import { SINGLE, restore } from '../lib/panes';
import { visualApi } from '../editor/visual/sync';
import { createSpeechPlayer, type AudioHandle } from './player';
import { windowsHandle } from './engines';

let v: EditorView;
beforeEach(() => {
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
  visualApi.editor = null;
});

describe('I2: the hidden Source selection is never read', () => {
  it('in Visual, a Source selection made earlier is ignored', () => {
    const x = newNote({ text: 'one two three', activate: false });
    docs.value = { ...docs.value, [x]: { ...docs.value[x], language: 'markdown', mdView: 'visual' } as DocMeta };
    activate(x);
    v.contentDOM.blur();
    v.dispatch({ selection: { anchor: 4, head: 7 } });
    expect(currentSelection().text).toBe('');
  });
});

describe('I3: Edit commands in Visual act on the Visual editor', () => {
  it('Select all and Paste go to the Visual editor, not the hidden Source', async () => {
    const x = newNote({ text: 'abc', activate: false });
    docs.value = { ...docs.value, [x]: { ...docs.value[x], language: 'markdown', mdView: 'visual' } as DocMeta };
    activate(x);
    const calls: string[] = [];
    visualApi.editor = { commands: { selectAll: () => calls.push('selectAll'), focus: () => calls.push('focus') }, view: { pasteText: (t: string) => calls.push('paste ' + t), focus: () => {} } } as any;
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { readText: async () => 'CLIP' } });
    cmd.selectAll();
    await cmd.paste();
    expect(calls).toEqual(['selectAll', 'paste CLIP']);
    expect(v.state.doc.toString()).toBe('abc');
  });
});

function fakePlayer() {
  const pending: { resolve: (h: AudioHandle) => void }[] = [];
  const prepared: string[] = [];
  const prepare = vi.fn((text: string) => {
    prepared.push(text);
    return new Promise<AudioHandle>((resolve) => pending.push({ resolve }));
  });
  const player = createSpeechPlayer(prepare, () => {});
  const handle = (): AudioHandle => ({ playbackRate: 1, onended: null, onerror: null, play: vi.fn(async () => {}), pause: vi.fn(), dispose: vi.fn() });
  return { player, pending, prepared, handle };
}
const opts = { engine: 'kokoro' as const, endpoint: '', voice: 'bf_emma', windowsVoice: '', rate: 1 };

describe('I4: stopping while a reading is being set up', () => {
  it('a reading announced as loading and then stopped never starts', async () => {
    const { player, prepared } = fakePlayer();
    const token = player.announce('d', 'Doc');
    expect(player.state.status).toBe('loading');
    player.stop();
    await player.start('Hello.', 'd', 'Doc', opts, undefined, token);
    expect(prepared).toHaveLength(0);
    expect(player.state.status).toBe('idle');
  });
});

describe('I5: the next part is prepared while the current one plays', () => {
  it('chunk 2 is requested before chunk 1 ends', async () => {
    const { player, pending, prepared, handle } = fakePlayer();
    const work = player.start('Sentence one here. '.repeat(60), 'd', 'Doc', opts);
    pending[0].resolve(handle());
    await work;
    await Promise.resolve();
    expect(prepared.length).toBeGreaterThanOrEqual(2);
  });
  it('a prepared next part is thrown away when stopped', async () => {
    const { player, pending, handle } = fakePlayer();
    const work = player.start('Sentence one here. '.repeat(60), 'd', 'Doc', opts);
    pending[0].resolve(handle());
    await work;
    await Promise.resolve();
    player.stop();
    const late = handle();
    pending[1].resolve(late);
    await new Promise((r) => setTimeout(r, 0));
    expect(late.dispose).toHaveBeenCalled();
    expect(late.play).not.toHaveBeenCalled();
  });
});

describe('minors', () => {
  it('HTML files are read as their text, not their tags', () => {
    expect(readableFor('<html><style>p{}</style><body><h1>Hi</h1><p>there <b>you</b></p><script>x()</script></body></html>', 'html').trim()).toBe('Hi\n\nthere you');
  });
  it('a restored session drops a stale per-pane view', () => {
    expect(restore({ on: true, ratio: 0.5, active: 'a', docs: { a: 'x', b: 'y' }, override: { a: 'edit', b: null } }, () => true, 'x').override).toEqual({ a: null, b: null });
  });
  it('a Windows voice speed change applies straight away (restarts from the last word spoken)', async () => {
    const spoken: any[] = [];
    const synth = { speak: vi.fn((u: any) => spoken.push(u)), pause: vi.fn(), resume: vi.fn(), cancel: vi.fn() };
    class U {
      text: string;
      rate = 1;
      voice: any = null;
      onend: any = null;
      onerror: any = null;
      onboundary: any = null;
      constructor(t: string) {
        this.text = t;
      }
    }
    const h = windowsHandle('Hello there friend.', null, synth as any, U as any);
    await h.play();
    spoken[0].onboundary({ charIndex: 6 });
    h.playbackRate = 1.5;
    expect(synth.cancel).toHaveBeenCalled();
    expect(spoken).toHaveLength(2);
    expect(spoken[1].text).toBe('there friend.');
    expect(spoken[1].rate).toBe(1.5);
    const ended = vi.fn();
    h.onended = ended;
    spoken[0].onend?.();
    expect(ended).not.toHaveBeenCalled();
    spoken[1].onend();
    expect(ended).toHaveBeenCalled();
  });
});
