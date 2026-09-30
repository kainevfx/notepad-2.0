// Visual (WYSIWYG) Markdown view. CodeMirror stays the source of truth: this parses its text on
// entry and writes each Visual edit back as one minimal change (see editor/visual/sync.ts).
import { useEffect, useRef } from 'preact/hooks';
import { useSignalEffect } from '@preact/signals';
import type { Editor } from '@tiptap/core';
import { activeDoc, activeId, editTick, getView, textOf, setMdView } from '../state/app';
import { mountVisualEditor, loadIntoEditor, editorToMarkdown } from '../editor/visual/extensions';
import { createVisualSync, visualApi, visualEpoch } from '../editor/visual/sync';
import { followLink } from '../state/links';
import { effectivePaper } from '../state/app';
import { settings } from '../state/settings';
import { visualPaper } from '../editor/visual/paper';

export function VisualEditor() {
  const host = useRef<HTMLDivElement>(null);
  const edRef = useRef<Editor | null>(null);
  const docId = useRef<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const sync = useRef(
    createVisualSync({
      serialize: () => (edRef.current ? editorToMarkdown(edRef.current) : ''),
      getText: () => getView()?.state.doc.toString() ?? '',
      apply: (ch) => {
        // Only ever write into the tab this editor was loaded from.
        const v = getView();
        if (v && docId.current && activeId.value === docId.current) v.dispatch({ changes: ch });
      },
    }),
  ).current;

  const flush = () => {
    clearTimeout(timer.current);
    if (docId.current && activeId.value === docId.current) sync.flush();
  };

  useEffect(() => {
    const ed = mountVisualEditor(host.current!, () => {
      sync.edited();
      clearTimeout(timer.current);
      timer.current = setTimeout(flush, 150);
    });
    const onDbl = (e: MouseEvent) => {
      const locked = (e.target as HTMLElement).closest('[data-locked]');
      const id = activeDoc.value?.id;
      if (locked && id) {
        flush();
        setMdView(id, 'edit');
      }
    };
    ed.view.dom.addEventListener('dblclick', onDbl);
    // Ctrl+click follows a link (a plain click places the cursor, as in Word).
    const onClick = (e: MouseEvent) => {
      const a = (e.target as HTMLElement).closest('a[href]');
      if (!a || !(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      void followLink(a.getAttribute('href') ?? '', activeDoc.value?.path ?? null);
    };
    ed.view.dom.addEventListener('click', onClick);
    edRef.current = ed;
    visualApi.editor = ed;
    visualApi.flush = flush;
    visualApi.undo = () => ed.commands.undo();
    visualApi.redo = () => ed.commands.redo();
    visualEpoch.value++;
    return () => {
      flush();
      ed.view.dom.removeEventListener('dblclick', onDbl);
      ed.view.dom.removeEventListener('click', onClick);
      visualApi.editor = null;
      visualApi.flush = () => {};
      visualApi.undo = visualApi.redo = () => false;
      edRef.current = null;
      ed.destroy();
      visualEpoch.value++;
    };
  }, []);

  // Load the active tab, and re-load when its text changed outside Visual (Source edit, reload).
  useSignalEffect(() => {
    editTick.value;
    const d = activeDoc.value;
    const ed = edRef.current;
    if (!d || !ed) return;
    const text = textOf(d.id);
    if (ed.isEditable === d.readonly) ed.setEditable(!d.readonly, false);
    if (docId.current === d.id && !sync.needsReload(text)) return;
    clearTimeout(timer.current); // any pending edit belonged to the previous tab and was flushed on switch
    loadIntoEditor(ed, text, !d.readonly);
    docId.current = d.id;
    sync.loaded(text);
  });

  const paper = visualPaper(effectivePaper(activeDoc.value), settings.value);
  return <div class={`visual-editor ${paper.cls}`} style={paper.vars} ref={host} />;
}
