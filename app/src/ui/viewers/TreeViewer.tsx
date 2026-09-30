// JSON / YAML / XML as a collapsible tree. A file that doesn't parse shows the error and opens
// in Source so it can be fixed.
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { ViewerProps } from '../ViewerPane';
import { treeFor, type TNode } from '../../lib/tree-model';
import { setMdView } from '../../state/app';

const isBranch = (n: TNode): n is Extract<TNode, { children: TNode[] }> => 'children' in n;

/** Every branch path in the tree (for Expand all), and those shallower than `depth`. */
function branchPaths(n: TNode, path: string, depth: number, maxDepth: number, out: Set<string>) {
  if (!isBranch(n)) return;
  if (depth < maxDepth) out.add(path);
  n.children.forEach((c, i) => branchPaths(c, `${path}/${i}`, depth + 1, maxDepth, out));
}

function Summary({ n }: { n: TNode }) {
  if (n.t === 'obj') return <span class="tv-count">{`{${n.children.length}}`}</span>;
  if (n.t === 'arr') return <span class="tv-count">{`[${n.children.length}]`}</span>;
  if (n.t === 'el')
    return (
      <span class="tv-el">
        {'<'}
        {n.name}
        {n.attrs.map(([k, v]) => (
          <span key={k}>
            {' '}
            <span class="tv-attr">{k}</span>=<span class="tv-str">"{v}"</span>
          </span>
        ))}
        {'>'}
      </span>
    );
  return null;
}

function Row({ n, path, depth, open, toggle }: { n: TNode; path: string; depth: number; open: Set<string>; toggle: (p: string) => void }) {
  const branch = isBranch(n);
  const expanded = branch && open.has(path);
  const key = 'key' in n && n.key !== undefined ? n.key : null;
  return (
    <>
      <div class="tv-row" style={{ '--d': depth } as any}>
        {branch && n.children.length ? (
          <button class="tv-chev" onClick={() => toggle(path)} aria-label={expanded ? 'Collapse' : 'Expand'}>
            {expanded ? '▾' : '▸'}
          </button>
        ) : (
          <span class="tv-chev" />
        )}
        {key !== null && <span class="tv-key">{key}</span>}
        {key !== null && n.t !== 'el' && <span class="tv-colon">: </span>}
        {n.t === 'val' && <span class={`tv-${n.vt === 'string' ? 'str' : 'num'}`}>{n.vt === 'string' ? JSON.stringify(n.value) : n.value}</span>}
        {n.t === 'text' && <span class="tv-text">{n.value}</span>}
        <Summary n={n} />
      </div>
      {expanded && n.children.map((c, i) => <Row key={i} n={c} path={`${path}/${i}`} depth={depth + 1} open={open} toggle={toggle} />)}
    </>
  );
}

export function TreeViewer({ doc, text }: ViewerProps) {
  const result = useMemo(() => treeFor(doc.path, text), [doc.path, text]);
  const [open, setOpen] = useState<Set<string>>(() => new Set());
  const sentToSource = useRef(false);

  useEffect(() => {
    if (!result.ok) return;
    const s = new Set<string>();
    branchPaths(result.root, '', 0, 2, s);
    setOpen((prev) => (prev.size ? prev : s));
  }, [result]);

  useEffect(() => {
    if (!result.ok && !sentToSource.current && doc.mdView === 'visual') {
      sentToSource.current = true;
      setMdView(doc.id, 'split');
    }
  }, [result, doc.id]);

  if (!result.ok)
    return (
      <div class="banner banner-error tv-error">
        Couldn't read this file: {result.message}
        {result.line ? ` (line ${result.line})` : ''}. Fix it in Source.
      </div>
    );

  const toggle = (p: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(p)) next.delete(p);
      else next.add(p);
      return next;
    });
  const all = (on: boolean) => {
    const s = new Set<string>();
    if (on) branchPaths(result.root, '', 0, Infinity, s);
    setOpen(s);
  };

  return (
    <>
      <div class="viewer-toolbar">
        <button class="btn" onClick={() => all(true)}>Expand all</button>
        <button class="btn" onClick={() => all(false)}>Collapse all</button>
      </div>
      <div class="tv-scroll">
        <Row n={result.root} path="" depth={0} open={open} toggle={toggle} />
      </div>
    </>
  );
}
