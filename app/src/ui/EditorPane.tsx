// The document area: one pane, or two side by side (split view). Each pane has its own editor,
// Visual view, preview and viewer; only the active pane edits (state/app.ts routes commands).
import { useEffect, useRef, useState } from 'preact/hooks';
import { useSignalEffect } from '@preact/signals';
import { EditorView } from '@codemirror/view';
import {
  attachPaneView, docs, editTick, textOf, reloadDoc, keepMine, dismissBanner, discardRestored, saveDocAs, refreshView,
  dirname, getView, panes, focusPane, setPaneView, setSplitRatio, type DocMeta,
} from '../state/app';
import { settings } from '../state/settings';
import { renderMarkdown } from '../markdown/pipeline';
import { createEditorState } from '../editor/setup';
import { renderMermaid } from '../markdown/mermaid';
import { imageResolver } from '../editor/image-resolver';
import { VisualEditor } from './VisualEditor';
import { followLink } from '../state/links';
import { ViewerPane } from './ViewerPane';
import { ViewSwitch, showsViewSwitch } from './ViewSwitch';
import { isBinaryKind, hasViewPane } from '../lib/view-kind';
import { viewFor, type PaneId } from '../lib/panes';
import { readAloudMenu } from './ReadAloud';

function Banner({ d }: { d: DocMeta | null }) {
  const b = d?.banner;
  if (!d || !b) return null;
  return (
    <div class={`banner banner-${b.kind}`}>
      <span>{b.text}</span>
      <div class="banner-actions">
        {b.kind === 'external' && (
          <>
            <button class="btn" onClick={() => reloadDoc(d.id)}>Reload</button>
            <button class="btn" onClick={() => keepMine(d.id)}>Keep mine</button>
          </>
        )}
        {b.kind === 'restored' && (
          <>
            <button class="btn" onClick={() => dismissBanner(d.id)}>Keep</button>
            <button class="btn" onClick={() => discardRestored(d.id)}>Discard changes</button>
          </>
        )}
        {b.kind === 'readonly' && <button class="btn" onClick={() => saveDocAs(d.id)}>Save as…</button>}
        <button class="btn subtle" onClick={() => dismissBanner(d.id)} title="Dismiss">✕</button>
      </div>
    </div>
  );
}

