// Main-window controller: documents, tab/group tree, session restore and the save model.
//
// Save rules (sub-plan 05):
//   note (untitled or quick)  -> autosaved to the app store 500 ms after typing stops, never dirty
//   file on disk              -> NOT autosaved by default. Dirty dot, Ctrl+S writes. Unsaved edits
//                                are mirrored to recovery/<id>.json so a crash loses nothing.
//   file, autosave on         -> global setting or per-group override, atomic write after the delay
// Opening a file never writes it.

import { signal, computed, batch, effect } from '@preact/signals';
import type { EditorState } from '@codemirror/state';
import type { EditorView, ViewUpdate } from '@codemirror/view';
import { openSearchPanel, closeSearchPanel, searchPanelOpen, findNext, findPrevious } from '@codemirror/search';
import { undo, redo, selectAll } from '@codemirror/commands';
import { platform } from '../platform';
import { decodeBytes, encodeText, fitsAnsi, type Encoding, type Eol } from '../lib/encoding';
import { parseLaunchArgs } from '../lib/notepad-args';
import { noteTitle } from '../lib/note-title';
export { noteTitle };
import * as T from '../lib/tree-ops';
import type { TreeNode, GroupNode, GroupColor, DropPosition } from '../lib/tree-ops';
import { isMarkdownPath } from '../markdown/pipeline';
import { settings, updateSettings, loadSettings, applyRemoteSettings, migrateMdView, type MdView, type PaperMode, type Settings } from './settings';
import { createEditorState, reconfigureEffects, setUpdateHandler, type ViewConfig } from '../editor/setup';
import { ask, alertMsg, cursorInfo, showToast, settingsOpen } from './ui';
import { visualApi } from '../editor/visual/sync';

/** True when the active tab is showing the Visual (WYSIWYG) editor. */
export function inVisual(): boolean {
  const d = activeDoc.value;
  return !!d && d.language === 'markdown' && d.mdView === 'visual' && !!visualApi.editor;
}

export type Banner = { kind: 'external' | 'restored' | 'missing' | 'error' | 'mixed-eol' | 'readonly'; text: string };

export interface DocMeta {
  id: string;
  kind: 'note' | 'file';
  quick?: boolean;
  path: string | null;
  customTitle?: string;
  title: string;
  encoding: Encoding;
  bom: boolean;
  eol: Eol;
  language: 'plain' | 'markdown';
  mdView: MdView;
  paper?: PaperMode;
  dirty: boolean;
  mtime: number;
  readonly: boolean;
  created: number;
  modified: number;
  cursor?: number;
  scrollTop?: number;
  banner?: Banner | null;
  /** Tab colour (same palette as groups). */
  color?: GroupColor;
}

export interface ClosedNote {
  id: string;
  title: string;
  modified: number;
  quick?: boolean;
}

interface SessionFile {
  version: 1;
  tree: TreeNode[];
  activeId: string | null;
  docs: DocMeta[];
  closedNotes: ClosedNote[];
  recentFiles: string[];
}

export const QUICK_GROUP_ID = 'grp-quick-notes';

export const docs = signal<Record<string, DocMeta>>({});
export const tree = signal<TreeNode[]>([]);
export const activeId = signal<string | null>(null);
export const closedNotes = signal<ClosedNote[]>([]);
export const recentFiles = signal<string[]>([]);
export const ready = signal(false);
/** Bumps on every edit or tab switch; the preview re-renders from it. */
export const editTick = signal(0);

export const activeDoc = computed(() => (activeId.value ? docs.value[activeId.value] ?? null : null));
export const orderedIds = computed(() => T.flattenNotes(tree.value).filter((id) => docs.value[id]));

const states = new Map<string, EditorState>();
let view: EditorView | null = null;

export function uid(prefix = 'n'): string {
  return prefix + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
}

export function basename(p: string): string {
  return p.split(/[\\/]/).pop() || p;
}
export function dirname(p: string): string {
  const i = Math.max(p.lastIndexOf('\\'), p.lastIndexOf('/'));
  return i > 0 ? p.slice(0, i) : p;
}

export function textOf(id: string): string {
  if (view && activeId.value === id) return view.state.doc.toString();
  return states.get(id)?.doc.toString() ?? '';
}

export function effectivePaper(d: DocMeta | null): PaperMode {
  const s = settings.value;
  return (s.paperPerTab && d?.paper) || s.paper;
}

function viewConfig(d: DocMeta | null): ViewConfig {
  return { paper: effectivePaper(d), settings: settings.value };
}

function patchDoc(id: string, patch: Partial<DocMeta>) {
  const d = docs.value[id];
  if (!d) return;
  docs.value = { ...docs.value, [id]: { ...d, ...patch } };
}

function addDoc(d: DocMeta, text: string) {
  states.set(d.id, createEditorState(text, d.language === 'markdown', d.readonly, viewConfig(d)));
  docs.value = { ...docs.value, [d.id]: d };
}

// ---------------------------------------------------------------- editor binding

export function attachView(v: EditorView | null) {
  view = v;
  if (v && activeId.value) showInView(activeId.value);
}

export function getView() {
  return view;
}

function stashActive() {
  visualApi.flush();
  const id = activeId.value;
  if (view && id && docs.value[id]) {
    states.set(id, view.state);
    patchDoc(id, { cursor: view.state.selection.main.head, scrollTop: view.scrollDOM.scrollTop });
  }
}

