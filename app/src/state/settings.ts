import { signal, effect } from '@preact/signals';
import { platform } from '../platform';

export type PaperMode = 'none' | 'lines' | 'grid' | 'numbers';
export type TabsMode = 'top' | 'left' | 'rail';
export type MdView = 'visual' | 'edit' | 'split';

export function migrateMdView(v: string | undefined): MdView {
  if (v === 'edit' || v === 'split' || v === 'visual') return v;
  return 'visual'; // 'preview' (removed) and anything unknown
}

export function clampScale(n: number): number {
  return Math.max(75, Math.min(150, Math.round(n / 5) * 5));
}

export interface Settings {
  theme: 'system' | 'light' | 'dark';
  fontFamily: string;
  fontSize: number; // pt, like Notepad
  fontStyle: 'normal' | 'italic';
  fontWeight: number;
  wordWrap: boolean;
  statusBar: boolean;
  zoom: number; // percent
  /** Whole-interface scale, percent (75-150). Separate from text zoom. */
  uiScale: number;
  spellcheck: boolean;

  tabsMode: TabsMode;
  sidebarWidth: number;

  paper: PaperMode;
  /** Show line numbers on top of Lines / Grid paper. */
  paperNumbers: boolean;
  /** Red margin rule on Lines paper. */
  paperMargin: boolean;
  /** Store the paper choice per tab instead of globally. */
  paperPerTab: boolean;

  mdDefaultView: MdView;
  mdForTxt: boolean;
  blockRemoteImages: boolean;

  /** X button sends the app to the tray (Kaine's choice) instead of quitting. */
  closeToTray: boolean;
  autosaveFiles: boolean;
  autosaveDelayMs: number;
  deleteEmptyNotesOnClose: boolean;

  quickNoteSize: 'eighth' | 'quarter';
  quickNoteHideOnBlur: boolean;
  quickNotePinned: boolean;

  firstRunDone: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  theme: 'system',
  fontFamily: 'Consolas',
  fontSize: 11,
  fontStyle: 'normal',
  fontWeight: 400,
  wordWrap: true,
  statusBar: true,
  zoom: 100,
  uiScale: 100,
  spellcheck: false,

  tabsMode: 'top',
  sidebarWidth: 260,

  paper: 'none',
  paperNumbers: false,
  paperMargin: false,
  paperPerTab: false,

  mdDefaultView: 'visual',
  mdForTxt: false,
  blockRemoteImages: false,

  closeToTray: true,
  autosaveFiles: false,
  autosaveDelayMs: 1000,
  deleteEmptyNotesOnClose: true,

  quickNoteSize: 'eighth',
  quickNoteHideOnBlur: true,
  quickNotePinned: true,

  firstRunDone: false,
};

export const settings = signal<Settings>({ ...DEFAULT_SETTINGS });
export const settingsLoaded = signal(false);

export function updateSettings(patch: Partial<Settings>) {
  settings.value = { ...settings.value, ...patch };
}

export async function loadSettings() {
  try {
    const raw = await platform.storeRead('settings.json');
    if (raw) {
      const merged: Settings = { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
      settings.value = { ...merged, mdDefaultView: migrateMdView(merged.mdDefaultView), uiScale: clampScale(merged.uiScale) };
    }
  } catch {
    /* corrupt settings fall back to defaults */
  }
  settingsLoaded.value = true;
}

let saveTimer: ReturnType<typeof setTimeout> | undefined;
let lastSaved = '';
effect(() => {
  const json = JSON.stringify(settings.value, null, 2);
  if (!settingsLoaded.value || json === lastSaved) return;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    lastSaved = json;
    platform.storeWrite('settings.json', json).catch(() => {});
    platform.emit('settings-changed', settings.value).catch(() => {});
  }, 300);
});

/** Other windows push their settings changes here. */
export function applyRemoteSettings(s: Settings) {
  const json = JSON.stringify(s, null, 2);
  if (json === JSON.stringify(settings.value, null, 2)) return;
  lastSaved = json;
  settings.value = s;
}

// Theme: follow Windows unless forced.
const media = typeof matchMedia !== 'undefined' ? matchMedia('(prefers-color-scheme: dark)') : null;
export const systemDark = signal(media?.matches ?? false);
media?.addEventListener('change', (e) => (systemDark.value = e.matches));

export function isDark(): boolean {
  const t = settings.value.theme;
  return t === 'dark' || (t === 'system' && systemDark.value);
}

export const FONT_CHOICES = [
  'Consolas', 'Cascadia Code', 'Cascadia Mono', 'Courier New', 'Lucida Console', 'Segoe UI', 'Segoe UI Variable Text',
  'Calibri', 'Arial', 'Georgia', 'Times New Roman', 'Verdana',
];
