import { invoke, convertFileSrc } from '@tauri-apps/api/core';
import { emit, emitTo, listen } from '@tauri-apps/api/event';
import { getCurrentWindow, Window, primaryMonitor, LogicalPosition, LogicalSize, cursorPosition } from '@tauri-apps/api/window';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import { open as openDlg, save as saveDlg } from '@tauri-apps/plugin-dialog';
import { documentDir } from '@tauri-apps/api/path';
import type { FileRead, FileStat, IntegrationState, LaunchArgs, Platform, Unlisten } from './types';
import { FILE_TYPES } from './types';

const TEXT_FILTERS = [
  { name: 'Text documents', extensions: ['txt', 'md', 'markdown', 'log', 'ini', 'cfg', 'json', 'csv'] },
  { name: 'All files', extensions: ['*'] },
];
const OPEN_FILTERS = [
  { name: 'All supported files', extensions: FILE_TYPES.map((e) => e.slice(1)) },
  { name: 'Text and Markdown', extensions: ['txt', 'md', 'markdown', 'log', 'ini', 'cfg', 'conf', 'toml'] },
  { name: 'Data (CSV, JSON, YAML, XML)', extensions: ['csv', 'tsv', 'json', 'yaml', 'yml', 'xml'] },
  { name: 'Spreadsheets', extensions: ['xlsx', 'xls', 'ods'] },
  { name: 'Documents (HTML, PDF, Word)', extensions: ['html', 'htm', 'pdf', 'docx'] },
  { name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'ico'] },
  { name: 'All files', extensions: ['*'] },
];

async function windowByLabel(label: string): Promise<Window | null> {
  return Window.getByLabel(label);
}

