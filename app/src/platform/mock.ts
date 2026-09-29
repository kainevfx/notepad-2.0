// Browser implementation: a fake C:\ drive and app store in localStorage, BroadcastChannel for
// cross-window events. Used for development and Playwright screenshots on the VPS.
import type { FileStat, IntegrationState, LaunchArgs, Platform } from './types';
import { SAMPLE_FILES } from './mock-samples';

const FS_KEY = 'np2.mockfs';
const STORE_PREFIX = 'np2.store:';

type MockFs = Record<string, { b64: string; mtime: number; readonly?: boolean }>;

function b64encode(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
function b64decode(b64: string): Uint8Array {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

function loadFs(): MockFs {
  const raw = localStorage.getItem(FS_KEY);
  if (raw) return JSON.parse(raw);
  const fs: MockFs = {};
  const now = Date.now();
  for (const [path, text] of Object.entries(SAMPLE_FILES)) {
    fs[path] = { b64: b64encode(new TextEncoder().encode(text.replace(/\n/g, '\r\n'))), mtime: now };
  }
  localStorage.setItem(FS_KEY, JSON.stringify(fs));
  return fs;
}
function saveFs(fs: MockFs) {
  localStorage.setItem(FS_KEY, JSON.stringify(fs));
}

const integration: IntegrationState = {
  supported: false,
  exePath: 'C:\\Users\\Kaine\\AppData\\Local\\Programs\\Notepad 2.0\\notepad2.exe',
  registered: false,
  defaults: { '.txt': false, '.md': false },
  replaceNotepad: false,
  contextMenu: false,
  startWithWindows: false,
};

export function createMockPlatform(label: string): Platform {
  const channel = new BroadcastChannel('np2-events');
  const handlers = new Map<string, Set<(p: any) => void>>();
  channel.onmessage = (e) => handlers.get(e.data.event)?.forEach((h) => h(e.data.payload));
  const on = (event: string, cb: (p: any) => void) => {
    if (!handlers.has(event)) handlers.set(event, new Set());
    handlers.get(event)!.add(cb);
    return () => handlers.get(event)!.delete(cb);
  };

  const params = new URLSearchParams(location.search);

  return {
    kind: 'browser',
    windowLabel: label,

    async launchArgs(): Promise<LaunchArgs> {
      const files = params.getAll('open');
      return { argv: ['notepad2.exe', ...files], cwd: 'C:\\Users\\Kaine\\Documents' };
    },
    async onSecondInstance() {
      return () => {};
    },

    async readFile(path) {
      const f = loadFs()[path];
      if (!f) throw new Error(`The system cannot find the file specified: ${path}`);
      return { bytes: b64decode(f.b64), mtime: f.mtime, readonly: !!f.readonly };
    },
    async renameFile(from, to) {
      const fs = loadFs();
      if (!fs[from]) throw new Error('not found');
      if (fs[to] && from.toLowerCase() !== to.toLowerCase()) throw new Error(`${to} already exists`);
      fs[to] = fs[from];
      delete fs[from];
      saveFs(fs);
    },
    async writeFile(path, bytes) {
      const fs = loadFs();
      if (fs[path]?.readonly) throw new Error('Access is denied.');
      const mtime = Date.now();
      fs[path] = { b64: b64encode(bytes), mtime };
      saveFs(fs);
      return mtime;
    },
    async stat(path): Promise<FileStat> {
      const f = loadFs()[path];
      if (!f) return { exists: false, mtime: 0, size: 0, readonly: false };
      return { exists: true, mtime: f.mtime, size: atob(f.b64).length, readonly: !!f.readonly };
    },
    // The browser build is a single window.
    async emitTo() {},
    async openWindow() {
      return null;
    },
    async windowAt() {
      return null;
    },
    async lastOtherWindow() {
      return null;
    },
    async lastWindow() {
      return 'main';
    },
    async windowCount() {
      return 1;
    },
    async focusWindow() {},
    async registerOpenFiles() {},
    async windowWithFile() {
      return null;
    },
    async closeWindow() {},
    async startVoiceTyping() {},
    async openImageDialog() {
      const w = window as any;
      const next = w.__np2NextImage ?? null;
      w.__np2NextImage = null;
      return next ?? prompt('Image path', 'C:\\Users\\Kaine\\Pictures\\photo.png');
    },
    async openDialog() {
      const w = window as any;
      if (w.__np2NextOpen) {
        const r = w.__np2NextOpen;
        w.__np2NextOpen = null;
        return r;
      }
      const list = Object.keys(loadFs());
      const pick = prompt(`Open which file?\n\n${list.map((p, i) => `${i + 1}. ${p}`).join('\n')}`, '1');
      const i = Number(pick) - 1;
      return list[i] ? [list[i]] : [];
    },
    async saveDialog(defaultName) {
      const w = window as any;
      if (w.__np2NextSave !== undefined) {
        const r = w.__np2NextSave;
        w.__np2NextSave = undefined;
        return r;
      }
      return prompt('Save as', `C:\\Users\\Kaine\\Documents\\${defaultName}`);
    },

    async storeRead(key) {
      return localStorage.getItem(STORE_PREFIX + key);
    },
    async storeWrite(key, text) {
      localStorage.setItem(STORE_PREFIX + key, text);
    },
    async storeDelete(key) {
      localStorage.removeItem(STORE_PREFIX + key);
    },
    async storeList(dir) {
      const prefix = STORE_PREFIX + dir.replace(/\/?$/, '/');
      const out: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i)!;
        if (k.startsWith(prefix)) out.push(k.slice(prefix.length));
      }
      return out;
    },

    async minimize() {},
    async toggleMaximize() {},
    async isMaximized() {
      return false;
    },
    async onResized() {
      return () => {};
    },
    async hide() {},
    async show() {},
    async setTitle(t) {
      document.title = t;
    },
    async onCloseRequested() {
      return () => {};
    },
    async onFocus(cb) {
      const h = () => cb();
      window.addEventListener('focus', h);
      return () => window.removeEventListener('focus', h);
    },
    async setAlwaysOnTop() {},
    async placeQuickNote() {},
    async showQuickNote() {
      window.open('quicknote.html', 'quicknote', 'width=420,height=520');
    },
    async hideQuickNote() {
      if (label === 'quicknote') window.close();
    },
    async showMain() {},
    async quit() {},

    async emit(event, payload) {
      channel.postMessage({ event, payload });
    },
    async listen(event, cb) {
      return on(event, cb);
    },

    async openExternal(url) {
      window.open(url, '_blank', 'noopener');
    },
    async revealInExplorer() {},
    assetUrl: (path) => path,

    async integrationState() {
      return { ...integration, defaults: { ...integration.defaults } };
    },
    async registerFileTypes(exts) {
      integration.registered = true;
      for (const e of exts) integration.defaults[e] = integration.defaults[e] ?? false;
    },
    async unregisterFileTypes() {
      integration.registered = false;
    },
    async openDefaultAppsSettings() {
      for (const k of Object.keys(integration.defaults)) integration.defaults[k] = true;
    },
    async setReplaceNotepad(on) {
      integration.replaceNotepad = on;
    },
    async setContextMenu(on) {
      integration.contextMenu = on;
    },
    async setStartWithWindows(on) {
      integration.startWithWindows = on;
    },
    async openAliasSettings() {},
  };
}