function showInView(id: string) {
  if (!view) return;
  const d = docs.value[id];
  const st = states.get(id);
  if (!d || !st) return;
  view.setState(st);
  view.dispatch({ effects: reconfigureEffects(viewConfig(d), d.language === 'markdown', d.readonly) });
  const top = d.scrollTop ?? 0;
  requestAnimationFrame(() => {
    if (view && activeId.value === id) view.scrollDOM.scrollTop = top;
  });
  updateCursorInfo();
  editTick.value++;
  if (!settingsOpen.value) view.focus();
}

export function refreshView() {
  const d = activeDoc.value;
  if (view && d) view.dispatch({ effects: reconfigureEffects(viewConfig(d), d.language === 'markdown', d.readonly) });
}

function updateCursorInfo() {
  if (!view) return;
  const st = view.state;
  const head = st.selection.main.head;
  const line = st.doc.lineAt(head);
  let selected = 0;
  for (const r of st.selection.ranges) selected += r.to - r.from;
  cursorInfo.value = { line: line.number, col: head - line.from + 1, chars: st.doc.length, selected };
}

setUpdateHandler((u: ViewUpdate) => {
  if (u.selectionSet || u.docChanged) updateCursorInfo();
  if (u.docChanged && activeId.value) {
    onEdited(activeId.value);
    editTick.value++;
  }
});

// ---------------------------------------------------------------- activation

export function activate(id: string) {
  if (!docs.value[id]) return;
  if (activeId.value === id) {
    view?.focus();
    return;
  }
  stashActive();
  // Reveal the tab: expand any collapsed ancestors.
  let t = tree.value;
  for (const g of T.ancestors(t, id)) if (g.collapsed) t = T.update(t, g.id, { collapsed: false });
  batch(() => {
    tree.value = t;
    activeId.value = id;
    settingsOpen.value = false;
  });
  showInView(id);
  updateWindowTitle();
  scheduleSession();
}

export function updateWindowTitle() {
  const d = activeDoc.value;
  const name = d ? displayTitle(d) : 'Untitled';
  platform.setTitle(`${d?.dirty ? '*' : ''}${name} - Notepad 2.0`).catch(() => {});
}

export function displayTitle(d: DocMeta): string {
  return d.customTitle || d.title;
}

// ---------------------------------------------------------------- creating / opening

/** A new file goes to the end of the active file's group, or the end of the ungrouped files. */
function placeNewNode(id: string, near: string | null) {
  const node: TreeNode = { id, kind: 'note' };
  const parent = near ? T.find(tree.value, near)?.parent : null;
  if (parent && parent.system !== 'quick-notes') {
    tree.value = T.insert(tree.value, node, parent.id, parent.children.length);
  } else {
    tree.value = [...tree.value, node]; // normalised to the end of the ungrouped section
  }
}

// Ungrouped files always sit above the groups, whatever changed the tree.
effect(() => {
  const t = tree.value;
  const n = T.normalizeLooseFirst(t);
  if (n !== t) tree.value = n;
});

export function newNote(opts: { text?: string; groupId?: string | null; activate?: boolean; language?: 'plain' | 'markdown' } = {}): string {
  const now = Date.now();
  const language = opts.language ?? (settings.value.mdForTxt ? 'markdown' : 'plain');
  const id = uid('note');
  const text = opts.text ?? '';
  addDoc(
    {
      id, kind: 'note', path: null, title: noteTitle(text), encoding: 'utf-8', bom: false, eol: 'crlf',
      language, mdView: language === 'markdown' ? 'visual' : 'edit', dirty: false, mtime: 0,
      readonly: false, created: now, modified: now,
    },
    text,
  );
  if (opts.groupId) {
    const g = T.find(tree.value, opts.groupId);
    tree.value = T.insert(tree.value, { id, kind: 'note' }, opts.groupId, g && g.node.kind === 'group' ? g.node.children.length : 0);
  } else placeNewNode(id, activeId.value);
  if (text) persistNote(id);
  if (opts.activate !== false) activate(id);
  scheduleSession();
  return id;
}

export function findOpenFile(path: string): string | null {
  const p = path.toLowerCase();
  for (const d of Object.values(docs.value)) if (d.path && d.path.toLowerCase() === p) return d.id;
  return null;
}

function addRecent(path: string) {
  recentFiles.value = [path, ...recentFiles.value.filter((p) => p.toLowerCase() !== path.toLowerCase())].slice(0, 12);
}

export async function openFiles(paths: string[], opts: { groupId?: string } = {}) {
  let last: string | null = null;
  for (const path of paths) {
    const existing = findOpenFile(path);
    if (existing) {
      last = existing;
      continue;
    }
    try {
      const f = await platform.readFile(path);
      const dec = decodeBytes(f.bytes);
      const md = isMarkdownPath(path) || (settings.value.mdForTxt && /\.txt$/i.test(path));
      const id = uid('file');
      const now = Date.now();
      const big = f.bytes.length > 5 * 1024 * 1024;
      addDoc(
        {
          id, kind: 'file', path, title: basename(path), encoding: dec.encoding, bom: dec.bom, eol: dec.eol,
          language: md ? 'markdown' : 'plain', mdView: md && !big ? settings.value.mdDefaultView : 'edit', dirty: false,
          mtime: f.mtime, readonly: f.readonly, created: now, modified: now,
          banner: dec.mixedEol
            ? { kind: 'mixed-eol', text: `This file mixes line endings. Saving will use ${dec.eol.toUpperCase()} throughout.` }
            : f.readonly
              ? { kind: 'readonly', text: 'This file is read-only. Use Save as to keep your changes.' }
              : null,
        },
        dec.text,
      );
      if (opts.groupId) tree.value = T.insert(tree.value, { id, kind: 'note' }, opts.groupId, 9999);
      else placeNewNode(id, last ?? activeId.value);
      addRecent(path);
      last = id;
    } catch (e) {
      await alertMsg('Notepad 2.0', `Couldn't open ${path}\n\n${String(e)}`);
    }
  }
  if (last) activate(last);
  scheduleSession();
}