export function createTauriPlatform(): Platform {
  const win = getCurrentWindow();
  return {
    kind: 'tauri',
    windowLabel: win.label,

    launchArgs: () => invoke<LaunchArgs>('get_launch_args'),
    onSecondInstance: (cb) => getCurrentWebviewWindow().listen<LaunchArgs>('second-instance', (e) => cb(e.payload)),

    async readFile(path) {
      const [bytes, st] = await Promise.all([
        invoke<ArrayBuffer>('read_file', { path }),
        invoke<FileStat>('file_stat', { path }),
      ]);
      return { bytes: new Uint8Array(bytes), mtime: st.mtime, readonly: st.readonly, created: st.created } as FileRead;
    },
    writeFile: (path, bytes) =>
      invoke<number>('write_file', bytes, { headers: { 'x-path': encodeURIComponent(path) } }),
    stat: (path) => invoke<FileStat>('file_stat', { path }),
    renameFile: (from, to) => invoke<void>('rename_file', { from, to }),
    deleteIfEmpty: (path) => invoke<void>('delete_if_empty', { path }),
    documentsDir: () => documentDir(),
    pathKind: (path) => invoke<'file' | 'dir' | 'missing'>('path_kind', { path }),
    openFolder: (path) => invoke<void>('open_folder', { path }),
    openDefault: (path) => invoke<void>('open_default', { path }),
    readSheet: (path) => invoke('read_sheet', { path }),
    async pickPath(kind) {
      const r = await openDlg({ multiple: false, directory: kind === 'folder' });
      return typeof r === 'string' ? r : null;
    },
    async openImageDialog() {
      const r = await openDlg({ multiple: false, filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp'] }] });
      return typeof r === 'string' ? r : null;
    },
    async openDialog() {
      const r = await openDlg({ multiple: true, filters: OPEN_FILTERS });
      if (!r) return [];
      return Array.isArray(r) ? r : [r];
    },
    saveDialog: (defaultName, markdown) =>
      saveDlg({
        defaultPath: defaultName,
        filters: markdown
          ? [{ name: 'Markdown', extensions: ['md'] }, ...TEXT_FILTERS]
          : [{ name: 'Text documents', extensions: ['txt'] }, ...TEXT_FILTERS],
      }),

    storeRead: (key) => invoke<string | null>('store_read', { key }),
    storeWrite: (key, text) => invoke<void>('store_write', { key, text }),
    storeDelete: (key) => invoke<void>('store_delete', { key }),
    storeList: (dir) => invoke<string[]>('store_list', { dir }),

    minimize: () => win.minimize(),
    toggleMaximize: () => win.toggleMaximize(),
    isMaximized: () => win.isMaximized(),
    onResized: (cb) => win.onResized(() => cb()),
    hide: () => win.hide(),
    async show() {
      await win.show();
      await win.unminimize();
      await win.setFocus();
    },
    setTitle: (t) => win.setTitle(t),
    onCloseRequested: (cb) =>
      win.onCloseRequested((e) => {
        e.preventDefault();
        cb();
      }),
    onFocus: (cb) =>
      win.onFocusChanged(({ payload }) => {
        if (payload) cb();
      }),
    setAlwaysOnTop: (on) => win.setAlwaysOnTop(on),

    async placeQuickNote(fraction) {
      const qn = (await windowByLabel('quicknote')) ?? win;
      const mon = await primaryMonitor();
      if (!mon) return;
      const s = mon.scaleFactor;
      const wa = { x: mon.workArea.position.x / s, y: mon.workArea.position.y / s, w: mon.workArea.size.width / s, h: mon.workArea.size.height / s };
      const full = { x: mon.position.x / s, y: mon.position.y / s, w: mon.size.width / s, h: mon.size.height / s };
      // 1/8 or 1/4 of the screen area, portrait-ish like the mockup.
      const area = full.w * full.h * fraction;
      const w = Math.round(Math.min(wa.w - 24, Math.max(360, Math.sqrt(area * 0.8))));
      const h = Math.round(Math.min(wa.h - 24, Math.max(320, area / w)));
      const m = 12;
      // Anchor to the corner next to the tray: taskbar on top -> top-right, on the left -> bottom-left.
      const taskbarTop = wa.y > full.y;
      const taskbarLeft = wa.x > full.x;
      const x = taskbarLeft ? wa.x + m : wa.x + wa.w - w - m;
      const y = taskbarTop ? wa.y + m : wa.y + wa.h - h - m;
      await qn.setSize(new LogicalSize(w, h));
      await qn.setPosition(new LogicalPosition(x, y));
    },
    async showQuickNote() {
      await invoke('show_quicknote');
    },
    async hideQuickNote() {
      const qn = await windowByLabel('quicknote');
      await qn?.hide();
    },
    async showMain() {
      await invoke('show_main');
    },
    quit: () => invoke('quit_app'),

    emit: (event, payload) => emit(event, payload),
    emitTo: (label, event, payload) => emitTo(label, event, payload),
    openWindow: (transfer) => invoke<string>('open_window', { transfer: transfer ?? null }),
    windowAt: () => invoke<string | null>('window_at'),
    async cursorClientPoint() {
      const [c, p, s] = await Promise.all([cursorPosition(), win.innerPosition(), win.scaleFactor()]);
      return { x: (c.x - p.x) / s, y: (c.y - p.y) / s };
    },
    storeClaim: (key) => invoke<string | null>('store_claim', { key }),
    launchHidden: () => invoke<boolean>('launch_hidden'),
    lastOtherWindow: () => invoke<string | null>('last_other_window'),
    lastWindow: () => invoke<string>('last_window'),
    windowCount: () => invoke<number>('window_count'),
    focusWindow: (label) => invoke<void>('focus_window', { label }),
    registerOpenFiles: (paths) => invoke<void>('register_open_files', { paths }),
    windowWithFile: (path) => invoke<string | null>('window_with_file', { path }),
    closeWindow: () => invoke<void>('close_window'),
    startVoiceTyping: () => invoke<void>('start_voice_typing'),
    listen: (event, cb) => listen(event, (e) => cb(e.payload as any)) as Promise<Unlisten>,
    // Only events addressed to this window (listen() would also get every other window's).
    listenHere: (event, cb) => getCurrentWebviewWindow().listen(event, (e) => cb(e.payload as any)) as Promise<Unlisten>,

    openExternal: (url) => invoke('open_url', { url }),
    revealInExplorer: (path) => invoke('reveal_in_explorer', { path }),
    assetUrl: (path) => convertFileSrc(path),

    integrationState: () => invoke<IntegrationState>('integration_state'),
    registerFileTypes: (exts) => invoke('register_file_types', { exts }),
    unregisterFileTypes: () => invoke('unregister_file_types'),
    openDefaultAppsSettings: () => invoke('open_default_apps'),
    setReplaceNotepad: (on) => invoke('set_replace_notepad', { on }),
    setContextMenu: (on) => invoke('set_context_menu', { on }),
    setStartWithWindows: (on) => invoke('set_start_with_windows', { on }),
    openAliasSettings: () => invoke('open_alias_settings'),
  };
}
