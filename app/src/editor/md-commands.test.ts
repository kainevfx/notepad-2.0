import { describe, it, expect } from 'vitest';
import { EditorState, EditorSelection } from '@codemirror/state';
import * as C from './md-commands';

// Minimal stand-in for an EditorView: the commands only use state + dispatch.
function run(doc: string, from: number, to: number, fn: (v: any) => boolean) {
  let state = EditorState.create({ doc, selection: EditorSelection.single(from, to), extensions: EditorState.allowMultipleSelections.of(true) });
  const v: any = {
    get state() {
      return state;
    },
    dispatch: (tr: any) => {
      state = state.update(tr).state;
    },
  };
  fn(v);
  return { text: state.doc.toString(), sel: state.selection.main };
}

describe('md-commands', () => {
  it('bold wraps and unwraps', () => {
    expect(run('a word b', 2, 6, (v) => C.toggleWrap(v, '**', '**', 'bold')).text).toBe('a **word** b');
    expect(run('a **word** b', 4, 8, (v) => C.toggleWrap(v, '**', '**', 'bold')).text).toBe('a word b');
  });
  it('bold on an empty selection inserts a selected placeholder', () => {
    const r = run('', 0, 0, (v) => C.toggleWrap(v, '**', '**', 'bold'));
    expect(r.text).toBe('**bold**');
    expect([r.sel.from, r.sel.to]).toEqual([2, 6]);
  });
  it('underline uses <u>', () => expect(run('x', 0, 1, (v) => C.toggleWrap(v, '<u>', '</u>', 'text')).text).toBe('<u>x</u>'));
  it('heading replaces existing heading marks', () => {
    expect(run('## Title', 3, 3, (v) => C.setBlockType(v, 'h1')).text).toBe('# Title');
    expect(run('# Title', 3, 3, (v) => C.setBlockType(v, 'body')).text).toBe('Title');
    expect(run('Title', 0, 0, (v) => C.setBlockType(v, 'quote')).text).toBe('> Title');
  });
  it('code block fences the selected lines', () => expect(run('a\nb', 0, 3, (v) => C.setBlockType(v, 'code')).text).toBe('```\na\nb\n```'));
  it('bullet list toggles on every selected line', () => {
    expect(run('a\nb', 0, 3, (v) => C.toggleList(v, 'bullet')).text).toBe('- a\n- b');
    expect(run('- a\n- b', 0, 7, (v) => C.toggleList(v, 'bullet')).text).toBe('a\nb');
  });
  it('switching list kind replaces the marker', () => expect(run('- a', 0, 0, (v) => C.toggleList(v, 'number')).text).toBe('1. a'));
  it('numbered list numbers lines', () => expect(run('a\nb', 0, 3, (v) => C.toggleList(v, 'number')).text).toBe('1. a\n2. b'));
  it('checklist', () => expect(run('a', 0, 0, (v) => C.toggleList(v, 'check')).text).toBe('- [ ] a'));
  it('indent adds two spaces to list lines and a tab otherwise; outdent removes', () => {
    expect(run('- a', 0, 0, (v) => C.indentLines(v, 1)).text).toBe('  - a');
    expect(run('  - a', 0, 0, (v) => C.indentLines(v, -1)).text).toBe('- a');
    expect(run('a', 0, 0, (v) => C.indentLines(v, 1)).text).toBe('\ta');
    expect(run('\ta', 0, 0, (v) => C.indentLines(v, -1)).text).toBe('a');
  });
  it('colour wraps a span', () => expect(run('hi', 0, 2, (v) => C.wrapSpanStyle(v, 'color', '#ff0000')).text).toBe('<span style="color:#ff0000">hi</span>'));
  it('align centre wraps the paragraph', () => expect(run('hi', 0, 0, (v) => C.setAlign(v, 'center')).text).toBe('<p align="center">hi</p>'));
  it('align a heading keeps its level', () => expect(run('## T', 0, 0, (v) => C.setAlign(v, 'right')).text).toBe('<h2 align="right">T</h2>'));
  it('align left unwraps', () => {
    expect(run('<p align="center">hi</p>', 20, 20, (v) => C.setAlign(v, 'left')).text).toBe('hi');
    expect(run('<h2 align="right">T</h2>', 5, 5, (v) => C.setAlign(v, 'left')).text).toBe('## T');
  });
  it('table 2x2', () => expect(run('', 0, 0, (v) => C.insertTable(v, 2, 2)).text).toBe('| Column 1 | Column 2 |\n| --- | --- |\n|  |  |\n|  |  |\n'));
  it('table after text starts on a new block', () => expect(run('x', 1, 1, (v) => C.insertTable(v, 1, 1)).text).toBe('x\n\n| Column 1 |\n| --- |\n|  |\n'));
  it('link selects the URL placeholder', () => {
    const r = run('site', 0, 4, (v) => C.insertLink(v));
    expect(r.text).toBe('[site](https://)');
    expect(r.text.slice(r.sel.from, r.sel.to)).toBe('https://');
  });
});
