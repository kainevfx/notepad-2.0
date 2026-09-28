// Formatting commands for Markdown in Source / Split view: they insert Markdown syntax, or the
// small HTML tags Markdown has no syntax for (<u>, <span style>, align="…").
// Each takes anything with { state, dispatch }, so tests can drive them without a DOM.
import { EditorSelection, type EditorState, type Line } from '@codemirror/state';

type V = { state: EditorState; dispatch: (tr: any) => void };

export function toggleWrap(view: V, open: string, close: string, placeholder: string): boolean {
  const { state } = view;
  view.dispatch(
    state.changeByRange((r) => {
      const before = state.sliceDoc(r.from - open.length, r.from);
      const after = state.sliceDoc(r.to, r.to + close.length);
      if (before === open && after === close) {
        return {
          changes: [
            { from: r.from - open.length, to: r.from },
            { from: r.to, to: r.to + close.length },
          ],
          range: EditorSelection.range(r.from - open.length, r.to - open.length),
        };
      }
      const body = state.sliceDoc(r.from, r.to) || placeholder;
      return {
        changes: { from: r.from, to: r.to, insert: open + body + close },
        range: EditorSelection.range(r.from + open.length, r.from + open.length + body.length),
      };
    }),
  );
  return true;
}

function selectedLines(state: EditorState): Line[] {
  const seen = new Set<number>();
  const out: Line[] = [];
  for (const r of state.selection.ranges) {
    for (let n = state.doc.lineAt(r.from).number; n <= state.doc.lineAt(r.to).number; n++) {
      if (!seen.has(n)) {
        seen.add(n);
        out.push(state.doc.line(n));
      }
    }
  }
  return out;
}

const BLOCK_PREFIX = /^(#{1,6}\s+|>\s?)/;

export function setBlockType(view: V, kind: 'body' | 'h1' | 'h2' | 'h3' | 'quote' | 'code'): boolean {
  const { state } = view;
  const lines = selectedLines(state);
  if (kind === 'code') {
    const from = lines[0].from;
    const to = lines[lines.length - 1].to;
    view.dispatch({ changes: { from, to, insert: '```\n' + state.sliceDoc(from, to) + '\n```' } });
    return true;
  }
  const prefix = { body: '', h1: '# ', h2: '## ', h3: '### ', quote: '> ' }[kind];
  view.dispatch({
    changes: lines.map((l) => {
      const m = BLOCK_PREFIX.exec(l.text);
      return { from: l.from, to: l.from + (m ? m[0].length : 0), insert: prefix };
    }),
  });
  return true;
}

const LIST_RE = /^(\s*)([-*+]\s\[[ xX]\]\s|[-*+]\s|\d+[.)]\s)/;

export function toggleList(view: V, kind: 'bullet' | 'number' | 'check'): boolean {
  const { state } = view;
  const lines = selectedLines(state);
  const want = (i: number) => (kind === 'bullet' ? '- ' : kind === 'check' ? '- [ ] ' : `${i + 1}. `);
  const isKind = (t: string) => {
    const m = LIST_RE.exec(t);
    if (!m) return false;
    const mk = m[2];
    if (kind === 'check') return mk.includes('[');
    if (kind === 'number') return /^\d/.test(mk);
    return !mk.includes('[') && !/^\d/.test(mk);
  };
  const allOn = lines.every((l) => isKind(l.text));
  view.dispatch({
    changes: lines.map((l, i) => {
      const m = LIST_RE.exec(l.text);
      const from = l.from + (m ? m[1].length : 0);
      const to = m ? l.from + m[0].length : l.from;
      return { from, to, insert: allOn ? '' : want(i) };
    }),
  });
  return true;
}

export function indentLines(view: V, dir: 1 | -1): boolean {
  const { state } = view;
  view.dispatch({
    changes: selectedLines(state).map((l) => {
      if (dir === 1) return { from: l.from, insert: LIST_RE.test(l.text) ? '  ' : '\t' };
      const m = /^(\t| {1,2})/.exec(l.text);
      return { from: l.from, to: l.from + (m ? m[0].length : 0) };
    }),
  });
  return true;
}