export async function openWithDialog() {
  const paths = await platform.openDialog();
  if (paths.length) await openFiles(paths);
}

// ---------------------------------------------------------------- editing & persistence

const noteTimers = new Map<string, ReturnType<typeof setTimeout>>();
const fileTimers = new Map<string, ReturnType<typeof setTimeout>>();

function onEdited(id: string) {
  const d = docs.value[id];
  if (!d) return;
  const now = Date.now();
  if (d.kind === 'note') {
    const title = noteTitle(view && activeId.value === id ? view.state.doc.sliceString(0, 2000) : textOf(id).slice(0, 2000));
    if (title !== d.title) patchDoc(id, { title, modified: now });
    else patchDoc(id, { modified: now });
    clearTimeout(noteTimers.get(id));
    noteTimers.set(id, setTimeout(() => persistNote(id), 500));
  } else {
    if (!d.dirty) {
      patchDoc(id, { dirty: true, modified: now });
      updateWindowTitle();
    }
    clearTimeout(fileTimers.get(id));
    const auto = T.effectiveAutosave(tree.value, id, settings.value.autosaveFiles) && !d.readonly;
    fileTimers.set(
      id,
      setTimeout(() => (auto ? saveDoc(id, { silent: true }) : persistRecovery(id)), auto ? settings.value.autosaveDelayMs : 1000),
    );
  }
  scheduleSession();
}

async function persistNote(id: string) {
  noteTimers.delete(id);
  const d = docs.value[id];
  if (!d || d.kind !== 'note') return;
  const text = textOf(id);
  await platform.storeWrite(`notes/${id}.md`, text);
  if (d.quick) platform.emit('note-updated', { id, text, from: platform.windowLabel }).catch(() => {});
}

async function persistRecovery(id: string) {
  fileTimers.delete(id);
  const d = docs.value[id];
  if (!d || d.kind !== 'file') return;
  if (!d.dirty) {
    await platform.storeDelete(`recovery/${id}.json`);
    return;
  }
  await platform.storeWrite(
    `recovery/${id}.json`,
    JSON.stringify({ path: d.path, baseMtime: d.mtime, text: textOf(id), encoding: d.encoding, bom: d.bom, eol: d.eol }),
  );
}

let sessionTimer: ReturnType<typeof setTimeout> | undefined;
export function scheduleSession() {
  if (!ready.value) return;
  clearTimeout(sessionTimer);
  sessionTimer = setTimeout(saveSession, 800);
}

async function saveSession() {
  stashActiveMetaOnly();
  const s: SessionFile = {
    version: 1,
    tree: tree.value,
    activeId: activeId.value,
    docs: Object.values(docs.value).map((d) => ({ ...d, banner: d.banner?.kind === 'restored' ? d.banner : null })),
    closedNotes: closedNotes.value,
    recentFiles: recentFiles.value,
  };
  await platform.storeWrite('session.json', JSON.stringify(s));
}

function stashActiveMetaOnly() {
  const id = activeId.value;
  if (view && id && docs.value[id]) {
    const d = docs.value[id];
    const cursor = view.state.selection.main.head;
    const scrollTop = view.scrollDOM.scrollTop;
    if (d.cursor !== cursor || d.scrollTop !== scrollTop) docs.value = { ...docs.value, [id]: { ...d, cursor, scrollTop } };
  }
}

/** Write everything pending right now (before hide / quit). */
export async function flushAll() {
  visualApi.flush();
  const jobs: Promise<unknown>[] = [];
  for (const [id, t] of noteTimers) {
    clearTimeout(t);
    jobs.push(persistNote(id));
  }
  for (const [id, t] of fileTimers) {
    clearTimeout(t);
    const auto = T.effectiveAutosave(tree.value, id, settings.value.autosaveFiles);
    jobs.push(auto ? saveDoc(id, { silent: true }) : persistRecovery(id));
  }
  clearTimeout(sessionTimer);
  jobs.push(saveSession());
  await Promise.allSettled(jobs);
}

// ---------------------------------------------------------------- saving

