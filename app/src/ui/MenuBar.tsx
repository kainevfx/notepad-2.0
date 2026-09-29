import { useEffect, useState } from 'preact/hooks';
import type { MenuItem } from '../state/ui';
import { settingsOpen, paperPopoverOpen, closedNotesOpen } from '../state/ui';
import { settings, updateSettings } from '../state/settings';
import {
  activeDoc, activeId, newNote, openWithDialog, saveDoc, saveDocAs, saveAll, closeDoc, cmd, recentFiles, openFiles, hideToTray,
  quitApp, setMdView, setLanguage, cycleMdView, effectivePaper, refreshView, newGroupFrom, closedNotes, setPaper,
} from '../state/app';
import { platform } from '../platform';
import { MenuList } from './MenuList';
import { IcGear, IcPencil, IcSplit, IcEye, IcGrid, IcLines, IcNumbers, IcNone, IcSidebar, IcTabsTop } from './icons';
import { PaperPopover } from './PaperPopover';

type MenuName = 'File' | 'Edit' | 'View';

const rectOf = (el: HTMLElement) => {
  const r = el.getBoundingClientRect();
  return { left: r.left, top: r.bottom + 2 };
};

function fileMenu(): MenuItem[] {
  const d = activeDoc.value;
  const recent = recentFiles.value;
  return [
    { label: 'New text file', shortcut: 'Ctrl+N', action: () => newNote({ language: 'plain' }) },
    { label: 'New Markdown file', shortcut: 'Ctrl+Alt+N', action: () => newNote({ language: 'markdown' }) },
    { label: 'New Quick Note', shortcut: 'Win+Alt+N', action: () => platform.showQuickNote() },
    { label: 'Open', shortcut: 'Ctrl+O', action: () => openWithDialog() },
    {
      label: 'Recent',
      disabled: !recent.length,
      submenu: recent.length ? recent.map((p) => ({ label: p, action: () => openFiles([p]) })) : [{ label: 'Nothing yet', disabled: true }],
    },
    { label: `Closed notes (${closedNotes.value.length})`, action: () => (closedNotesOpen.value = true) },
    { separator: true },
    { label: 'Save', shortcut: 'Ctrl+S', action: () => d && saveDoc(d.id), disabled: !d },
    { label: 'Save as', shortcut: 'Ctrl+Shift+S', action: () => d && saveDocAs(d.id), disabled: !d },
    { label: 'Save all', shortcut: 'Ctrl+Alt+S', action: () => saveAll() },
    { separator: true },
    { label: 'Print', shortcut: 'Ctrl+P', action: () => cmd.print() },
    { separator: true },
    { label: 'Close tab', shortcut: 'Ctrl+W', action: () => d && closeDoc(d.id) },
    { label: 'Close window (to tray)', shortcut: 'Ctrl+Shift+W', action: () => hideToTray() },
    { label: 'Exit', action: () => quitApp() },
  ];
}

function editMenu(): MenuItem[] {
  return [
    { label: 'Undo', shortcut: 'Ctrl+Z', action: cmd.undo },
    { label: 'Redo', shortcut: 'Ctrl+Y', action: cmd.redo },
    { separator: true },
    { label: 'Cut', shortcut: 'Ctrl+X', action: cmd.cut },
    { label: 'Copy', shortcut: 'Ctrl+C', action: cmd.copy },
    { label: 'Paste', shortcut: 'Ctrl+V', action: cmd.paste },
    { label: 'Delete', shortcut: 'Del', action: cmd.del },
    { separator: true },
    { label: 'Find', shortcut: 'Ctrl+F', action: cmd.find },
    { label: 'Replace', shortcut: 'Ctrl+H', action: cmd.replace },
    { label: 'Go to', shortcut: 'Ctrl+G', action: () => cmd.goToLine() },
    { separator: true },
    { label: 'Select all', shortcut: 'Ctrl+A', action: cmd.selectAll },
    { label: 'Time/Date', shortcut: 'F5', action: cmd.timeDate },
    { separator: true },
    { label: 'Font', action: () => (settingsOpen.value = true) },
  ];
}

