// Log files: colour each line by its level (ERROR red, WARN amber, INFO/DEBUG muted) and dim a
// leading timestamp. Whole words only, so "errors=0" stays plain.
import { Decoration, ViewPlugin, type DecorationSet, type EditorView, type ViewUpdate } from '@codemirror/view';
import { RangeSetBuilder, type Extension } from '@codemirror/state';

export function logLineClass(line: string): 'error' | 'warn' | 'info' | 'debug' | null {
  if (/\b(ERROR|FATAL|CRITICAL|SEVERE)\b/i.test(line)) return 'error';
  if (/\b(WARN|WARNING)\b/i.test(line)) return 'warn';
  if (/\bINFO\b/i.test(line)) return 'info';
  if (/\b(DEBUG|TRACE|VERBOSE)\b/i.test(line)) return 'debug';
  return null;
}

const TIME = /^\s*\[?\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2})?[^\]\s]*\]?/;
const lineDeco: Record<string, Decoration> = {};
const timeDeco = Decoration.mark({ class: 'log-time' });

function build(view: EditorView): DecorationSet {
  const b = new RangeSetBuilder<Decoration>();
  for (const { from, to } of view.visibleRanges) {
    for (let pos = from; pos <= to; ) {
      const line = view.state.doc.lineAt(pos);
      const cls = logLineClass(line.text);
      if (cls) b.add(line.from, line.from, (lineDeco[cls] ??= Decoration.line({ class: `log-${cls}` })));
      const t = TIME.exec(line.text);
      if (t && t[0].trim()) b.add(line.from, line.from + t[0].length, timeDeco);
      pos = line.to + 1;
    }
  }
  return b.finish();
}

export function logHighlighter(): Extension {
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;
      constructor(view: EditorView) {
        this.decorations = build(view);
      }
      update(u: ViewUpdate) {
        if (u.docChanged || u.viewportChanged) this.decorations = build(u.view);
      }
    },
    { decorations: (v) => v.decorations },
  );
}
