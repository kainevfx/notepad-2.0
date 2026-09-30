// The View side of a data file (grid, tree, rendered page) or the whole tab for binary files
// (spreadsheet, image, PDF, Word). Each viewer is loaded the first time it is needed.
import { useEffect, useState } from 'preact/hooks';
import type { ComponentType } from 'preact';
import { useSignalEffect } from '@preact/signals';
import { editTick, textOf, type DocMeta } from '../state/app';
import { isBinaryKind, MAX_PREVIEW_BYTES, type ViewerKind } from '../lib/view-kind';
import { Notice } from './viewers/Notice';

export interface ViewerProps {
  doc: DocMeta;
  /** The current source text (empty for binary files). */
  text: string;
}

type Loader = () => Promise<ComponentType<ViewerProps>>;

/** Filled in as viewers are added; a kind without one shows its Source only. */
export const viewerLoaders: Partial<Record<ViewerKind, Loader>> = {
  table: () => import('./viewers/TableViewer').then((m) => m.TableViewer),
};

const loaded = new Map<ViewerKind, ComponentType<ViewerProps>>();

export function ViewerPane({ doc }: { doc: DocMeta }) {
  const kind = doc.viewer ?? 'text';
  const [Comp, setComp] = useState<ComponentType<ViewerProps> | null>(() => loaded.get(kind) ?? null);
  const [error, setError] = useState<string | null>(null);
  const [text, setText] = useState(() => (isBinaryKind(kind) ? '' : textOf(doc.id)));

  useEffect(() => {
    setError(null);
    const have = loaded.get(kind);
    if (have) return setComp(() => have);
    setComp(null);
    const load = viewerLoaders[kind];
    if (!load) return;
    let live = true;
    load()
      .then((c) => {
        loaded.set(kind, c);
        if (live) setComp(() => c);
      })
      .catch((e) => live && setError(String(e)));
    return () => {
      live = false;
    };
  }, [kind]);

  // Follow Source edits (debounced so typing stays smooth).
  const id = doc.id;
  useSignalEffect(() => {
    editTick.value;
    if (isBinaryKind(kind)) return;
    const t = setTimeout(() => setText(textOf(id)), 300);
    return () => clearTimeout(t);
  });
  useEffect(() => {
    if (!isBinaryKind(kind)) setText(textOf(id));
  }, [id]);

  if (kind === 'large' || (isBinaryKind(kind) && (doc.size ?? 0) > MAX_PREVIEW_BYTES))
    return <Notice text="This file is too large to preview." path={doc.path} />;
  if (error) return <Notice text="Couldn't show this file." detail={error} path={doc.path} />;
  if (!Comp) return <div class="viewer-loading">Loading…</div>;
  return (
    <div class={`viewer viewer-${kind}`}>
      <Comp doc={doc} text={text} />
    </div>
  );
}
