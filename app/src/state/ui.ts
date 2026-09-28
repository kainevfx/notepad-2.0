import { signal } from '@preact/signals';
import type { ComponentChildren } from 'preact';

export interface DialogButton {
  label: string;
  value: string;
  primary?: boolean;
}

export interface DialogSpec {
  title: string;
  body?: ComponentChildren;
  buttons: DialogButton[];
  /** Optional text input (rename, go to line). */
  input?: { value: string; label?: string; type?: 'text' | 'number'; select?: boolean };
  resolve: (value: string | null, input?: string) => void;
}

export const dialog = signal<DialogSpec | null>(null);

export function ask(spec: Omit<DialogSpec, 'resolve'>): Promise<{ value: string | null; input?: string }> {
  return new Promise((resolve) => {
    dialog.value = {
      ...spec,
      resolve: (value, input) => {
        dialog.value = null;
        resolve({ value, input });
      },
    };
  });
}

export async function alertMsg(title: string, body: string) {
  await ask({ title, body, buttons: [{ label: 'OK', value: 'ok', primary: true }] });
}

export interface MenuItem {
  label?: string;
  shortcut?: string;
  action?: () => void;
  disabled?: boolean;
  checked?: boolean;
  separator?: boolean;
  submenu?: MenuItem[];
  /** Colour swatch row. */
  swatch?: string;
  danger?: boolean;
}

export const contextMenu = signal<{ x: number; y: number; items: MenuItem[] } | null>(null);

export function openContextMenu(e: MouseEvent, items: MenuItem[]) {
  e.preventDefault();
  e.stopPropagation();
  contextMenu.value = { x: e.clientX, y: e.clientY, items };
}

export const settingsOpen = signal(false);
export const paperPopoverOpen = signal(false);
export const closedNotesOpen = signal(false);
export const railPeek = signal(false);
export const cursorInfo = signal({ line: 1, col: 1, chars: 0, selected: 0 });
export const toast = signal<string | null>(null);

let toastTimer: ReturnType<typeof setTimeout> | undefined;
export function showToast(msg: string) {
  toast.value = msg;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (toast.value = null), 2600);
}