export function Preview({ docId, syncRef }: { docId: string; syncRef: { current: ((line: number, frac: number) => void) | null } }) {
  const ref = useRef<HTMLDivElement>(null);
  const [html, setHtml] = useState('');
  const d = docs.value[docId] ?? null;
  const dark = document.documentElement.classList.contains('dark');

  useSignalEffect(() => {
    editTick.value;
    const doc = docs.value[docId];
    const s = settings.value;
    if (!doc || doc.language !== 'markdown') return;
    const id = doc.id;
    const path = doc.path;
    const t = setTimeout(() => {
      const base = path ? dirname(path) : null;
      setHtml(
        renderMarkdown(textOf(id), {
          blockRemoteImages: s.blockRemoteImages,
          // Relative images load from the document's folder, drive paths directly (also in unsaved notes).
          resolveUrl: imageResolver(base),
        }),
      );
    }, 120);
    return () => clearTimeout(t);
  });

  useEffect(() => {
    if (ref.current) renderMermaid(ref.current, dark);
  }, [html, dark]);

  useEffect(() => {
    syncRef.current = (line, frac) => {
      const root = ref.current?.parentElement;
      if (!root || !ref.current) return;
      const els = Array.from(ref.current.querySelectorAll('[data-line]')) as HTMLElement[];
      let before: HTMLElement | null = null;
      let after: HTMLElement | null = null;
      for (const el of els) {
        const l = Number(el.dataset.line);
        if (l <= line) before = el;
        else {
          after = el;
          break;
        }
      }
      if (!before) {
        root.scrollTop = 0;
        return;
      }
      const top = before.offsetTop;
      const next = after ? after.offsetTop : top + before.offsetHeight;
      const bl = Number(before.dataset.line);
      const al = after ? Number(after.dataset.line) : bl + 1;
      const f = Math.min(1, Math.max(0, (line + frac - bl) / Math.max(1, al - bl)));
      root.scrollTop = top + (next - top) * f - 12;
    };
    return () => (syncRef.current = null);
  }, []);

  const onClick = (e: MouseEvent) => {
    const a = (e.target as HTMLElement).closest('a');
    if (!a) return;
    e.preventDefault();
    void followLink(a.getAttribute('href') ?? '', d?.path ?? null, (id) =>
      ref.current?.querySelector(`[id="${CSS.escape('user-content-' + id)}"], [id="${CSS.escape(id)}"]`)?.scrollIntoView({ block: 'start' }),
    );
  };

  return (
    <div class="md-preview">
      <div class="markdown-body" ref={ref} onClick={(e) => onClick(e as MouseEvent)} dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}

/** One document pane. */
function Pane({ pane }: { pane: PaneId }) {
  const host = useRef<HTMLDivElement>(null);
  const syncRef = useRef<((line: number, frac: number) => void) | null>(null);
  const [split, setSplit] = useState(0.5);
  const s = panes.value;
  const id = s.docs[pane];
  const d = id ? docs.value[id] ?? null : null;
  const kind = d?.viewer;
  const binary = isBinaryKind(kind);
  const dataView = hasViewPane(kind);
  const mode = d ? viewFor(s, pane, d.mdView) : 'edit';
  const view = binary ? 'viewer' : dataView ? mode : d?.language === 'markdown' ? mode : 'edit';
  const active = !s.on || s.active === pane;

  useEffect(() => {
    const v = new EditorView({
      parent: host.current!,
      state: createEditorState('', false, false, { paper: 'none', settings: settings.value }),
    });
    attachPaneView(pane, v);
    const onScroll = () => {
      const sync = syncRef.current;
      if (!sync) return;
      const top = v.scrollDOM.scrollTop;
      const block = v.lineBlockAtHeight(top);
      const line = v.state.doc.lineAt(block.from).number;
      sync(line, block.height ? (top - block.top) / block.height : 0);
    };
    v.scrollDOM.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      attachPaneView(pane, null);
      v.destroy();
    };
  }, []);

  const onDivider = (e: PointerEvent) => {
    e.preventDefault();
    const box = (e.currentTarget as HTMLElement).parentElement!.getBoundingClientRect();
    const move = (ev: PointerEvent) => setSplit(Math.max(0.15, Math.min(0.85, (ev.clientX - box.left) / box.width)));
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      getView()?.requestMeasure();
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  return (
    <section
      class={`editor-pane view-${view}${s.on ? ' in-split' : ''}${active && s.on ? ' pane-active' : ''}`}
      style={{ '--page-margin': `${settings.value.pageMargin}px` } as any}
      onPointerDownCapture={() => focusPane(pane)}
      // Lower-case names: Preact passes them straight through as the real event names
      // (Chromium has no onfocusin property, so onFocusIn would listen for 'FocusIn').
      onContextMenu={(e) => readAloudMenu(e as MouseEvent)}
      {...({ ondragenter: () => focusPane(pane), onfocusin: () => focusPane(pane) } as any)}
    >
      <Banner d={d} />
      <div class="editor-split">
        {d && showsViewSwitch(d) && <ViewSwitch doc={d} view={mode} onSet={(v) => setPaneView(pane, v)} />}
        <div
          class="editor-host"
          ref={host}
          style={view === 'split' ? { flex: `0 0 ${split * 100}%` } : view === 'visual' || view === 'viewer' ? { display: 'none' } : undefined}
        />
        {view === 'split' && <div class="split-divider" onPointerDown={(e) => onDivider(e as PointerEvent)} />}
        {view === 'split' && !dataView && d && <Preview docId={d.id} syncRef={syncRef} />}
        {view === 'visual' && !dataView && d && <VisualEditor pane={pane} />}
        {d && (binary || (dataView && view !== 'edit')) && <ViewerPane key={d.id} doc={d} />}
      </div>
    </section>
  );
}

/** The document area: one pane, or two with a draggable divider. */
export function EditorArea() {
  const s = panes.value;
  const box = useRef<HTMLDivElement>(null);

  // Settings changes (font, zoom, wrap, paper) apply to the visible editors right away.
  useSignalEffect(() => {
    settings.value;
    queueMicrotask(refreshView);
  });

  const onDivider = (e: PointerEvent) => {
    e.preventDefault();
    const r = box.current!.getBoundingClientRect();
    const move = (ev: PointerEvent) => setSplitRatio((ev.clientX - r.left) / r.width);
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      getView()?.requestMeasure();
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  // One element tree whether split is on or off, so pane A (its editor, divider, Visual undo)
  // stays mounted when pane B comes and goes.
  return (
    <div class={`editor-area${s.on ? ' split-on' : ''}`} ref={box}>
      <div class="pane-slot" style={{ flex: s.on ? `0 0 ${s.ratio * 100}%` : '1 1 auto' }}>
        <Pane key="a" pane="a" />
      </div>
      {s.on && <div class="pane-divider" onPointerDown={(e) => onDivider(e as PointerEvent)} />}
      {s.on && (
        <div class="pane-slot" style={{ flex: '1 1 0' }}>
          <Pane key="b" pane="b" />
        </div>
      )}
    </div>
  );
}
