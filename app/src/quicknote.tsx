// TrayNote window: a small always-on-top window above the tray. You open it and type.
// Everything autosaves into the app's note store, and the main window keeps each TrayNote's file
// in the save folder up to date ("note-saved" turns its dot green). Several TrayNotes are kept as
// mini-tabs along the top; the last tab is always + (a new TrayNote, never over the current one).
// × on a tab only hides it from this window: the note stays in the TrayNotes group.
import { render } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { useSignalEffect } from '@preact/signals';
import { EditorView, keymap, placeholder, drawSelection } from '@codemirror/view';
import { EditorState } from '@codemirror/state';
import { history, historyKeymap, defaultKeymap } from '@codemirror/commands';
import './styles/app.css';
import { platform } from './platform';
import { settings, loadSettings, updateSettings, isDark, systemDark, applyRemoteSettings, type Settings } from './state/settings';
import { noteTitle } from './lib/note-title';
import { encodeText } from './lib/encoding';
import { languageExt } from './editor/setup';
import { AppIcon, IcMore, IcClose, IcMic, IcPlus } from './ui/icons';
import { MenuList } from './ui/MenuList';
import type { MenuItem } from './state/ui';

const newId = () => 'note-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);

interface TrayTab {
  id: string;
  title: string;
  saved: boolean;
}
const TABS_KEY = 'traynotes.json';

