import { EditorState, Compartment, Extension, EditorSelection, Prec } from '@codemirror/state';
import {
  EditorView, keymap, lineNumbers, drawSelection, dropCursor, highlightSpecialChars, rectangularSelection,
  crosshairCursor, ViewUpdate, highlightActiveLineGutter,
} from '@codemirror/view';
import { history, historyKeymap, defaultKeymap, insertTab, indentLess } from '@codemirror/commands';
import { searchKeymap, highlightSelectionMatches, search } from '@codemirror/search';
import { markdown, markdownLanguage, markdownKeymap } from '@codemirror/lang-markdown';
import { languages } from '@codemirror/language-data';
import { HighlightStyle, syntaxHighlighting, indentUnit } from '@codemirror/language';
import { tags as t } from '@lezer/highlight';
import type { Settings, PaperMode } from '../state/settings';

export const cNumbers = new Compartment();
export const cWrap = new Compartment();
export const cLang = new Compartment();
export const cAttrs = new Compartment();
export const cReadOnly = new Compartment();

// Notepad keeps Ctrl+G for Go to line and Ctrl+H for Replace, so drop CodeMirror's bindings
// that collide (Mod-g find next, Mod-Alt-g goto, Mod-d select next).
const BLOCKED = new Set(['Mod-g', 'Shift-Mod-g', 'Mod-Alt-g', 'Mod-d', 'Mod-Shift-l', 'Mod-f']);
const filteredSearchKeymap = searchKeymap.filter((b) => !BLOCKED.has(b.key ?? ''));

const mdHighlight = HighlightStyle.define([
  { tag: t.heading1, fontWeight: '700', fontSize: '1.3em' },
  { tag: t.heading2, fontWeight: '700', fontSize: '1.18em' },
  { tag: t.heading3, fontWeight: '700', fontSize: '1.08em' },
  { tag: [t.heading4, t.heading5, t.heading6], fontWeight: '700' },
  { tag: t.strong, fontWeight: '700' },
  { tag: t.emphasis, fontStyle: 'italic' },
  { tag: t.strikethrough, textDecoration: 'line-through' },
  { tag: [t.processingInstruction, t.meta], color: 'var(--md-marker)' },
  { tag: [t.link, t.url], color: 'var(--accent-text)' },
  { tag: t.monospace, fontFamily: 'Consolas, "Cascadia Mono", monospace', color: 'var(--md-code)' },
  { tag: t.quote, color: 'var(--md-quote)', fontStyle: 'italic' },
  { tag: t.contentSeparator, color: 'var(--md-marker)' },
  { tag: [t.keyword, t.operatorKeyword], color: 'var(--syn-keyword)' },
  { tag: [t.string, t.special(t.string)], color: 'var(--syn-string)' },
  { tag: [t.number, t.bool, t.null], color: 'var(--syn-number)' },
  { tag: [t.comment, t.lineComment, t.blockComment], color: 'var(--syn-comment)', fontStyle: 'italic' },
  { tag: [t.function(t.variableName), t.function(t.propertyName)], color: 'var(--syn-fn)' },
  { tag: [t.typeName, t.className], color: 'var(--syn-type)' },
]);

function wrapWith(marker: string, placeholder: string) {
  return (view: EditorView) => {
    view.dispatch(
      view.state.changeByRange((range) => {
        const text = view.state.sliceDoc(range.from, range.to);
        const before = view.state.sliceDoc(range.from - marker.length, range.from);
        const after = view.state.sliceDoc(range.to, range.to + marker.length);
        if (before === marker && after === marker) {
          return {
            changes: [
              { from: range.from - marker.length, to: range.from, insert: '' },
              { from: range.to, to: range.to + marker.length, insert: '' },
            ],
            range: EditorSelection.range(range.from - marker.length, range.to - marker.length),
          };
        }
        const body = text || placeholder;
        return {
          changes: { from: range.from, to: range.to, insert: marker + body + marker },
          range: EditorSelection.range(range.from + marker.length, range.from + marker.length + body.length),
        };
      }),
    );
    return true;
  };
}

