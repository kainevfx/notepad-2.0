import { useEffect, useRef, useState } from 'preact/hooks';
import { useSignalEffect } from '@preact/signals';
import { EditorView } from '@codemirror/view';
import {
  attachView, activeDoc, editTick, textOf, reloadDoc, keepMine, dismissBanner, discardRestored, saveDocAs, refreshView,
  dirname, openFiles, getView,
} from '../state/app';
import { settings } from '../state/settings';
import { platform } from '../platform';
import { renderMarkdown } from '../markdown/pipeline';
import { createEditorState } from '../editor/setup';
import { renderMermaid } from '../markdown/mermaid';
import { resolveImageUrl } from '../editor/insert';
import { VisualEditor } from './VisualEditor';

function Banner() {
  const d = activeDoc.value;
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

function joinPath(dir: string, rel: string): string {
  const sep = dir.includes('\\') ? '\\' : '/';
  const parts = (dir + sep + rel.replace(/[\\/]/g, sep)).split(sep);
  const out: string[] = [];
  for (const p of parts) {
    if (p === '..') out.pop();
    else if (p !== '.') out.push(p);
  }
  return out.join(sep);
}

export function Preview({ syncRef }: { syncRef: { current: ((line: number, frac: number) => void) | null } }) {
  const ref = useRef<HTMLDivElement>(null);
  const [html, setHtml] = useState('');
  const d = activeDoc.value;
  const dark = document.documentElement.classList.contains('dark');

  useSignalEffect(() => {
    editTick.value;
    const doc = activeDoc.value;
    const s = settings.value;
    if (!doc || doc.language !== 'markdown' || doc.mdView !== 'split') return;
    const id = doc.id;
    const path = doc.path;
    const t = setTimeout(() => {
      const base = path ? dirname(path) : null;
      setHtml(
        renderMarkdown(textOf(id), {
          blockRemoteImages: s.blockRemoteImages,
          // Relative images load from the document's folder, drive paths directly (also in unsaved notes).
          resolveUrl: (u) => (u ? resolveImageUrl(base, u, platform.assetUrl) : base ?? ''),
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
    const href = a.getAttribute('href') ?? '';
    e.preventDefault();
    if (href.startsWith('#')) {
      const target = ref.current?.querySelector(`[id="${CSS.escape('user-content-' + decodeURIComponent(href.slice(1)))}"], [id="${CSS.escape(decodeURIComponent(href.slice(1)))}"]`);
      target?.scrollIntoView({ block: 'start' });
      return;
    }
    if (/^(https?:|mailto:)/i.test(href)) {
      platform.openExternal(href);
      return;
    }
    if (d?.path && href) {
      const p = joinPath(dirname(d.path), decodeURI(href.split('#')[0]));
      openFiles([p]);
    }
  };

  return (
    <div class="md-preview">
      <div class="markdown-body" ref={ref} onClick={(e) => onClick(e as MouseEvent)} dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}

export function EditorPane() {
  const host = useRef<HTMLDivElement>(null);
  const syncRef = useRef<((line: number, frac: number) => void) | null>(null);
  const [split, setSplit] = useState(0.5);
  const d = activeDoc.value;
  const view = d?.language === 'markdown' ? d.mdView : 'edit';

  useEffect(() => {
    const v = new EditorView({
      parent: host.current!,
      state: createEditorState('', false, false, { paper: 'none', settings: settings.value }),
    });
    attachView(v);
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
      attachView(null);
      v.destroy();
    };
  }, []);

  // Settings changes (font, zoom, wrap, paper) apply to the visible editor right away.
  useSignalEffect(() => {
    settings.value;
    queueMicrotask(refreshView);
  });

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
    <section class={`editor-pane view-${view}`} style={{ '--page-margin': `${settings.value.pageMargin}px` } as any}>
      <Banner />
      <div class="editor-split">
        <div
          class="editor-host"
          ref={host}
          style={view === 'split' ? { flex: `0 0 ${split * 100}%` } : view === 'visual' ? { display: 'none' } : undefined}
        />
        {view === 'split' && <div class="split-divider" onPointerDown={(e) => onDivider(e as PointerEvent)} />}
        {view === 'split' && <Preview syncRef={syncRef} />}
        {view === 'visual' && <VisualEditor />}
      </div>
    </section>
  );
}