function viewMenu(): MenuItem[] {
  const s = settings.value;
  const d = activeDoc.value;
  const paper = effectivePaper(d);
  const setP = (p: typeof paper) => () => setPaper(p);
  return [
    {
      label: 'Zoom',
      submenu: [
        { label: 'Zoom in', shortcut: 'Ctrl+Plus', action: () => cmd.zoom(10) },
        { label: 'Zoom out', shortcut: 'Ctrl+Minus', action: () => cmd.zoom(-10) },
        { label: 'Restore default zoom', shortcut: 'Ctrl+0', action: () => cmd.zoom('reset') },
      ],
    },
    { label: 'Status bar', checked: s.statusBar, action: () => updateSettings({ statusBar: !s.statusBar }) },
    {
      label: 'Word wrap',
      checked: s.wordWrap,
      action: () => {
        updateSettings({ wordWrap: !s.wordWrap });
        refreshView();
      },
    },
    { separator: true },
    {
      label: 'Tabs',
      submenu: [
        { label: 'Along the top', checked: s.tabsMode === 'top', action: () => updateSettings({ tabsMode: 'top' }) },
        { label: 'Down the left side', checked: s.tabsMode === 'left', action: () => updateSettings({ tabsMode: 'left' }) },
        { label: 'Collapsed rail', checked: s.tabsMode === 'rail', action: () => updateSettings({ tabsMode: 'rail' }) },
        { separator: true },
        { label: 'New file group from this file', shortcut: 'Ctrl+Shift+G', action: () => activeId.value && newGroupFrom([activeId.value]) },
      ],
    },
    {
      label: 'Paper',
      submenu: [
        { label: 'Grid', checked: paper === 'grid', action: setP('grid') },
        { label: 'Lines', checked: paper === 'lines', action: setP('lines') },
        { label: 'Code', checked: paper === 'numbers', action: setP('numbers') },
        { label: 'None', checked: paper === 'none', action: setP('none') },
        { separator: true },
        { label: 'Page margin…', action: () => setTimeout(() => (paperPopoverOpen.value = true), 0) },
        { separator: true },
        { label: 'Also show line numbers', checked: s.paperNumbers, action: () => { updateSettings({ paperNumbers: !s.paperNumbers }); refreshView(); } },
      ],
    },
    {
      label: 'Markdown',
      submenu: [
        { label: 'Visual', checked: d?.language === 'markdown' && d.mdView === 'visual', action: () => d && setMdView(d.id, 'visual') },
        { label: 'Source', checked: d?.language === 'markdown' && d.mdView === 'edit', action: () => d && setMdView(d.id, 'edit') },
        { label: 'Source and preview', checked: d?.language === 'markdown' && d.mdView === 'split', action: () => d && setMdView(d.id, 'split') },
        { label: 'Cycle views', shortcut: 'Ctrl+Shift+V', action: () => cycleMdView() },
        { separator: true },
        { label: 'Treat this tab as plain text', checked: d?.language === 'plain', action: () => d && setLanguage(d.id, d.language === 'plain' ? 'markdown' : 'plain') },
      ],
    },
  ];
}

export function MenuBar() {
  const [open, setOpen] = useState<MenuName | null>(null);
  const [anchor, setAnchor] = useState({ left: 0, top: 0 });
  const d = activeDoc.value;
  const s = settings.value;
  const paper = effectivePaper(d);

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(null);
    const key = (e: KeyboardEvent) => e.key === 'Escape' && close();
    window.addEventListener('pointerdown', close);
    window.addEventListener('keydown', key);
    window.addEventListener('blur', close);
    return () => {
      window.removeEventListener('pointerdown', close);
      window.removeEventListener('keydown', key);
      window.removeEventListener('blur', close);
    };
  }, [open]);

  const items = open === 'File' ? fileMenu() : open === 'Edit' ? editMenu() : open === 'View' ? viewMenu() : [];
  const btn = (name: MenuName) => (
    <button
      class={`menubar-btn${open === name ? ' open' : ''}`}
      onPointerDown={(e) => {
        e.stopPropagation();
        setAnchor(rectOf(e.currentTarget as HTMLElement));
        setOpen(open === name ? null : name);
      }}
      onMouseEnter={(e) => {
        if (open && open !== name) {
          setAnchor(rectOf(e.currentTarget as HTMLElement));
          setOpen(name);
        }
      }}
    >
      {name}
    </button>
  );

  const PaperIcon = paper === 'grid' ? IcGrid : paper === 'lines' ? IcLines : paper === 'numbers' ? IcNumbers : IcNone;

  return (
    <div class="menubar">
      {btn('File')}
      {btn('Edit')}
      {btn('View')}
      {open && <MenuList items={items} onDone={() => setOpen(null)} style={{ position: 'fixed', left: `${anchor.left}px`, top: `${anchor.top}px` }} />}
      <div class="menubar-spacer" />
      {d && d.language === 'markdown' && (
        <div class="seg" role="group" aria-label="Markdown view">
          <button class={d.mdView === 'visual' ? 'on' : ''} title="Visual editing" onClick={() => setMdView(d.id, 'visual')}>
            <IcEye /> <span>Visual</span>
          </button>
          <button class={d.mdView === 'edit' ? 'on' : ''} title="Markdown source" onClick={() => setMdView(d.id, 'edit')}>
            <IcPencil /> <span>Source</span>
          </button>
          <button class={d.mdView === 'split' ? 'on' : ''} title="Source and preview side by side (Ctrl+Shift+V cycles)" onClick={() => setMdView(d.id, 'split')}>
            <IcSplit /> <span>Split</span>
          </button>
        </div>
      )}
      <div class="paper-anchor">
        <button
          class={`icon-btn${paperPopoverOpen.value ? ' pressed' : ''}`}
          title="Paper: Grid, Lines, Code, None, and page margin"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => (paperPopoverOpen.value = !paperPopoverOpen.value)}
        >
          <PaperIcon />
        </button>
        {paperPopoverOpen.value && <PaperPopover />}
      </div>
      <button
        class="icon-btn"
        title={s.tabsMode === 'top' ? 'Vertical tabs (Ctrl+Shift+,)' : 'Tabs along the top (Ctrl+Shift+,)'}
        onClick={() => cmd.toggleTabsMode()}
      >
        {s.tabsMode === 'top' ? <IcSidebar /> : <IcTabsTop />}
      </button>
      <button class={`icon-btn${settingsOpen.value ? ' pressed' : ''}`} title="Settings" onClick={() => (settingsOpen.value = !settingsOpen.value)}>
        <IcGear />
      </button>
    </div>
  );
}