export async function saveDoc(id: string, opts: { silent?: boolean } = {}): Promise<boolean> {
  visualApi.flush();
  const d = docs.value[id];
  if (!d) return false;
  if (d.kind === 'note' || !d.path || d.readonly) return saveDocAs(id);
  fileTimers.delete(id);
  const text = textOf(id);
  if (d.encoding === 'windows-1252' && !fitsAnsi(text) && !opts.silent) {
    const r = await ask({
      title: 'Notepad 2.0',
      body: 'This file contains characters that ANSI can’t store. Save as UTF-8 instead so nothing is lost?',
      buttons: [
        { label: 'Save as UTF-8', value: 'utf8', primary: true },
        { label: 'Save as ANSI anyway', value: 'ansi' },
        { label: 'Cancel', value: 'cancel' },
      ],
    });
    if (r.value === 'cancel' || r.value === null) return false;
    if (r.value === 'utf8') patchDoc(id, { encoding: 'utf-8', bom: false });
  }
  const cur = docs.value[id];
  try {
    const mtime = await platform.writeFile(cur.path!, encodeText(text, cur.encoding, cur.bom, cur.eol));
    // Only clear dirty if nothing was typed while writing.
    const still = textOf(id) === text;
    patchDoc(id, { mtime, dirty: !still, banner: cur.banner?.kind === 'readonly' ? cur.banner : null });
    if (still) await platform.storeDelete(`recovery/${id}.json`);
    updateWindowTitle();
    scheduleSession();
    if (!opts.silent) showToast(`Saved ${basename(cur.path!)}`);
    return true;
  } catch (e) {
    if (opts.silent) {
      patchDoc(id, { banner: { kind: 'error', text: `Autosave failed: ${String(e)}` } });
      await persistRecovery(id);
      return false;
    }
    await alertMsg('Notepad 2.0', `Couldn't save ${cur.path}\n\n${String(e)}`);
    return false;
  }
}

export async function saveDocAs(id: string): Promise<boolean> {
  visualApi.flush();
  const d = docs.value[id];
  if (!d) return false;
  const md = d.language === 'markdown';
  const suggested = d.path
    ? md && !isMarkdownPath(d.path) ? basename(d.path).replace(/(\.[^.]*)?$/, '.md') : basename(d.path)
    : `${displayTitle(d).replace(/[\\/:*?"<>|…]/g, '').slice(0, 60) || 'Untitled'}.${md ? 'md' : 'txt'}`;
  const path = await platform.saveDialog(suggested, md);
  if (!path) return false;
  const text = textOf(id);
  try {
    const mtime = await platform.writeFile(path, encodeText(text, d.encoding, d.bom, d.eol));
    const wasNote = d.kind === 'note';
    const becomesMd = isMarkdownPath(path);
    patchDoc(id, {
      kind: 'file', quick: false, path, title: basename(path), customTitle: undefined, mtime, dirty: false, readonly: false,
      banner: null, language: becomesMd ? 'markdown' : d.language,
    });
    if (wasNote) await platform.storeDelete(`notes/${id}.md`);
    await platform.storeDelete(`recovery/${id}.json`);
    addRecent(path);
    refreshView();
    updateWindowTitle();
    scheduleSession();
    showToast(`Saved ${basename(path)}`);
    return true;
  } catch (e) {
    await alertMsg('Notepad 2.0', `Couldn't save ${path}\n\n${String(e)}`);
    return false;
  }
}

export async function saveAll() {
  for (const d of Object.values(docs.value)) if (d.kind === 'file' && d.dirty) await saveDoc(d.id);
}

// ---------------------------------------------------------------- closing

/** Returns false if the user cancelled. */
export async function closeDoc(id: string, opts: { skipPrompt?: boolean } = {}): Promise<boolean> {
  visualApi.flush();
  const d = docs.value[id];
  if (!d) return true;
  if (d.kind === 'file' && d.dirty && !opts.skipPrompt) {
    activate(id);
    const r = await ask({
      title: 'Notepad 2.0',
      body: `Do you want to save changes to ${d.path ?? displayTitle(d)}?`,
      buttons: [
        { label: 'Save', value: 'save', primary: true },
        { label: "Don't save", value: 'discard' },
        { label: 'Cancel', value: 'cancel' },
      ],
    });
    if (r.value === 'cancel' || r.value === null) return false;
    if (r.value === 'save' && !(await saveDoc(id))) return false;
  }
  const text = textOf(id);
  clearTimeout(fileTimers.get(id));
  fileTimers.delete(id);
  if (d.kind === 'note') {
    clearTimeout(noteTimers.get(id));
    noteTimers.delete(id);
    if (!text.trim() && settings.value.deleteEmptyNotesOnClose) await platform.storeDelete(`notes/${id}.md`);
    else {
      await platform.storeWrite(`notes/${id}.md`, text);
      closedNotes.value = [{ id, title: displayTitle(d), modified: d.modified, quick: d.quick }, ...closedNotes.value.filter((c) => c.id !== id)];
    }
  } else {
    await platform.storeDelete(`recovery/${id}.json`);
  }
  // Neighbour to activate: next visible tab, else previous.
  const order = orderedIds.value;
  const idx = order.indexOf(id);
  const next = order[idx + 1] ?? order[idx - 1] ?? null;
  const { [id]: _gone, ...rest } = docs.value;
  batch(() => {
    tree.value = T.remove(tree.value, id).tree;
    docs.value = rest;
    if (activeId.value === id) activeId.value = null;
  });
  states.delete(id);
  if (activeId.value === null) {
    if (next && rest[next]) activate(next);
    else newNote();
  }
  scheduleSession();
  return true;
}

export async function closeOthers(id: string) {
  for (const other of orderedIds.value) if (other !== id && !(await closeDoc(other))) return;
}

export async function closeGroup(groupId: string) {
  const loc = T.find(tree.value, groupId);
  if (!loc || loc.node.kind !== 'group') return;
  for (const id of T.flattenNotes([loc.node])) if (!(await closeDoc(id))) return;
  const g = T.find(tree.value, groupId);
  if (g && !(g.node as GroupNode).system) tree.value = T.remove(tree.value, groupId).tree;
  scheduleSession();
}

