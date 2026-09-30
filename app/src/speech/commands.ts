// Read-aloud commands: the page, the selection, and Ctrl+Alt+R (the selection, else the page;
// pressing it while reading stops). They act on the active pane's document.
import { activeDoc, docs, getView, textOf, panes, displayTitle } from '../state/app';
import { isBinaryKind } from '../lib/view-kind';
import { readableText } from './text';
import { speech, startReading } from './state';

/** What is selected in the active pane: rendered text (Visual, preview) or source text. */
export function currentSelection(): { text: string; markdown: boolean } {
  const d = activeDoc.value;
  if (!d) return { text: '', markdown: false };
  const root: ParentNode = (panes.value.on && document.querySelector('.editor-pane.pane-active')) || document;
  const sel = typeof window !== 'undefined' ? window.getSelection() : null;
  const node = sel?.anchorNode ?? null;
  const el = node && (node.nodeType === 1 ? (node as Element) : node.parentElement);
  const rendered = el?.closest('.visual-editor, .md-preview');
  if (sel && !sel.isCollapsed && rendered && (root === document || (root as Element).contains(rendered))) {
    return { text: sel.toString(), markdown: false };
  }
  const v = getView();
  const text = v ? v.state.selection.ranges.map((r) => v.state.sliceDoc(r.from, r.to)).join('\n') : '';
  return { text, markdown: d.language === 'markdown' && !d.viewer };
}

function readable(text: string, markdown: boolean): string {
  return readableText(text, markdown);
}

/** Can the active document be read? (Text, Markdown and data files; not spreadsheets, images, PDFs or Word.) */
export function canRead(): boolean {
  const d = activeDoc.value;
  return !!d && !isBinaryKind(d.viewer);
}

export async function readPage() {
  const d = activeDoc.value;
  if (!d || !canRead()) return;
  const text = readable(textOf(d.id), d.language === 'markdown' && !d.viewer);
  if (text.trim()) await startReading(text, d.id, displayTitle(d));
}

export async function readSelection() {
  const d = activeDoc.value;
  if (!d || !canRead()) return;
  const s = currentSelection();
  const text = readable(s.text, s.markdown);
  if (text.trim()) await startReading(text, d.id, displayTitle(d));
}

/** Ctrl+Alt+R: stop when reading, else read the selection (or the whole page). */
export async function toggleReadAloud() {
  const st = speech.state.status;
  if (st === 'loading' || st === 'playing' || st === 'paused') return speech.stop();
  if (currentSelection().text.trim()) return readSelection();
  return readPage();
}

/** Reading continues across tab and pane switches; it stops when its document is closed. */
export function stopIfDocClosed() {
  const id = speech.state.docId;
  if (id && !docs.value[id]) speech.stop();
}
