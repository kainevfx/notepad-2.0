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
  openDialog(): Promise<string[]>;
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
  listen<T>(event: string, cb: (payload: T) => void): Promise<Unlisten>;

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