export async function reopenNote(id: string) {
  const c = closedNotes.value.find((n) => n.id === id);
  const text = (await platform.storeRead(`notes/${id}.md`)) ?? '';
  const now = Date.now();
  addDoc(
    {
      id, kind: 'note', quick: c?.quick, path: null, title: noteTitle(text), customTitle: c?.title !== noteTitle(text) ? c?.title : undefined,
      encoding: 'utf-8', bom: false, eol: 'crlf', language: 'plain', mdView: 'edit', dirty: false, mtime: 0, readonly: false,
      created: now, modified: c?.modified ?? now,
    },
    text,
  );
  if (c?.quick) {
    ensureQuickGroup();
    tree.value = T.insert(tree.value, { id, kind: 'note' }, QUICK_GROUP_ID, 0);
  } else placeNewNode(id, activeId.value);
  closedNotes.value = closedNotes.value.filter((n) => n.id !== id);
  activate(id);
}

export async function deleteClosedNote(id: string) {
  await platform.storeDelete(`notes/${id}.md`);
  closedNotes.value = closedNotes.value.filter((n) => n.id !== id);
  scheduleSession();
}

// ---------------------------------------------------------------- external changes

export async function checkExternalChanges() {
  for (const d of Object.values(docs.value)) {
    if (d.kind !== 'file' || !d.path) continue;
    try {
      const st = await platform.stat(d.path);
      if (!st.exists) {
        if (d.banner?.kind !== 'missing')
          patchDoc(d.id, { banner: { kind: 'missing', text: 'This file was moved or deleted outside Notepad 2.0. Save to recreate it.' } });
        continue;
      }
      if (st.mtime > d.mtime + 1) {
        if (!d.dirty) await reloadDoc(d.id, true);
        else patchDoc(d.id, { banner: { kind: 'external', text: 'This file changed on disk.' } });
      }
    } catch {
      /* ignore */
    }
  }
}

export async function reloadDoc(id: string, silent = false) {
  visualApi.flush();
  const d = docs.value[id];
  if (!d?.path) return;
  const f = await platform.readFile(d.path);
  const dec = decodeBytes(f.bytes);
  const st = createEditorState(dec.text, d.language === 'markdown', f.readonly, viewConfig(d));
  states.set(id, st);
  patchDoc(id, { mtime: f.mtime, dirty: false, encoding: dec.encoding, bom: dec.bom, eol: dec.eol, readonly: f.readonly, banner: null });
  await platform.storeDelete(`recovery/${id}.json`);
  if (activeId.value === id && view) {
    const top = view.scrollDOM.scrollTop;
    view.setState(st);
    view.scrollDOM.scrollTop = top;
    updateCursorInfo();
    editTick.value++;
  }
  updateWindowTitle();
  if (!silent) showToast('Reloaded from disk');
}

export function keepMine(id: string) {
  const d = docs.value[id];
  if (!d) return;
  // Accept the disk version's timestamp so we stop nagging; the next save overwrites it.
  platform.stat(d.path!).then((st) => patchDoc(id, { mtime: st.mtime, banner: null }));
}

export function dismissBanner(id: string) {
  patchDoc(id, { banner: null });
}

export async function discardRestored(id: string) {
  const d = docs.value[id];
  if (d?.kind === 'file') await reloadDoc(id, true);
  else dismissBanner(id);
}

// ---------------------------------------------------------------- per-document settings

export function setEncoding(id: string, encoding: Encoding, bom: boolean) {
  const d = docs.value[id];
  if (!d) return;
  patchDoc(id, { encoding, bom, dirty: d.kind === 'file' ? true : d.dirty });
  updateWindowTitle();
  scheduleSession();
}

export function setEol(id: string, eol: Eol) {
  const d = docs.value[id];
  if (!d) return;
  patchDoc(id, { eol, dirty: d.kind === 'file' ? true : d.dirty, banner: d.banner?.kind === 'mixed-eol' ? null : d.banner });
  updateWindowTitle();
  scheduleSession();
}

export function setLanguage(id: string, language: 'plain' | 'markdown') {
  const d = docs.value[id];
  if (!d) return;
  patchDoc(id, { language, mdView: language === 'plain' ? 'edit' : d.mdView === 'edit' ? settings.value.mdDefaultView : d.mdView });
  if (activeId.value === id) refreshView();
  scheduleSession();
}

export function setDocColor(id: string, color: GroupColor | null) {
  patchDoc(id, { color: color ?? undefined });
  scheduleSession();
}

export async function convertToMarkdown(id: string) {
  const d = docs.value[id];
  if (!d) return;
  setLanguage(id, 'markdown');
  if (d.kind === 'file' && d.path && !isMarkdownPath(d.path)) {
    const r = await ask({
      title: 'Convert to Markdown',
      body: 'Also save a Markdown (.md) copy of this file? The original stays as it is.',
      buttons: [{ label: 'Save as .md…', value: 'save', primary: true }, { label: 'Not now', value: 'no' }],
    });
    if (r.value === 'save') await saveDocAs(id);
  }
}

export function setMdView(id: string, mdView: MdView) {
  const d = docs.value[id];
  if (!d) return;
  if (d.language !== 'markdown') patchDoc(id, { language: 'markdown' });
  patchDoc(id, { mdView });
  if (activeId.value === id) refreshView();
  scheduleSession();
}

export function cycleMdView() {
  const d = activeDoc.value;
  if (!d) return;
  const order: MdView[] = ['visual', 'edit', 'split'];
  if (d.language !== 'markdown') return setMdView(d.id, 'visual');
  setMdView(d.id, order[(order.indexOf(d.mdView) + 1) % 3]);
}

