// Visual view <-> CodeMirror. CodeMirror keeps the text; Visual edits are written back into it as
// the smallest single change, so dirty tracking, autosave, recovery and saving work unchanged.
import type { Editor } from '@tiptap/core';

export function minimalChange(a: string, b: string): { from: number; to: number; insert: string } | null {
  if (a === b) return null;
  let s = 0;
  const max = Math.min(a.length, b.length);
  while (s < max && a.charCodeAt(s) === b.charCodeAt(s)) s++;
  let ea = a.length;
  let eb = b.length;
  while (ea > s && eb > s && a.charCodeAt(ea - 1) === b.charCodeAt(eb - 1)) {
    ea--;
    eb--;
  }
  return { from: s, to: ea, insert: b.slice(s, eb) };
}

/** The live Visual editor, if one is mounted. app.ts routes undo/redo/save through it. */
export const visualApi: { editor: Editor | null; flush: () => void; undo: () => boolean; redo: () => boolean } = {
  editor: null,
  flush: () => {},
  undo: () => false,
  redo: () => false,
};

type Change = { from: number; to: number; insert: string };

/**
 * Tracks one Visual editor against the CodeMirror text it mirrors.
 * - loaded(text): the editor now shows `text` (parsed fresh; nothing to write).
 * - edited(): the user changed something in Visual.
 * - flush(): write the pending edit into CodeMirror as one minimal change. Without an edit it
 *   writes nothing, so merely viewing a file in Visual never rewrites it.
 * - needsReload(text): the text changed outside Visual (Source edit, reload), so re-parse.
 */
export function createVisualSync(deps: { serialize: () => string; getText: () => string; apply: (ch: Change) => void }) {
  let shown = '';
  let dirty = false;
  return {
    loaded(text: string) {
      shown = text;
      dirty = false;
    },
    edited() {
      dirty = true;
    },
    get pending() {
      return dirty;
    },
    flush() {
      if (!dirty) return;
      dirty = false;
      const text = deps.getText();
      // Keep the file's own ending (TipTap always ends with a blank line).
      const md = deps.serialize().replace(/\n*$/, /\n*$/.exec(text)![0]);
      const ch = minimalChange(text, md);
      shown = md;
      if (ch) deps.apply(ch);
    },
    needsReload(text: string) {
      return text !== shown;
    },
  };
}
