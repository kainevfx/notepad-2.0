// The TipTap setup behind the Visual (WYSIWYG) Markdown view.
import { Editor, type AnyExtension } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { Markdown } from '@tiptap/markdown';
import { TaskList, TaskItem } from '@tiptap/extension-list';
import { Table, TableRow, TableHeader, TableCell, renderTableToMarkdown } from '@tiptap/extension-table';
import { Placeholder } from '@tiptap/extensions';
import { markExtensions } from './marks';
import { alignExtensions } from './align';
import { lockedExtensions } from './locked';

export function visualExtensions(opts: { placeholder?: string } = {}): AnyExtension[] {
  return [
    // Locked content first so its tokenizers win over code blocks, rules and raw HTML.
    ...lockedExtensions,
    StarterKit.configure({
      underline: false,
      paragraph: false,
      heading: false,
      link: { openOnClick: false, autolink: true },
    }),
    ...alignExtensions,
    ...markExtensions,
    TaskList,
    TaskItem.configure({ nested: true }),
    // The stock renderer pads the table with extra blank lines; the block separator already adds them.
    Table.extend({ renderMarkdown: (node: any, h: any) => renderTableToMarkdown(node, h).replace(/^\n+|\n+$/g, '') } as any).configure({ resizable: false }),
    TableRow,
    TableHeader,
    TableCell,
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
}