export function setPaper(mode: PaperMode) {
  const d = activeDoc.value;
  if (settings.value.paperPerTab && d) {
    patchDoc(d.id, { paper: mode });
    scheduleSession();
  } else updateSettings({ paper: mode });
  refreshView();
}

export function renameNote(id: string, name: string) {
  patchDoc(id, { customTitle: name.trim() || undefined });
  updateWindowTitle();
  scheduleSession();
}

// ---------------------------------------------------------------- groups

const NEXT_COLORS: GroupColor[] = ['blue', 'purple', 'orange', 'green', 'pink', 'cyan', 'red', 'yellow', 'grey'];
function nextColor(): GroupColor {
  const used = T.allGroups(tree.value).map((g) => g.group.color);
  return NEXT_COLORS.find((c) => !used.includes(c)) ?? NEXT_COLORS[used.length % NEXT_COLORS.length];
}

export function commitTree(t: TreeNode[] | null) {
  if (!t) return false;
  tree.value = t;
  scheduleSession();
  return true;
}

export async function newGroupFrom(noteIds: string[], parentId?: string | null): Promise<string | null> {
  const r = await ask({ title: 'New group', buttons: [{ label: 'Create', value: 'ok', primary: true }, { label: 'Cancel', value: 'cancel' }], input: { value: noteIds.length ? '' : 'New group', label: 'Group name', select: true } });
  if (r.value !== 'ok') return null;
  const id = uid('grp');
  const ok = commitTree(T.createGroup(tree.value, { id, name: r.input?.trim() || 'Group', color: nextColor(), collapsed: false }, noteIds, parentId));
  if (!ok) await alertMsg('Notepad 2.0', `Groups can nest up to ${T.MAX_GROUP_DEPTH} levels deep.`);
  return ok ? id : null;
}

export async function renameGroup(id: string) {
  const loc = T.find(tree.value, id);
  if (!loc || loc.node.kind !== 'group') return;
  const r = await ask({ title: 'Rename group', buttons: [{ label: 'Rename', value: 'ok', primary: true }, { label: 'Cancel', value: 'cancel' }], input: { value: loc.node.name, select: true } });
  if (r.value === 'ok' && r.input?.trim()) commitTree(T.update(tree.value, id, { name: r.input.trim() }));
}

export function setGroupColor(id: string, color: GroupColor) {
  commitTree(T.update(tree.value, id, { color }));
}

export function toggleGroup(id: string, allSiblings = false) {
  const loc = T.find(tree.value, id);
  if (!loc || loc.node.kind !== 'group') return;
  const collapsed = !loc.node.collapsed;
  if (allSiblings) {
    const sibs = loc.parent ? loc.parent.children : tree.value;
    let t = tree.value;
    for (const s of sibs) if (s.kind === 'group') t = T.update(t, s.id, { collapsed });
    commitTree(t);
  } else commitTree(T.update(tree.value, id, { collapsed }));
}

export function collapseAllInside(id: string, collapsed = true) {
  commitTree(T.setCollapsedDeep(tree.value, id, collapsed));
}

export function ungroup(id: string) {
  commitTree(T.ungroup(tree.value, id));
}

export function setGroupAutosave(id: string, value: boolean | undefined) {
  commitTree(T.update(tree.value, id, { autosave: value }));
}

export function moveNode(id: string, targetId: string, pos: DropPosition): boolean {
  return commitTree(T.move(tree.value, id, targetId, pos));
}

export function moveNodeToRoot(id: string) {
  return commitTree(T.moveToRoot(tree.value, id));
}

export function ensureQuickGroup() {
  if (T.find(tree.value, QUICK_GROUP_ID)) return;
  tree.value = [...tree.value, { id: QUICK_GROUP_ID, kind: 'group', name: 'Quick Notes', color: 'yellow', collapsed: false, system: 'quick-notes', children: [] }];
}

// ---------------------------------------------------------------- quick notes (from the bubble window)

export function onQuickNoteUpdated(p: { id: string; text: string; from: string; created?: number }) {
  visualApi.flush();
  if (p.from === platform.windowLabel) return;
  const d = docs.value[p.id];
  const now = Date.now();
  if (!d) {
    if (closedNotes.value.some((c) => c.id === p.id)) closedNotes.value = closedNotes.value.filter((c) => c.id !== p.id);
    addDoc(
      {
        id: p.id, kind: 'note', quick: true, path: null, title: noteTitle(p.text), encoding: 'utf-8', bom: false, eol: 'crlf',
        language: 'markdown', mdView: 'edit', dirty: false, mtime: 0, readonly: false, created: p.created ?? now, modified: now,
      },
      p.text,
    );
    ensureQuickGroup();
    tree.value = T.insert(tree.value, { id: p.id, kind: 'note' }, QUICK_GROUP_ID, 0);
    scheduleSession();
    return;
  }
  if (textOf(p.id) === p.text) return;
  const st = createEditorState(p.text, d.language === 'markdown', d.readonly, viewConfig(d));
  states.set(p.id, st);
  patchDoc(p.id, { title: noteTitle(p.text), modified: now });
  if (activeId.value === p.id && view) {
    const sel = Math.min(view.state.selection.main.head, p.text.length);
    view.setState(st);
    view.dispatch({ selection: { anchor: sel } });
    editTick.value++;
  }
}

// ---------------------------------------------------------------- commands used by menus & keys

export function withView(fn: (v: EditorView) => void) {
  if (view) fn(view);
}

