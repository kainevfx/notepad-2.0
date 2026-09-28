// The TipTap setup behind the Visual (WYSIWYG) Markdown view.
import { Editor, Extension, type AnyExtension } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import CodeBlock from '@tiptap/extension-code-block';
import { EditorState } from '@tiptap/pm/state';
import { Markdown } from '@tiptap/markdown';
import { TaskList, TaskItem } from '@tiptap/extension-list';
import { Table, TableRow, TableHeader, TableCell, renderTableToMarkdown } from '@tiptap/extension-table';
import { Placeholder } from '@tiptap/extensions';
import { markExtensions } from './marks';
import { alignExtensions } from './align';
import { lockedExtensions } from './locked';

/** Indent/outdent list items with Ctrl+] / Ctrl+[, and Ctrl+K opens the toolbar's link dialog. */
const ExtraKeys = Extension.create({
  name: 'np2Keys',
  addKeyboardShortcuts() {
    const e = () => this.editor.commands;
    return {
      'Mod-]': () => e().sinkListItem('listItem') || e().sinkListItem('taskItem'),
      'Mod-[': () => e().liftListItem('listItem') || e().liftListItem('taskItem'),
      'Mod-k': () => {
        window.dispatchEvent(new Event('np2-link'));
        return true;
      },
    };
  },
});

/** Code blocks: the fence is always longer than any run of backticks inside, so nested fences survive. */
const SafeFenceCodeBlock = CodeBlock.extend({
  renderMarkdown: (node: any, h: any) => {
    const body = node.content ? h.renderChildren(node.content) : '';
    const longest = Math.max(2, ...(body.match(/`+/g) ?? []).map((r: string) => r.length));
    const fence = '`'.repeat(longest + 1);
    return `${fence}${node.attrs?.language ?? ''}\n${body}\n${fence}`;
  },
} as any);

export function visualExtensions(opts: { placeholder?: string } = {}): AnyExtension[] {
  return [
    // Locked content first so its tokenizers win over code blocks, rules and raw HTML.
    ...lockedExtensions,
    StarterKit.configure({
      underline: false,
      paragraph: false,
      heading: false,
      codeBlock: false,
      link: { openOnClick: false, autolink: true },
    }),
    ...alignExtensions,
    SafeFenceCodeBlock,
    ...markExtensions,
    TaskList,
    TaskItem.configure({ nested: true }),
    // The stock renderer pads the table with extra blank lines; the block separator already adds them.
    // Cell text comes back from the parser with \| unescaped, so escape pipes again when writing.
    Table.extend({
      renderMarkdown: (node: any, h: any) => {
        const cells = { ...h, renderChildren: (n: any, sep?: any) => h.renderChildren(n, sep).replace(/(?<!\\)\|/g, '\\|') };
        return renderTableToMarkdown(node, cells).replace(/^\n+|\n+$/g, '');
      },
    } as any).configure({ resizable: false }),
    TableRow,
    TableHeader,
    TableCell,
    ExtraKeys,
    Placeholder.configure({ placeholder: opts.placeholder ?? 'Start typing…' }),
    Markdown.configure({ indentation: { style: 'space', size: 2 }, markedOptions: { gfm: true, breaks: false } }),
  ];
}

export function parseMarkdownToEditor(editor: Editor, md: string) {
  editor.commands.setContent(md, { contentType: 'markdown', emitUpdate: false } as any);
}

export function editorToMarkdown(editor: Editor): string {
  return (editor as any).getMarkdown();
}

/**
 * Create the Visual editor. `onDocEdited` fires only for transactions that change the document,
 * never for loading text or toggling read-only (TipTap emits "update" for those too).
 */
export function mountVisualEditor(element: HTMLElement, onDocEdited: () => void): Editor {
  return new Editor({
    element,
    extensions: visualExtensions(),
    editorProps: { attributes: { class: 'markdown-body', spellcheck: 'false' } },
    onUpdate: ({ transaction }) => {
      if (transaction.docChanged) onDocEdited();
    },
  });
}

/** Show `md` in the editor without it counting as an edit. */
export function loadIntoEditor(editor: Editor, md: string, editable: boolean) {
  editor.setEditable(editable, false);
  parseMarkdownToEditor(editor, md);
  // Start a fresh state so the load isn't in the undo history: Ctrl+Z can never empty the file or
  // bring back another tab's text.
  const s = editor.state;
  editor.view.updateState(EditorState.create({ doc: s.doc, schema: s.schema, plugins: s.plugins }));
}
