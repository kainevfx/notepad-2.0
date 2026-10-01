// Multi-select in the sidebar: Ctrl+click adds or removes a file, Shift+click selects the run of
// files between the last clicked one and this one (in the order shown), a plain click selects one.
import { signal } from '@preact/signals';

/** Selected file ids (an empty selection means "just the active file"). */
export const selection = signal<string[]>([]);
let anchor: string | null = null;

/** Order the files are shown in the sidebar, updated on every render (collapsed groups excluded). */
export const visibleOrder: { ids: string[] } = { ids: [] };

export type ClickMods = { ctrl: boolean; shift: boolean };

/** Pure: the next selection after a click. */
export function nextSelection(cur: string[], id: string, mods: ClickMods, order: string[], anchorId: string | null): { sel: string[]; anchor: string | null } {
  if (mods.shift && anchorId && order.includes(anchorId) && order.includes(id)) {
    const a = order.indexOf(anchorId);
    const b = order.indexOf(id);
    const run = order.slice(Math.min(a, b), Math.max(a, b) + 1);
    const base = mods.ctrl ? cur.filter((x) => !run.includes(x)) : [];
    return { sel: [...base, ...run], anchor: anchorId };
  }
  if (mods.ctrl) {
    const sel = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
    return { sel, anchor: id };
  }
  return { sel: [id], anchor: id };
}

/** Handle a click on a sidebar file. Returns true when it was a plain click (open the file). */
export function clickFile(id: string, e: { ctrlKey: boolean; metaKey: boolean; shiftKey: boolean }, activeId: string | null): boolean {
  const mods = { ctrl: e.ctrlKey || e.metaKey, shift: e.shiftKey };
  // The first Ctrl/Shift click starts from the open file.
  const cur = selection.value.length ? selection.value : activeId ? [activeId] : [];
  const r = nextSelection(cur, id, mods, visibleOrder.ids, anchor ?? activeId);
  anchor = r.anchor;
  selection.value = mods.ctrl || mods.shift ? r.sel : [];
  return !mods.ctrl && !mods.shift;
}

/** What a right-click or drag acts on: the selection if `id` is in it, otherwise just `id`. */
export function targetsFor(id: string): string[] {
  const sel = selection.value;
  return sel.length > 1 && sel.includes(id) ? visibleOrder.ids.filter((x) => sel.includes(x)).concat(sel.filter((x) => !visibleOrder.ids.includes(x))) : [id];
}

export function clearSelection() {
  selection.value = [];
}

export function isSelected(id: string): boolean {
  return selection.value.length > 1 && selection.value.includes(id);
}