/** Find / Replace work on the source: switch a Visual tab to Source first, then run. */
function leaveVisual(then: () => void): boolean {
  if (!inVisual()) return false;
  visualApi.flush();
  setMdView(activeId.value!, 'edit');
  queueMicrotask(then);
  return true;
}

export const cmd = {
  undo: () => (inVisual() ? visualApi.undo() : withView((v) => undo(v))),
  redo: () => (inVisual() ? visualApi.redo() : withView((v) => redo(v))),
  selectAll: () => withView((v) => selectAll(v)),
  find: () => leaveVisual(() => cmd.find()) || withView((v) => {
    openSearchPanel(v);
    setTimeout(() => (v.dom.querySelector('.cm-search input[name=search]') as HTMLInputElement | null)?.select(), 0);
  }),
  replace: () => leaveVisual(() => cmd.replace()) || withView((v) => {
    openSearchPanel(v);
    setTimeout(() => (v.dom.querySelector('.cm-search input[name=replace]') as HTMLInputElement | null)?.focus(), 0);
  }),
  findNext: (back = false) => withView((v) => {
    if (!searchPanelOpen(v.state)) return cmd.find();
    back ? findPrevious(v) : findNext(v);
  }),
  closeFind: () => withView((v) => searchPanelOpen(v.state) && closeSearchPanel(v)),
  cut: () => withView((v) => {
    v.focus();
    document.execCommand('cut');
  }),
  copy: () => withView((v) => {
    v.focus();
    document.execCommand('copy');
  }),
  paste: () => withView(async (v) => {
    try {
      const text = await navigator.clipboard.readText();
      v.dispatch(v.state.replaceSelection(text));
    } catch {
      v.focus();
      document.execCommand('paste');
    }
  }),
  del: () => withView((v) => {
    v.dispatch(v.state.replaceSelection(''));
  }),
  timeDate: () => withView((v) => {
    const now = new Date();
    const s = `${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} ${now.toLocaleDateString()}`;
    v.dispatch(v.state.replaceSelection(s));
    v.focus();
  }),
  async goToLine() {
    if (!view) return;
    const total = view.state.doc.lines;
    const r = await ask({ title: 'Go to line', buttons: [{ label: 'Go to', value: 'ok', primary: true }, { label: 'Cancel', value: 'cancel' }], input: { value: String(cursorInfo.value.line), label: 'Line number', type: 'number', select: true } });
    if (r.value !== 'ok' || !view) return;
    const n = Number(r.input);
    if (!Number.isInteger(n) || n < 1 || n > total) {
      await alertMsg('Notepad 2.0 - Goto line', 'The line number is beyond the total number of lines');
      return;
    }
    const line = view.state.doc.line(n);
    view.dispatch({ selection: { anchor: line.from }, scrollIntoView: true });
    view.focus();
  },
  zoom(delta: number | 'reset') {
    const z = delta === 'reset' ? 100 : Math.max(10, Math.min(500, settings.value.zoom + delta));
    updateSettings({ zoom: z });
    refreshView();
  },
  cycleTab(dir: 1 | -1) {
    const order = orderedIds.value;
    if (!order.length) return;
    const i = order.indexOf(activeId.value ?? '');
    activate(order[(i + dir + order.length) % order.length]);
  },
  goToTab(n: number) {
    const order = orderedIds.value;
    const id = n === 9 ? order[order.length - 1] : order[n - 1];
    if (id) activate(id);
  },
  print() {
    const d = activeDoc.value;
    if (!d) return;
    printText(textOf(d.id), displayTitle(d), d.language === 'markdown' && d.mdView !== 'edit');
  },
  toggleTabsMode() {
    const m = settings.value.tabsMode;
    updateSettings({ tabsMode: m === 'top' ? 'left' : 'top' });
  },
};

export function printText(text: string, title: string, rendered: boolean) {
  const root = document.createElement('div');
  root.id = 'print-root';
  if (rendered) {
    const src = document.querySelector('.md-preview .markdown-body, .visual-editor .ProseMirror');
    root.innerHTML = src ? src.innerHTML : '';
    root.className = 'markdown-body';
  } else {
    const pre = document.createElement('pre');
    pre.textContent = text;
    root.appendChild(pre);
  }
  root.setAttribute('data-title', title);
  document.body.appendChild(root);
  document.body.classList.add('printing');
  const done = () => {
    document.body.classList.remove('printing');
    root.remove();
    window.removeEventListener('afterprint', done);
  };
  window.addEventListener('afterprint', done);
  setTimeout(() => {
    window.print();
    setTimeout(done, 500);
  }, 50);
}

// ---------------------------------------------------------------- window / app lifecycle

export async function hideToTray() {
  await flushAll();
  await platform.hide();
}

export async function quitApp() {
  await flushAll();
  await platform.quit();
}

export async function onWindowCloseRequested() {
  if (settings.value.closeToTray) await hideToTray();
  else await quitApp();
}

export async function handleLaunch(argv: string[], cwd: string | null) {
  const req = parseLaunchArgs(argv, cwd);
  if (req.quickNote) {
    await platform.showQuickNote();
    return;
  }
  if (req.files.length) await openFiles(req.files);
  if (req.print) cmd.print();
  if (!req.hidden) await platform.show();
}

// ---------------------------------------------------------------- startup