function QuickNote() {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  /** While Windows voice typing is open it takes focus; don't hide the bubble on that blur. */
  const dictatingUntil = useRef(0);
  const idRef = useRef<string>('');
  const created = useRef<number>(Date.now());
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const [title, setTitleState] = useState('Untitled');
  const [status, setStatus] = useState('Saved');
  const [tabs, setTabsState] = useState<TrayTab[]>([]);
  const tabsRef = useRef<TrayTab[]>([]);
  const [cur, setCur] = useState('');
  const setTabs = (next: TrayTab[]) => {
    tabsRef.current = next;
    setTabsState(next);
    void platform.storeWrite(TABS_KEY, JSON.stringify({ ids: next.map((t) => t.id) }));
  };
  const patchTab = (id: string, patch: Partial<TrayTab>) => {
    const list = tabsRef.current;
    if (!list.some((t) => t.id === id)) return;
    const next = list.map((t) => (t.id === id ? { ...t, ...patch } : t));
    tabsRef.current = next;
    setTabsState(next);
  };
  const setTitle = (t: string) => {
    setTitleState(t);
    if (idRef.current) patchTab(idRef.current, { title: t });
  };
  const [menu, setMenu] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const replay = () => {
    const el = root.current;
    if (!el) return;
    el.style.animation = 'none';
    void el.offsetWidth;
    el.style.animation = '';
  };

  useSignalEffect(() => {
    systemDark.value;
    const dark = isDark();
    document.documentElement.classList.toggle('dark', dark);
    document.documentElement.classList.toggle('light', !dark);
  });

  const persist = async () => {
    clearTimeout(timer.current);
    const v = view.current;
    if (!v) return;
    const text = v.state.doc.toString();
    const id = idRef.current;
    if (!text.trim()) {
      setStatus('Empty notes are not kept');
      patchTab(id, { saved: true });
      return;
    }
    await platform.storeWrite(`notes/${id}.md`, text);
    await platform.emit('note-updated', { id, text, from: 'quicknote', created: created.current });
    // Green once the main window has written its file in the save folder ("note-saved").
    setStatus('Saving to the save folder…');
  };

  const load = async (id: string, text: string) => {
    idRef.current = id;
    setCur(id);
    if (!tabsRef.current.some((t) => t.id === id)) setTabs([...tabsRef.current, { id, title: noteTitle(text), saved: true }]);
    await platform.storeWrite('quicknote-current.json', JSON.stringify({ id }));
    const v = view.current!;
    v.setState(makeState(text));
    setTitle(noteTitle(text));
    v.dispatch({ selection: { anchor: text.length }, scrollIntoView: true });
    v.focus();
  };

  const makeState = (text: string) =>
    EditorState.create({
      doc: text,
      extensions: [
        history(),
        drawSelection(),
        EditorView.lineWrapping,
        placeholder('Start typing. It saves itself.'),
        languageExt(true),
        keymap.of([
          { key: 'Mod-n', run: () => (newNote(), true) },
          { key: 'Escape', run: () => (hide(), true) },
          { key: 'Mod-s', run: () => (saveAsFile(), true) },
          ...historyKeymap,
          ...defaultKeymap,
        ]),
        EditorView.updateListener.of((u) => {
          if (!u.docChanged) return;
          setTitle(noteTitle(u.state.doc.sliceString(0, 2000)));
          setStatus('Saving…');
          patchTab(idRef.current, { saved: false });
          clearTimeout(timer.current);
          timer.current = setTimeout(persist, 400);
        }),
      ],
    });

  const newNote = async () => {
    await persist();
    created.current = Date.now();
    await load(newId(), '');
    setStatus('New TrayNote');
  };

  /** Switch to another TrayNote tab (the current one is saved first). */
  const switchTo = async (id: string) => {
    if (id === idRef.current) return view.current?.focus();
    await persist();
    const text = (await platform.storeRead(`notes/${id}.md`)) ?? '';
    await load(id, text);
    setStatus('Saved');
  };

  /** × on a tab: hide it from this window only (it stays in the TrayNotes group). */
  const hideTab = async (id: string) => {
    const list = tabsRef.current;
    const i = list.findIndex((t) => t.id === id);
    if (i < 0) return;
    if (id === idRef.current) await persist();
    const rest = list.filter((t) => t.id !== id);
    setTabs(rest);
    if (id !== idRef.current) return;
    const next = rest[i] ?? rest[i - 1];
    if (next) await switchTo(next.id);
    else await newNote();
  };

  const hide = async () => {
    await persist();
    await platform.hideQuickNote();
  };

  const saveAsFile = async () => {
    await persist();
    const text = view.current?.state.doc.toString() ?? '';
    const name = (noteTitle(text).replace(/[\\/:*?"<>|…]/g, '').slice(0, 60) || 'TrayNote') + '.md';
    const path = await platform.saveDialog(name, true);
    if (!path) return;
    try {
      await platform.writeFile(path, encodeText(text, 'utf-8', false, 'crlf'));
      await platform.storeDelete(`notes/${idRef.current}.md`);
      await platform.emit('quicknote-saved-as', { id: idRef.current, path });
      setStatus(`Saved to ${path.split(/[\\/]/).pop()}`);
      created.current = Date.now();
      // It's a file now, not a TrayNote: its tab goes.
      const gone = idRef.current;
      const rest = tabsRef.current.filter((t) => t.id !== gone);
      setTabs(rest);
      if (rest.length) {
        const text2 = (await platform.storeRead(`notes/${rest[rest.length - 1].id}.md`)) ?? '';
        await load(rest[rest.length - 1].id, text2);
      } else await load(newId(), '');
    } catch (e) {
      setStatus(`Couldn't save: ${String(e)}`);
    }
  };

  const place = () => platform.placeQuickNote(settings.value.quickNoteSize === 'quarter' ? 1 / 4 : 1 / 8).catch(() => {});

  // Re-read the note when the bubble opens: the main window may have edited it.
  const refresh = async () => {
    const id = idRef.current;
    const text = (await platform.storeRead(`notes/${id}.md`)) ?? '';
    const v = view.current;
    if (v && text && text !== v.state.doc.toString()) {
      v.setState(makeState(text));
      setTitle(noteTitle(text));
    }
    v?.dispatch({ selection: { anchor: v.state.doc.length } });
    v?.focus();
  };

  useEffect(() => {
    view.current = new EditorView({ parent: host.current!, state: makeState('') });
    (async () => {
      await loadSettings();
      const cur = await platform.storeRead('quicknote-current.json');
      let id = cur ? (JSON.parse(cur).id as string) : newId();
      let text = (await platform.storeRead(`notes/${id}.md`)) ?? '';
      if (cur && !text) id = newId();
      if (!text) text = '';
      // The tab row: saved list, else just the current note. Tabs whose note is gone are dropped.
      let ids: string[] = [];
      try {
        ids = JSON.parse((await platform.storeRead(TABS_KEY)) ?? '{}').ids ?? [];
      } catch {
        ids = [];
      }
      const list: TrayTab[] = [];
      for (const t of ids) {
        if (t === id) {
          list.push({ id, title: noteTitle(text), saved: true });
          continue;
        }
        const body = await platform.storeRead(`notes/${t}.md`);
        if (body && body.trim()) list.push({ id: t, title: noteTitle(body), saved: true });
      }
      if (!list.some((t) => t.id === id)) list.push({ id, title: noteTitle(text), saved: true });
      setTabs(list);
      await load(id, text);
      await place();
      platform.setAlwaysOnTop(settings.value.quickNotePinned);
    })();
    const subs = [
      platform.listen('quicknote-shown', () => {
        replay();
        place();
        refresh();
      }),
      platform.listen('quicknote-new', () => newNote()),
      platform.listen<Settings>('settings-changed', (s) => {
        applyRemoteSettings(s);
        place();
        platform.setAlwaysOnTop(s.quickNotePinned);
      }),
      platform.listen<{ id: string }>('note-saved', ({ id }) => {
        patchTab(id, { saved: true });
        if (id === idRef.current) setStatus('Saved');
      }),
      platform.listen<string>('traynote-show', async (id) => {
        if (!tabsRef.current.some((t) => t.id === id)) {
          const body = (await platform.storeRead(`notes/${id}.md`)) ?? '';
          setTabs([...tabsRef.current, { id, title: noteTitle(body), saved: true }]);
        }
        await switchTo(id);
      }),
      platform.listen<{ id: string; text: string; from: string }>('note-updated', (p) => {
        if (p.from !== 'quicknote') patchTab(p.id, { title: noteTitle(p.text) });
        if (p.from === 'quicknote' || p.id !== idRef.current) return;
        const v = view.current;
        if (v && !v.hasFocus && p.text !== v.state.doc.toString()) {
          v.setState(makeState(p.text));
          setTitle(noteTitle(p.text));
        }
      }),
    ];
    const onBlur = () => {
      persist();
      if (Date.now() < dictatingUntil.current) return;
      if (settings.value.quickNoteHideOnBlur && !document.querySelector('.menu')) setTimeout(() => !document.hasFocus() && platform.hideQuickNote(), 150);
    };
    window.addEventListener('blur', onBlur);
    const endDictation = () => (dictatingUntil.current = 0);
    window.addEventListener('pointerdown', endDictation);
    // Voice typing hands focus back when it closes; from then on hide-on-blur works again.
    const onFocusBack = () => setTimeout(endDictation, 1500);
    window.addEventListener('focus', onFocusBack);
    return () => {
      subs.forEach((p) => p.then((u) => u()));
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('pointerdown', endDictation);
      window.removeEventListener('focus', onFocusBack);
    };
  }, []);

  const menuItems: MenuItem[] = [
    {
      label: 'Open in main window',
      action: async () => {
        await persist();
        await platform.emit('open-doc', idRef.current);
        await platform.showMain();
        await platform.hideQuickNote();
      },
    },
    { label: 'New TrayNote', shortcut: 'Ctrl+N', action: () => newNote() },
    { label: 'Hide this tab', action: () => hideTab(idRef.current), disabled: tabs.length < 1 },
    { label: 'Save as file…', shortcut: 'Ctrl+S', action: () => saveAsFile() },
    { separator: true },
    {
      label: 'Size',
      submenu: [
        { label: '1/8 of the screen', checked: settings.value.quickNoteSize === 'eighth', action: () => { updateSettings({ quickNoteSize: 'eighth' }); setTimeout(place, 50); } },
        { label: '1/4 of the screen', checked: settings.value.quickNoteSize === 'quarter', action: () => { updateSettings({ quickNoteSize: 'quarter' }); setTimeout(place, 50); } },
      ],
    },
    {
      label: 'Keep on top',
      checked: settings.value.quickNotePinned,
      action: () => {
        const on = !settings.value.quickNotePinned;
        updateSettings({ quickNotePinned: on });
        platform.setAlwaysOnTop(on);
      },
    },
    { label: 'Hide when I click away', checked: settings.value.quickNoteHideOnBlur, action: () => updateSettings({ quickNoteHideOnBlur: !settings.value.quickNoteHideOnBlur }) },
    { separator: true },
    { label: 'Settings', action: () => platform.emit('open-settings') },
  ];

  return (
    <div class="qn" ref={root}>
      <div class="qn-head" data-tauri-drag-region>
        <AppIcon size={16} />
        <span class="qn-name" data-tauri-drag-region>
          TrayNote
        </span>
        {platform.kind === 'tauri' && (
          <button
            class="icon-btn qn-mic"
            title="Dictate (Windows voice typing, Win+H)"
            aria-label="Dictate"
            onPointerDown={(e) => e.preventDefault()}
            onClick={() => {
              // Put the cursor in the note, then start Windows voice typing there.
              view.current?.focus();
              dictatingUntil.current = Date.now() + 5 * 60_000;
              setTimeout(() => platform.startVoiceTyping().catch(() => {}), 60);
            }}
          >
            <IcMic />
          </button>
        )}
        <button class="icon-btn" title="More" onPointerDown={(e) => e.stopPropagation()} onClick={() => setMenu(!menu)}>
          <IcMore />
        </button>
        <button class="icon-btn close" title="Hide (Esc)" onClick={() => hide()}>
          <IcClose />
        </button>
      </div>
      {menu && (
        <div onPointerDown={() => setMenu(false)} style={{ position: 'fixed', inset: 0, zIndex: 999 }}>
          <MenuList items={menuItems} onDone={() => setMenu(false)} style={{ position: 'fixed', right: '44px', top: '38px' }} />
        </div>
      )}
      <div class="qn-tabs" role="tablist" aria-label="TrayNotes">
        {tabs.map((t) => (
          <div
            key={t.id}
            role="tab"
            aria-selected={t.id === cur}
            class={`qn-tab${t.id === cur ? ' on' : ''}`}
            title={`${t.title}${t.saved ? '' : ' (unsaved changes)'}`}
            onClick={() => switchTo(t.id)}
          >
            <span class={`save-dot ${t.saved ? 'saved' : 'unsaved'}`} />
            <span class="qn-tab-title">{t.title}</span>
            <button
              class="qn-tab-x"
              title="Hide from this window (it stays in the TrayNotes group)"
              onClick={(e) => {
                e.stopPropagation();
                void hideTab(t.id);
              }}
            >
              <IcClose size={10} />
            </button>
          </div>
        ))}
        <button class="qn-tab qn-tab-add" title="New TrayNote (Ctrl+N)" aria-label="New TrayNote" onClick={() => newNote()}>
          <IcPlus size={14} />
        </button>
      </div>
      <div class="qn-title">{title}</div>
      <div class="qn-editor" ref={host} />
      <div class="qn-foot">
        <span class="qn-status">{status}</span>
        <button class="btn" onClick={() => saveAsFile()}>
          Save as file…
        </button>
      </div>
    </div>
  );
}

render(<QuickNote />, document.getElementById('app')!);
