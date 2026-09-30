// Read-aloud commands: the page, the selection, and Ctrl+Alt+R (the selection, else the page;
// pressing it while reading stops). They act on the active pane's document.
import { activeDoc, docs, getView, textOf, panes, displayTitle, activeView, type DocMeta } from '../state/app';
import { isBinaryKind, hasViewPane } from '../lib/view-kind';
import { visualApi } from '../editor/visual/sync';
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
    return { text: renderedSelectionText(sel), markdown: false };
  }
  // The Source selection only counts when Source is on screen (not hidden behind Visual or a viewer).
  const v = getView();
  if (!v || !sourceVisible(d)) return { text: '', markdown: false };
  const text = v.state.selection.ranges.map((r) => v.state.sliceDoc(r.from, r.to)).join('\n');
  return { text, markdown: d.language === 'markdown' && !d.viewer };
}

function sourceVisible(d: DocMeta): boolean {
  if (isBinaryKind(d.viewer)) return false;
  if (hasViewPane(d.viewer) || (d.language === 'markdown' && !d.viewer)) return activeView(d) !== 'visual';
  return true;
}

/** Selected rendered text, without the second (visual) copy of maths KaTeX draws. */
function renderedSelectionText(sel: Selection): string {
  const box = document.createElement('div');
  for (let i = 0; i < sel.rangeCount; i++) box.append(sel.getRangeAt(i).cloneContents());
  box.querySelectorAll('.katex-html').forEach((e) => e.remove());
  return box.textContent ?? sel.toString();
}

/** Plain words to read for a document's text: Markdown and HTML without markup, others as they are. */
export function readableFor(text: string, kind: 'markdown' | 'html' | 'plain'): string {
  if (kind === 'html') {
    const doc = new DOMParser().parseFromString(text, 'text/html');
    doc.querySelectorAll('script, style, noscript, template').forEach((e) => e.remove());
    doc.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li, tr, div, section, article, blockquote, br').forEach((e) => e.append('\n\n'));
    return (doc.body?.textContent ?? '').replace(/[ \t]+/g, ' ').replace(/ *\n */g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  }
  return readableText(text, kind === 'markdown');
}

const kindOf = (d: DocMeta): 'markdown' | 'html' | 'plain' => (d.viewer === 'html' ? 'html' : d.language === 'markdown' && !d.viewer ? 'markdown' : 'plain');

/** Can the active document be read? (Text, Markdown and data files; not spreadsheets, images, PDFs or Word.) */
export function canRead(): boolean {
  const d = activeDoc.value;
  return !!d && !isBinaryKind(d.viewer);
}

export async function readPage() {
  const d = activeDoc.value;
  if (!d || !canRead()) return;
  visualApi.flush(); // the last Visual edits are part of the page
  const text = readableFor(textOf(d.id), kindOf(d));
  if (text.trim()) await startReading(text, d.id, displayTitle(d));
}

export async function readSelection(captured?: { text: string; markdown: boolean }) {
  const d = activeDoc.value;
  if (!d || !canRead()) return;
  // The right-click menu passes the selection it saw (clicking the menu can clear it).
  const s = captured ?? currentSelection();
  const text = readableFor(s.text, s.markdown ? 'markdown' : 'plain');
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