async function restoreSession(): Promise<boolean> {
  const raw = await platform.storeRead('session.json');
  if (!raw) return false;
  let s: SessionFile;
  try {
    s = JSON.parse(raw);
  } catch {
    return false;
  }
  closedNotes.value = s.closedNotes ?? [];
  recentFiles.value = s.recentFiles ?? [];
  const keep = new Set<string>();
  for (const stored of s.docs ?? []) {
    const meta: DocMeta = { ...stored, mdView: migrateMdView(stored.mdView) };
    try {
      if (meta.kind === 'note') {
        const text = await platform.storeRead(`notes/${meta.id}.md`);
        addDoc({ ...meta, dirty: false, banner: null }, text ?? '');
        keep.add(meta.id);
        continue;
      }
      const recRaw = await platform.storeRead(`recovery/${meta.id}.json`);
      const rec = recRaw ? JSON.parse(recRaw) : null;
      const st = await platform.stat(meta.path!);
      if (!st.exists) {
        if (rec) {
          addDoc({ ...meta, dirty: true, banner: { kind: 'missing', text: 'The file is gone from disk. Your unsaved text was restored; save to recreate it.' } }, rec.text);
          keep.add(meta.id);
        }
        continue;
      }
      const f = await platform.readFile(meta.path!);
      const dec = decodeBytes(f.bytes);
      if (rec && rec.text !== dec.text) {
        addDoc(
          {
            ...meta, dirty: true, mtime: f.mtime, readonly: f.readonly, encoding: rec.encoding ?? dec.encoding, bom: rec.bom ?? dec.bom, eol: rec.eol ?? dec.eol,
            banner: {
              kind: 'restored',
              text: f.mtime > (rec.baseMtime ?? 0) + 1
                ? 'Unsaved changes restored. The file also changed on disk since then.'
                : 'Unsaved changes from your last session were restored.',
            },
          },
          rec.text,
        );
      } else {
        if (rec) await platform.storeDelete(`recovery/${meta.id}.json`);
        addDoc({ ...meta, dirty: false, mtime: f.mtime, readonly: f.readonly, encoding: dec.encoding, bom: dec.bom, eol: dec.eol, banner: null }, dec.text);
      }
      keep.add(meta.id);
    } catch {
      /* unreadable entries are dropped */
    }
  }
  tree.value = T.prune(s.tree ?? [], (id) => keep.has(id));
  // Anything in the tree's docs but missing from the tree (older sessions): append.
  const inTree = new Set(T.flattenNotes(tree.value));
  for (const id of keep) if (!inTree.has(id)) tree.value = [...tree.value, { id, kind: 'note' }];
  const act = s.activeId && keep.has(s.activeId) ? s.activeId : T.flattenNotes(tree.value)[0] ?? null;
  activeId.value = null;
  if (act) {
    activeId.value = act;
  }
  return keep.size > 0;
}

/** Quick notes written by the bubble while the main window missed the event. */
async function adoptOrphanNotes() {
  const files = await platform.storeList('notes');
  const known = new Set([...Object.keys(docs.value), ...closedNotes.value.map((c) => c.id)]);
  for (const f of files) {
    const id = f.replace(/\.md$/, '');
    if (known.has(id)) continue;
    const text = (await platform.storeRead(`notes/${f}`)) ?? '';
    if (!text.trim()) continue;
    onQuickNoteUpdated({ id, text, from: 'startup' });
  }
}

export async function init() {
  await loadSettings();
  const restored = await restoreSession();
  if (!restored && platform.kind === 'browser') {
    const { seedDemo } = await import('./demo');
    await seedDemo();
  }
  await adoptOrphanNotes();
  ready.value = true;

  const launch = await platform.launchArgs();
  const req = parseLaunchArgs(launch.argv, launch.cwd);
  if (req.files.length) await openFiles(req.files);
  if (!orderedIds.value.length) newNote();
  if (!activeId.value || !docs.value[activeId.value]) activate(orderedIds.value[0]);
  else {
    const id = activeId.value;
    activeId.value = null;
    activate(id);
  }
  if (req.print) cmd.print();
  // The native window starts hidden so it never flashes empty; show it once the UI is ready.
  // --hidden (start with Windows) and --quicknote keep it in the tray.
  if (req.quickNote) platform.showQuickNote();
  else if (!req.hidden) platform.show();

  platform.onSecondInstance((a) => handleLaunch(a.argv, a.cwd));
  platform.onCloseRequested(() => onWindowCloseRequested());
  platform.onFocus(() => checkExternalChanges());
  platform.listen<{ id: string; text: string; from: string; created?: number }>('note-updated', onQuickNoteUpdated);
  platform.listen<string>('open-doc', (id) => {
    if (docs.value[id]) activate(id);
    else reopenNote(id);
    platform.show();
  });
  platform.listen<{ id: string; path: string }>('quicknote-saved-as', async ({ id, path }) => {
    if (docs.value[id]) {
      stashActive();
      const text = textOf(id);
      patchDoc(id, { kind: 'file', quick: false, path, title: basename(path), mtime: Date.now(), dirty: false, language: isMarkdownPath(path) ? 'markdown' : 'plain' });
      await platform.storeDelete(`notes/${id}.md`);
      if (activeId.value === id) refreshView();
      void text;
      scheduleSession();
    }
  });
  platform.listen('quit-requested', () => quitApp());
  platform.listen('open-settings', () => {
    settingsOpen.value = true;
    platform.show();
  });
  platform.listen<Settings>('settings-changed', (s) => {
    applyRemoteSettings(s);
    refreshView();
  });
  // Final safety net: flush when the web view is torn down.
  window.addEventListener('beforeunload', () => {
    flushAll();
  });
  scheduleSession();
}
