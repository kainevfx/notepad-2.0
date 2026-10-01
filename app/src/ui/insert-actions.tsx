// Insert and Help menu actions. They work in every view: Visual (TipTap), Source / Split and
// plain text (CodeMirror).
import { activeDoc, getView, displayTitle , activeView } from '../state/app';
import { ask, alertMsg, guideOpen } from '../state/ui';
import { visualApi } from '../editor/visual/sync';
import { insertSnippet, imageMarkdown } from '../editor/insert';
import { targetFor } from '../editor/format';
import { platform } from '../platform';
import type { MenuItem } from '../state/ui';

const inVisual = () => {
  const d = activeDoc.value;
  return !!d && d.language === 'markdown' && activeView(d) === 'visual' && !!visualApi.editor;
};

/** Put text at the cursor in the source / plain-text editor. */
function insertText(text: string) {
  const v = getView();
  if (!v || v.state.readOnly) return;
  v.dispatch(v.state.replaceSelection(text));
  v.focus();
}

export function insertPageBreak() {
  const d = activeDoc.value;
  if (!d || d.readonly) return;
  if (inVisual()) {
    visualApi.editor!.chain().focus().insertContent({ type: 'lockedBlock', attrs: { raw: '<div class="page-break"></div>', kind: 'html' } }).run();
  } else insertText(insertSnippet('pageBreak', d.language === 'markdown'));
}

export function insertLineBreak() {
  const d = activeDoc.value;
  if (!d || d.readonly) return;
  if (inVisual()) visualApi.editor!.chain().focus().setHardBreak().run();
  else insertText(insertSnippet('lineBreak', d.language === 'markdown'));
}

export async function insertImage() {
  const d = activeDoc.value;
  if (!d || d.readonly || d.language !== 'markdown') return;
  const path = await platform.openImageDialog();
  if (!path) return;
  const md = imageMarkdown(d.path, path);
  if (inVisual()) visualApi.editor!.chain().focus().insertContent({ type: 'lockedInline', attrs: { raw: md, kind: 'image' } }).run();
  else insertText(md);
}

export function insertTableOf(rows: number, cols: number) {
  targetFor(activeDoc.value).run('table', [rows, cols]);
}

async function insertTableCustom() {
  const r = await ask({
    title: 'Insert table',
    body: 'Rows × columns, for example 3x4.',
    buttons: [{ label: 'Insert', value: 'ok', primary: true }, { label: 'Cancel', value: 'cancel' }],
    input: { value: '3x3', select: true },
  });
  const m = r.value === 'ok' ? /^\s*(\d{1,2})\s*[x×*,]\s*(\d{1,2})\s*$/i.exec(r.input ?? '') : null;
  if (m) insertTableOf(Math.max(1, Number(m[1])), Math.max(1, Number(m[2])));
}

function insertDateTime() {
  const now = new Date();
  const s = `${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} ${now.toLocaleDateString()}`;
  if (inVisual()) visualApi.editor!.chain().focus().insertContent(s).run();
  else insertText(s);
}

export function insertMenu(): MenuItem[] {
  const d = activeDoc.value;
  const md = d?.language === 'markdown';
  const t = targetFor(d);
  const mdOnly = !d || !md || d.readonly;
  const hint = md ? '' : ' (Markdown files)';
  return [
    { label: 'Page break', action: insertPageBreak, disabled: !d || d.readonly },
    { label: 'Line break', action: insertLineBreak, disabled: !d || d.readonly },
    { separator: true },
    { label: `Image…${hint}`, action: () => void insertImage(), disabled: mdOnly },
    {
      label: `Table${hint}`,
      disabled: !t.can('table'),
      submenu: [
        ...([[2, 2], [3, 3], [4, 4], [5, 3], [8, 4]] as [number, number][]).map(([r, c]) => ({ label: `${r} rows × ${c} columns`, action: () => insertTableOf(r, c) })),
        { separator: true },
        { label: 'Custom size…', action: () => void insertTableCustom() },
      ],
    },
    { label: `Link…${hint}`, shortcut: 'Ctrl+K', action: () => t.run('link'), disabled: !t.can('link') },
    { label: `Horizontal line${hint}`, action: () => t.run('rule'), disabled: !t.can('rule') },
    { separator: true },
    { label: 'Date / time', shortcut: 'F5', action: insertDateTime, disabled: !d || d.readonly },
  ];
}

const SHORTCUTS: [string, string][] = [
  ['New text file / New MD file', 'Ctrl+N / Ctrl+Alt+N'],
  ['Open / Save / Save as', 'Ctrl+O / Ctrl+S / Ctrl+Shift+S'],
  ['Close tab', 'Ctrl+W'],
  ['Rename file', 'F2'],
  ['Find / Replace / Go to line', 'Ctrl+F / Ctrl+H / Ctrl+G'],
  ['Bold / Italic / Underline', 'Ctrl+B / Ctrl+I / Ctrl+U'],
  ['Strikethrough', 'Ctrl+Shift+X'],
  ['Heading 1–3 / Body', 'Ctrl+Alt+1–3 / Ctrl+Alt+0'],
  ['Bulleted / Numbered list', 'Ctrl+Shift+8 / Ctrl+Shift+7'],
  ['Indent / Outdent', 'Ctrl+] / Ctrl+['],
  ['Link', 'Ctrl+K'],
  ['Visual → Source → Split', 'Ctrl+Shift+V'],
  ['Text zoom', 'Ctrl + / Ctrl − / Ctrl+0'],
  ['Interface size', 'Shift + / Shift − (outside the text), Ctrl+Shift + / −'],
  ['Tabs on top / on the left', 'Ctrl+Shift+,'],
  ['New file group from this file', 'Ctrl+Shift+G'],
  ['TrayNote', 'Win+Alt+N'],
  ['Time / date', 'F5'],
];

export function helpMenu(): MenuItem[] {
  return [
    { label: 'Run startup guide', action: () => (guideOpen.value = true) },
    {
      label: 'Keyboard shortcuts',
      action: () =>
        void ask({
          title: 'Keyboard shortcuts',
          body: (
            <table class="shortcut-table">
              {SHORTCUTS.map(([what, keys]) => (
                <tr>
                  <td>{what}</td>
                  <td>
                    <kbd>{keys}</kbd>
                  </td>
                </tr>
              ))}
            </table>
          ),
          buttons: [{ label: 'Close', value: 'ok', primary: true }],
        }),
    },
    { separator: true },
    {
      label: 'About Notepad 2.0',
      action: () => void alertMsg('About Notepad 2.0', `Notepad 2.0, version 0.1.0.${activeDoc.value ? `\n\nOpen: ${displayTitle(activeDoc.value)}` : ''}`),
    },
  ];
}
