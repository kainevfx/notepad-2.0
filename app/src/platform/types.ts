// The only surface the UI uses to reach the OS. Two implementations:
//   tauri.ts  - the real Windows app (Rust commands in src-tauri)
//   mock.ts   - a browser build backed by localStorage, used for screenshots and e2e on the VPS

export interface FileRead {
  bytes: Uint8Array;
  mtime: number;
  readonly: boolean;
}

export interface FileStat {
  exists: boolean;
  mtime: number;
  size: number;
  readonly: boolean;
}

export interface IntegrationState {
  /** False in the browser build or on non-Windows. */
  supported: boolean;
  exePath: string;
  /** Capabilities + ProgIDs written under HKCU. */
  registered: boolean;
  /** Extension -> is Notepad 2.0 the current user choice. */
  defaults: Record<string, boolean>;
  /** IFEO Debugger key on notepad.exe points at us. */
  replaceNotepad: boolean;
  contextMenu: boolean;
  startWithWindows: boolean;
}

export interface LaunchArgs {
  argv: string[];
  cwd: string | null;
}

export type Unlisten = () => void;

export interface Platform {
  kind: 'tauri' | 'browser';
  windowLabel: string;

  launchArgs(): Promise<LaunchArgs>;
  onSecondInstance(cb: (a: LaunchArgs) => void): Promise<Unlisten>;

  readFile(path: string): Promise<FileRead>;
  /** Atomic: temp file in the same folder, flush, replace. Returns the new mtime. */
  writeFile(path: string, bytes: Uint8Array): Promise<number>;
  stat(path: string): Promise<FileStat>;
  /** Rename a file; rejects if the new name already exists. */
  renameFile(from: string, to: string): Promise<void>;
  openDialog(): Promise<string[]>;
  /** Pick one image file; null when cancelled. */
  openImageDialog(): Promise<string | null>;
  saveDialog(defaultName: string, markdown: boolean): Promise<string | null>;

  /** App data store (%APPDATA%\Notepad2). Keys are relative paths like "notes/abc.md". */
  storeRead(key: string): Promise<string | null>;
  storeWrite(key: string, text: string): Promise<void>;
  storeDelete(key: string): Promise<void>;
  storeList(dir: string): Promise<string[]>;

  // Window
  minimize(): Promise<void>;
  toggleMaximize(): Promise<void>;
  isMaximized(): Promise<boolean>;
  onResized(cb: () => void): Promise<Unlisten>;
  hide(): Promise<void>;
  show(): Promise<void>;
  setTitle(t: string): Promise<void>;
  onCloseRequested(cb: () => void): Promise<Unlisten>;
  onFocus(cb: () => void): Promise<Unlisten>;
  setAlwaysOnTop(on: boolean): Promise<void>;
  /** Quick Note window: size and anchor bottom-right above the taskbar. */
  placeQuickNote(fraction: number): Promise<void>;
  showQuickNote(): Promise<void>;
  hideQuickNote(): Promise<void>;
  showMain(): Promise<void>;
  quit(): Promise<void>;

  // Cross-window events
  emit(event: string, payload?: unknown): Promise<void>;
  /** Send an event to one window. */
  emitTo(label: string, event: string, payload?: unknown): Promise<void>;

  // Several main windows
  /** New window at the mouse pointer, handed a transfer. */
  openWindow(transfer?: string): Promise<string | null>;
  /** The other Notepad 2.0 window under the mouse pointer, if any. */
  windowAt(): Promise<string | null>;
  /** Where the mouse pointer is in this window (CSS pixels), for placing dropped items. */
  cursorClientPoint(): Promise<{ x: number; y: number } | null>;
  /** Atomically take a store file (only one window can win). */
  storeClaim(key: string): Promise<string | null>;
  /** This launch starts hidden in the tray (start with Windows). */
  launchHidden(): Promise<boolean>;
  lastOtherWindow(): Promise<string | null>;
  lastWindow(): Promise<string>;
  windowCount(): Promise<number>;
  focusWindow(label: string): Promise<void>;
  registerOpenFiles(paths: string[]): Promise<void>;
  windowWithFile(path: string): Promise<string | null>;
  /** Close this window for good (after its items moved to another window). */
  closeWindow(): Promise<void>;
  /** Start Windows voice typing (Win+H) in the focused window. */
  startVoiceTyping(): Promise<void>;
  /** Is this path a file, a folder, or nothing? */
  pathKind(path: string): Promise<'file' | 'dir' | 'missing'>;
  /** File Explorer at a folder. */
  openFolder(path: string): Promise<void>;
  /** A file in its default Windows app. */
  openDefault(path: string): Promise<void>;
  /** Every sheet of a spreadsheet (.xlsx, .xls, .ods) as cell text. */
  readSheet(path: string): Promise<Workbook>;
  /** Pick a file or a folder (the link dialog's Browse). */
  pickPath(kind: 'file' | 'folder'): Promise<string | null>;
  /** Events sent to every window. */
  listen<T>(event: string, cb: (payload: T) => void): Promise<Unlisten>;
  /** Events sent to this window only (emitTo this window's label). */
  listenHere<T>(event: string, cb: (payload: T) => void): Promise<Unlisten>;

  // Shell
  openExternal(url: string): Promise<void>;
  revealInExplorer(path: string): Promise<void>;
  assetUrl(path: string): string;

  // Windows integration (sub-plan 07)
  integrationState(): Promise<IntegrationState>;
  registerFileTypes(exts: string[]): Promise<void>;
  unregisterFileTypes(): Promise<void>;
  openDefaultAppsSettings(): Promise<void>;
  setReplaceNotepad(on: boolean): Promise<void>;
  setContextMenu(on: boolean): Promise<void>;
  setStartWithWindows(on: boolean): Promise<void>;
  openAliasSettings(): Promise<void>;
}

export const FILE_TYPES = ['.txt', '.md', '.markdown', '.log', '.ini', '.cfg', '.json', '.csv'];

export interface Workbook {
  sheets: { name: string; rows: string[][]; truncated: boolean }[];
}
