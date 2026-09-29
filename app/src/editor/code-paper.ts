// "Code" paper: a line number on every line of the page, continuing below the last line of text,
// like a code editor or ruled pad. The extra numbers are drawn by a block widget after the text
// (never part of the document) and its gutter marker.
import { StateEffect, StateField, type Extension } from '@codemirror/state';
import { Decoration, EditorView, GutterMarker, ViewPlugin, WidgetType, gutter, type DecorationSet } from '@codemirror/view';

/** How many numbered rows are needed below `contentPx` of text to fill `viewportPx`. */
export function fillerCount(viewportPx: number, contentPx: number, lineHeightPx: number): number {
  if (!(lineHeightPx > 0) || !(viewportPx > contentPx)) return 0;
  return Math.ceil((viewportPx - contentPx) / lineHeightPx);
}

class FillerWidget extends WidgetType {
  constructor(readonly rows: number) {
    super();
  }
  eq(other: FillerWidget) {
    return other.rows === this.rows;
  }
  toDOM() {
    const el = document.createElement('div');
    el.className = 'cm-code-filler';
    el.style.height = `calc(var(--lh) * ${this.rows})`;
    el.setAttribute('aria-hidden', 'true');
    return el;
  }
  get estimatedHeight() {
    return -1;
  }
  ignoreEvent() {
    return false;
  }
}

class NumberMarker extends GutterMarker {
  constructor(readonly n: number) {
    super();
  }
  eq(other: NumberMarker) {
    return other.n === this.n;
  }
  toDOM() {
    return document.createTextNode(String(this.n));
  }
}

class FillerMarker extends GutterMarker {
  constructor(readonly from: number, readonly rows: number) {
    super();
  }
  eq(other: FillerMarker) {
    return other.from === this.from && other.rows === this.rows;
  }
  toDOM() {
    const box = document.createElement('div');
    for (let i = 0; i < this.rows; i++) {
      const row = document.createElement('div');
      row.className = 'cm-code-filler-num';
      row.textContent = String(this.from + i);
      box.appendChild(row);
    }
    return box;
  }
}

const setRows = StateEffect.define<number>();

const rowsField = StateField.define<number>({
  create: () => 0,
  update: (v, tr) => tr.effects.reduce((acc, e) => (e.is(setRows) ? e.value : acc), v),
});

const fillerDecorations = EditorView.decorations.compute([rowsField, 'doc'], (state): DecorationSet => {
  const rows = state.field(rowsField);
  if (!rows) return Decoration.none;
  return Decoration.set([Decoration.widget({ widget: new FillerWidget(rows), block: true, side: 1 }).range(state.doc.length)]);
});

/** Re-measures how many filler rows the page needs after every layout change. */
const measure = ViewPlugin.fromClass(
  class {
    constructor(view: EditorView) {
      this.schedule(view);
    }
    update(u: { view: EditorView; geometryChanged: boolean; docChanged: boolean; heightChanged: boolean }) {
      if (u.geometryChanged || u.docChanged || u.heightChanged) this.schedule(u.view);
    }
    schedule(view: EditorView) {
      view.requestMeasure({
        read: (v) => {
          const lastLine = v.lineBlockAt(v.state.doc.length);
          const textBottom = lastLine.bottom + v.documentPadding.top;
          return fillerCount(v.scrollDOM.clientHeight, textBottom, v.defaultLineHeight);
        },
        // A view can't be updated from inside its measure phase, so apply the change just after.
        write: (rows, v) => {
          if (rows === v.state.field(rowsField, false)) return;
          setTimeout(() => {
            if (!v.dom.isConnected || rows === v.state.field(rowsField, false)) return;
            v.dispatch({ effects: setRows.of(rows) });
          }, 0);
        },
      });
    }
  },
);

const codeGutter = gutter({
  class: 'cm-lineNumbers cm-code-numbers',
  lineMarker: (view, line) => new NumberMarker(view.state.doc.lineAt(line.from).number),
  lineMarkerChange: (u) => u.docChanged,
  widgetMarker: (view, widget) => (widget instanceof FillerWidget ? new FillerMarker(view.state.doc.lines + 1, widget.rows) : null),
  initialSpacer: (view) => new NumberMarker(Math.max(99, view.state.doc.lines + 40)),
});

export function codePaper(): Extension {
  return [rowsField, fillerDecorations, measure, codeGutter];
}
