// Visual (WYSIWYG) Markdown view for one pane. CodeMirror stays the source of truth: this parses
// its text on entry and writes each Visual edit back as one minimal change (editor/visual/sync.ts).
// With split view there can be two; only the active pane's is "the" Visual editor (toolbar, undo,
// flush) and only it writes. The other one just shows its document and follows edits.
import { useEffect, useRef, useState } from 'preact/hooks';
import { useSignalEffect } from '@preact/signals';
import type { Editor } from '@tiptap/core';
import { docs, activeId, editTick, getView, textOf, setPaneView, panes, effectivePaper, dirname } from '../state/app';
import { createRenderContext } from '../editor/visual/render-context';
import { imageResolver } from '../editor/image-resolver';
import { mountVisualEditor, loadIntoEditor, editorToMarkdown } from '../editor/visual/extensions';
import { createVisualSync, visualApi, visualEpoch } from '../editor/visual/sync';
import { followLink } from '../state/links';
import { settings } from '../state/settings';
import { visualPaper } from '../editor/visual/paper';
import type { PaneId } from '../lib/panes';

const isActivePane = (pane: PaneId) => !panes.value.on || panes.value.active === pane;

export function VisualEditor({ pane = 'a' }: { pane?: PaneId }) {
  const host = useRef<HTMLDivElement>(null);
  const edRef = useRef<Editor | null>(null);
  const docId = useRef<string | null>(null);
  // What rendered blocks (images, maths, diagrams) depend on: this pane's document folder and the
  // remote-image setting. The same resolver is reused until one of them changes.
  const [context] = useState(() =>
    createRenderContext(() => {
      const id = panes.peek().docs[pane] ?? activeId.peek();
      const path = id ? docs.peek()[id]?.path : null;
      return { blockRemoteImages: settings.peek().blockRemoteImages, resolveUrl: imageResolver(path ? dirname(path) : null) };
    }),
  );
  const renderKey = useRef('');
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const reloadTimer = useRef<ReturnType<typeof setTimeout>>();
  const sync = useRef(
    createVisualSync({
      serialize: () => (edRef.current ? editorToMarkdown(edRef.current) : ''),
      getText: () => getView()?.state.doc.toString() ?? '',
      apply: (ch) => {
        // Only ever write into the tab this editor was loaded from, from the active pane.
        const v = getView();
        if (v && docId.current && isActivePane(pane) && activeId.value === docId.current) v.dispatch({ changes: ch });
      },
    }),
  ).current;

  const flush = () => {
    clearTimeout(timer.current);
    if (docId.current && isActivePane(pane) && activeId.value === docId.current) sync.flush();
  };

  useEffect(() => {
    const ed = mountVisualEditor(host.current!, () => {
      sync.edited();
      clearTimeout(timer.current);
      timer.current = setTimeout(flush, 150);
    }, context);
    const onDbl = (e: MouseEvent) => {
      const locked = (e.target as HTMLElement).closest('[data-locked]');
      const id = docId.current;
      if (locked && id) {
        flush();
        setPaneView(pane, 'edit');
      }
    };
    ed.view.dom.addEventListener('dblclick', onDbl);
    // Ctrl+click follows a link (a plain click places the cursor, as in Word).
    const onClick = (e: MouseEvent) => {
      const a = (e.target as HTMLElement).closest('a[href]');
      if (!a || !(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      void followLink(a.getAttribute('href') ?? '', (docId.current && docs.value[docId.current]?.path) || null);
    };
    ed.view.dom.addEventListener('click', onClick);
    edRef.current = ed;
    return () => {
      flush();
      ed.view.dom.removeEventListener('dblclick', onDbl);
      ed.view.dom.removeEventListener('click', onClick);
      if (visualApi.editor === ed) {
        visualApi.editor = null;
        visualApi.flush = () => {};
        visualApi.undo = visualApi.redo = () => false;
        visualEpoch.value++;
      }
      edRef.current = null;
      ed.destroy();
    };
  }, []);

  // The active pane's Visual editor is the one the toolbar, undo and saving talk to.
  useSignalEffect(() => {
    const on = isActivePane(pane);
    const ed = edRef.current;
    if (!ed) return;
    if (on && visualApi.editor !== ed) {
      visualApi.editor = ed;
      visualApi.flush = flush;
      visualApi.undo = () => ed.commands.undo();
      visualApi.redo = () => ed.commands.redo();
      visualEpoch.value++;
    } else if (!on && visualApi.editor === ed) {
      visualApi.editor = null;
      visualApi.flush = () => {};
      visualApi.undo = visualApi.redo = () => false;
      visualEpoch.value++;
    }
  });

  // Images and other rendered blocks resolve against this pane's document folder.
  // Re-rendered only when the folder or the setting actually changes (not on every edit).
  useSignalEffect(() => {
    const id = panes.value.docs[pane] ?? activeId.value;
    const key = `${(id && docs.value[id]?.path) || ''}|${settings.value.blockRemoteImages}`;
    if (key === renderKey.current) return;
    const first = renderKey.current === '';
    renderKey.current = key;
    if (!first) context.refresh();
  });

  // Load this pane's document, and re-load when its text changed elsewhere (Source, the other
  // pane, a reload from disk).
  useSignalEffect(() => {
    editTick.value;
    const id = panes.value.docs[pane] ?? activeId.value;
    const d = id ? docs.value[id] : null;
    const ed = edRef.current;
    if (!d || !ed) return;
    const text = textOf(d.id);
    if (ed.isEditable === d.readonly) ed.setEditable(!d.readonly, false);
    if (docId.current === d.id && !sync.needsReload(text)) return;
    // A pending edit belongs to the document shown before; write it there first.
    if (docId.current && docId.current !== d.id) flush();
    clearTimeout(timer.current);
    clearTimeout(reloadTimer.current);
    const load = () => {
      loadIntoEditor(ed, textOf(d.id), !d.readonly);
      docId.current = d.id;
      sync.loaded(textOf(d.id));
    };
    // The inactive pane follows the other pane's typing after a short pause, not per keystroke.
    if (!isActivePane(pane) && docId.current === d.id) reloadTimer.current = setTimeout(load, 150);
    else load();
  });
  useEffect(() => () => clearTimeout(reloadTimer.current), []);

  const id = panes.value.docs[pane] ?? activeId.value;
  const paper = visualPaper(effectivePaper(id ? docs.value[id] ?? null : null), settings.value);
  return <div class={`visual-editor ${paper.cls}`} style={paper.vars} ref={host} />;
}