export function wrapSpanStyle(view: V, prop: 'color' | 'font-size' | 'font-weight', value: string): boolean {
  return toggleWrap(view, `<span style="${prop}:${value}">`, '</span>', 'text');
}

const OLD_ALIGN_RE = /^<(p|h([1-6])) align="(?:left|center|right|justify)">([\s\S]*)<\/\1>$/;
const DIV_OPEN = /^<div align="(?:left|center|right|justify)">\s*$/;
const DIV_CLOSE = /^<\/div>\s*$/;

/**
 * Align the block around the cursor. Aligned blocks are written the way GitHub renders them:
 * <div align="center">, blank line, the Markdown, blank line, </div>. Left removes the wrapper.
 */
export function setAlign(view: V, align: 'left' | 'center' | 'right' | 'justify'): boolean {
  const { state } = view;
  const doc = state.doc;
  const cur = doc.lineAt(state.selection.main.head).number;
  const wrap = (md: string) => (align === 'left' ? md : `<div align="${align}">\n\n${md}\n\n</div>`);

  // Already inside an aligned div? Rewrite the whole div.
  let open = -1;
  for (let n = cur; n >= 1; n--) {
    const t = doc.line(n).text;
    if (DIV_OPEN.test(t)) {
      open = n;
      break;
    }
    if (DIV_CLOSE.test(t) && n !== cur) break;
  }
  if (open > 0) {
    for (let n = Math.max(cur, open + 1); n <= doc.lines; n++) {
      if (DIV_OPEN.test(doc.line(n).text) && n !== open) break;
      if (DIV_CLOSE.test(doc.line(n).text)) {
        const from = doc.line(open).from;
        const to = doc.line(n).to;
        const inner = doc.sliceString(doc.line(open).to, doc.line(n).from).replace(/^\s*\n/, '').replace(/\n\s*$/, '');
        view.dispatch({ changes: { from, to, insert: wrap(inner) } });
        return true;
      }
    }
  }

  // Older single-line <p align> / <hN align>.
  const line = doc.line(cur);
  const old = OLD_ALIGN_RE.exec(line.text);
  if (old) {
    const md = old[2] ? `${'#'.repeat(Number(old[2]))} ${old[3]}` : old[3];
    view.dispatch({ changes: { from: line.from, to: line.to, insert: wrap(md) } });
    return true;
  }

  // Plain block: the run of non-blank lines around the cursor.
  if (align === 'left' || !line.text.trim()) return true;
  let a = cur;
  let b = cur;
  while (a > 1 && doc.line(a - 1).text.trim()) a--;
  while (b < doc.lines && doc.line(b + 1).text.trim()) b++;
  const from = doc.line(a).from;
  const to = doc.line(b).to;
  view.dispatch({ changes: { from, to, insert: wrap(doc.sliceString(from, to)) } });
  return true;
}

export function insertTable(view: V, rows: number, cols: number): boolean {
  const head = '| ' + Array.from({ length: cols }, (_, i) => `Column ${i + 1}`).join(' | ') + ' |';
  const sep = '| ' + Array(cols).fill('---').join(' | ') + ' |';
  const row = '| ' + Array(cols).fill('').join(' | ') + ' |';
  const text = [head, sep, ...Array(rows).fill(row)].join('\n') + '\n';
  const { state } = view;
  const pos = state.selection.main.head;
  const lead = pos > 0 && state.sliceDoc(pos - 1, pos) !== '\n' ? '\n\n' : '';
  view.dispatch({ changes: { from: pos, insert: lead + text } });
  return true;
}

export function insertRule(view: V): boolean {
  const pos = view.state.selection.main.head;
  view.dispatch({ changes: { from: pos, insert: '\n\n---\n\n' } });
  return true;
}

export function insertLink(view: V): boolean {
  view.dispatch(
    view.state.changeByRange((r) => {
      const text = view.state.sliceDoc(r.from, r.to) || 'link text';
      const insert = `[${text}](https://)`;
      const urlStart = r.from + text.length + 3;
      return { changes: { from: r.from, to: r.to, insert }, range: EditorSelection.range(urlStart, urlStart + 8) };
    }),
  );
  return true;
}