function insertLink(view: EditorView) {
  view.dispatch(
    view.state.changeByRange((range) => {
      const text = view.state.sliceDoc(range.from, range.to) || 'link text';
      const insert = `[${text}](https://)`;
      const urlStart = range.from + text.length + 3;
      return { changes: { from: range.from, to: range.to, insert }, range: EditorSelection.range(urlStart, urlStart + 8) };
    }),
  );
  return true;
}

export const markdownEditingKeymap = keymap.of([
  { key: 'Mod-b', run: wrapWith('**', 'bold') },
  { key: 'Mod-i', run: wrapWith('*', 'italic') },
  { key: 'Mod-k', run: insertLink },
  ...markdownKeymap,
]);

export function languageExt(isMarkdown: boolean): Extension {
  if (!isMarkdown) return [];
  return [
    markdown({ base: markdownLanguage, codeLanguages: languages, addKeymap: false }),
    syntaxHighlighting(mdHighlight),
    Prec.high(markdownEditingKeymap),
  ];
}

export interface ViewConfig {
  paper: PaperMode;
  settings: Settings;
}

export function lineHeightPx(s: Settings): number {
  const px = (s.fontSize * 96) / 72; // pt -> px
  return Math.round(px * (s.zoom / 100) * 1.36);
}

export function attrsExt({ paper, settings: s }: ViewConfig): Extension {
  const px = ((s.fontSize * 96) / 72) * (s.zoom / 100);
  const lh = lineHeightPx(s);
  const fam = `"${s.fontFamily}", Consolas, "Cascadia Mono", "Courier New", monospace`;
  return [
    EditorView.editorAttributes.of({
      class: `paper-${paper}${s.paperMargin ? ' paper-margin' : ''}`,
      style: `--np-font:${fam};--np-size:${px.toFixed(2)}px;--lh:${lh}px;--np-weight:${s.fontWeight};--np-style:${s.fontStyle}`,
    }),
    EditorView.contentAttributes.of({ spellcheck: s.spellcheck ? 'true' : 'false', autocorrect: 'off', autocapitalize: 'off' }),
  ];
}

export function numbersExt(cfg: ViewConfig): Extension {
  const show = cfg.paper === 'numbers' || (cfg.settings.paperNumbers && cfg.paper !== 'none');
  return show ? [lineNumbers(), highlightActiveLineGutter()] : [];
}

export type UpdateHandler = (u: ViewUpdate) => void;
let updateHandler: UpdateHandler = () => {};
export function setUpdateHandler(h: UpdateHandler) {
  updateHandler = h;
}

export function createEditorState(text: string, isMarkdown: boolean, readOnly: boolean, cfg: ViewConfig): EditorState {
  return EditorState.create({
    doc: text,
    extensions: [
      history(),
      drawSelection(),
      dropCursor(),
      highlightSpecialChars(),
      rectangularSelection(),
      crosshairCursor(),
      highlightSelectionMatches(),
      EditorState.allowMultipleSelections.of(true),
      indentUnit.of('\t'),
      EditorState.tabSize.of(8), // Notepad's tab width
      search({ top: true }),
      keymap.of([
        { key: 'Tab', run: insertTab, shift: indentLess },
        ...filteredSearchKeymap,
        ...historyKeymap,
        ...defaultKeymap,
      ]),
      cNumbers.of(numbersExt(cfg)),
      cWrap.of(cfg.settings.wordWrap ? EditorView.lineWrapping : []),
      cLang.of(languageExt(isMarkdown)),
      cAttrs.of(attrsExt(cfg)),
      cReadOnly.of(EditorState.readOnly.of(readOnly)),
      EditorView.updateListener.of((u) => updateHandler(u)),
    ],
  });
}

/** Bring a (possibly stale) state in line with current settings. */
export function reconfigureEffects(cfg: ViewConfig, isMarkdown: boolean, readOnly: boolean) {
  return [
    cNumbers.reconfigure(numbersExt(cfg)),
    cWrap.reconfigure(cfg.settings.wordWrap ? EditorView.lineWrapping : []),
    cLang.reconfigure(languageExt(isMarkdown)),
    cAttrs.reconfigure(attrsExt(cfg)),
    cReadOnly.reconfigure(EditorState.readOnly.of(readOnly)),
  ];
}
