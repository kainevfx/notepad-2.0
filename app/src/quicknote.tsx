// Quick Note bubble: a small always-on-top window above the tray. You open it and type.
// Everything autosaves into the app's note store; "Save as file…" turns it into a real file.
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
import { AppIcon, IcMore, IcClose } from './ui/icons';
import { MenuList } from './ui/MenuList';
import type { MenuItem } from './state/ui';

const newId = () => 'note-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);

function QuickNote() {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const idRef = useRef<string>('');
  const created = useRef<number>(Date.now());
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const [title, setTitle] = useState('Untitled');
  const [status, setStatus] = useState('Saved');
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
      return;
    }
    await platform.storeWrite(`notes/${id}.md`, text);
    await platform.emit('note-updated', { id, text, from: 'quicknote', created: created.current });
    setStatus('Saved');
  };

  const load = async (id: string, text: string) => {
    idRef.current = id;
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
          clearTimeout(timer.current);
          timer.current = setTimeout(persist, 400);
        }),
      ],
    });

  const newNote = async () => {
    await persist();
    created.current = Date.now();
    await load(newId(), '');
    setStatus('New note');
  };

  const hide = async () => {
    await persist();
    await platform.hideQuickNote();
  };

  const saveAsFile = async () => {
    await persist();
    const text = view.current?.state.doc.toString() ?? '';
    const name = (noteTitle(text).replace(/[\\/:*?"<>|…]/g, '').slice(0, 60) || 'Quick note') + '.md';
    const path = await platform.saveDialog(name, true);
    if (!path) return;
    try {
      await platform.writeFile(path, encodeText(text, 'utf-8', false, 'crlf'));
      await platform.storeDelete(`notes/${idRef.current}.md`);
      await platform.emit('quicknote-saved-as', { id: idRef.current, path });
      setStatus(`Saved to ${path.split(/[\\/]/).pop()}`);
      created.current = Date.now();
      await load(newId(), '');
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
      platform.listen<{ id: string; text: string; from: string }>('note-updated', (p) => {
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
      if (settings.value.quickNoteHideOnBlur && !document.querySelector('.menu')) setTimeout(() => !document.hasFocus() && platform.hideQuickNote(), 150);
    };
    window.addEventListener('blur', onBlur);
    return () => {
      subs.forEach((p) => p.then((u) => u()));
      window.removeEventListener('blur', onBlur);
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
    { label: 'New quick note', shortcut: 'Ctrl+N', action: () => newNote() },
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
          Quick Note
        </span>
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
