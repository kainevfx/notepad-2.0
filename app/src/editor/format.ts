// One formatting toolbar, three targets:
//   Visual view  -> TipTap commands
//   Source/Split -> Markdown (and small HTML) syntax inserted in CodeMirror
//   Plain text   -> only what plain text can hold (wrap, indent, display font size/weight)
import type { DocMeta } from '../state/app';
import { getView, refreshView, activeDoc, activeView } from '../state/app';
import { platform } from '../platform';
import { relativeLink } from '../lib/link-target';
import { settings, updateSettings } from '../state/settings';
import { ask } from '../state/ui';
import { visualApi } from './visual/sync';
import * as C from './md-commands';

export type FormatCommand =
  | 'bold' | 'italic' | 'underline' | 'strike' | 'code'
  | 'color' | 'fontSize' | 'fontWeight'
  | 'body' | 'h1' | 'h2' | 'h3' | 'quote' | 'codeBlock'
  | 'alignLeft' | 'alignCenter' | 'alignRight' | 'alignJustify'
  | 'bullet' | 'number' | 'check' | 'indent' | 'outdent'
  | 'link' | 'table' | 'rule' | 'wrap';

export interface FormatTarget {
  can(c: FormatCommand): boolean;
  isActive(c: FormatCommand): boolean;
  run(c: FormatCommand, arg?: unknown): void;
}

export const PLAIN_ALLOWED: ReadonlySet<FormatCommand> = new Set<FormatCommand>(['wrap', 'indent', 'outdent', 'fontSize', 'fontWeight']);

function toggleWrapSetting() {
  updateSettings({ wordWrap: !settings.value.wordWrap });
  refreshView();
}

/** The link dialog: type an address, or Browse for a file or folder (written relative to the document). */
async function askLink(current: string): Promise<string | null> {
  for (let value = current; ; ) {
    const r = await ask({
      title: 'Link',
      buttons: [
        { label: 'OK', value: 'ok', primary: true },
        { label: 'File…', value: 'file' },
        { label: 'Folder…', value: 'folder' },
        { label: 'Cancel', value: 'cancel' },
      ],
      input: { value, label: 'Address, file or folder (leave empty to remove the link)', select: true },
    });
    if (r.value !== 'file' && r.value !== 'folder') return r.value === 'ok' ? (r.input ?? '').trim() : null;
    const picked = await platform.pickPath(r.value);
    value = picked ? relativeLink(picked, activeDoc.value?.path ?? null, r.value === 'folder') : r.input ?? value;
  }
}

export const plainTarget: FormatTarget = {
  can: (c) => PLAIN_ALLOWED.has(c),
  isActive: (c) => c === 'wrap' && settings.value.wordWrap,
  run(c, arg) {
    const v = getView();
    if (c === 'wrap') toggleWrapSetting();
    else if (c === 'fontSize') updateSettings({ fontSize: Number(arg) });
    else if (c === 'fontWeight') updateSettings({ fontWeight: Number(arg) });
    else if (v && c === 'indent') C.indentLines(v, 1);
    else if (v && c === 'outdent') C.indentLines(v, -1);
    v?.focus();
  },
};

export const sourceTarget: FormatTarget = {
  can: () => !!getView(),
  isActive: (c) => c === 'wrap' && settings.value.wordWrap,
  run(c, arg) {
    const v = getView();
    if (c === 'wrap') return toggleWrapSetting();
    if (!v) return;
    const s = String(arg ?? '');
    switch (c) {
      case 'bold': C.toggleWrap(v, '**', '**', 'bold'); break;
      case 'italic': C.toggleWrap(v, '*', '*', 'italic'); break;
      case 'underline': C.toggleWrap(v, '<u>', '</u>', 'text'); break;
      case 'strike': C.toggleWrap(v, '~~', '~~', 'text'); break;
      case 'code': C.toggleWrap(v, '`', '`', 'code'); break;
      case 'color': C.wrapSpanStyle(v, 'color', s); break;
      case 'fontSize': C.wrapSpanStyle(v, 'font-size', `${s}px`); break;
      case 'fontWeight': C.wrapSpanStyle(v, 'font-weight', s); break;
      case 'body': case 'h1': case 'h2': case 'h3': case 'quote': C.setBlockType(v, c); break;
      case 'codeBlock': C.setBlockType(v, 'code'); break;
      case 'alignLeft': C.setAlign(v, 'left'); break;
      case 'alignCenter': C.setAlign(v, 'center'); break;
      case 'alignRight': C.setAlign(v, 'right'); break;
      case 'alignJustify': C.setAlign(v, 'justify'); break;
      case 'bullet': case 'number': case 'check': C.toggleList(v, c); break;
      case 'indent': C.indentLines(v, 1); break;
      case 'outdent': C.indentLines(v, -1); break;
      case 'link': C.insertLink(v); break;
      case 'table': {
        const [r, k] = (arg as [number, number] | undefined) ?? [2, 2];
        C.insertTable(v, r, k);
        break;
      }
      case 'rule': C.insertRule(v); break;
    }
    v.focus();
  },
};

export const visualTarget: FormatTarget = {
  can: () => !!visualApi.editor?.isEditable,
  isActive(c) {
    const e = visualApi.editor;
    if (!e) return false;
    const aligned = (a: string) => e.isActive({ textAlign: a });
    switch (c) {
      case 'bold': return e.isActive('bold');
      case 'italic': return e.isActive('italic');
      case 'underline': return e.isActive('underline');
      case 'strike': return e.isActive('strike');
      case 'code': return e.isActive('code');
      case 'h1': case 'h2': case 'h3': return e.isActive('heading', { level: Number(c[1]) });
      case 'quote': return e.isActive('blockquote');
      case 'codeBlock': return e.isActive('codeBlock');
      case 'body': return e.isActive('paragraph') && !e.isActive('blockquote') && !e.isActive('heading');
      case 'alignCenter': return aligned('center');
      case 'alignRight': return aligned('right');
      case 'alignJustify': return aligned('justify');
      case 'alignLeft': return !aligned('center') && !aligned('right') && !aligned('justify');
      case 'bullet': return e.isActive('bulletList');
      case 'number': return e.isActive('orderedList');
      case 'check': return e.isActive('taskList');
      case 'link': return e.isActive('link');
      case 'wrap': return settings.value.wordWrap;
      default: return false;
    }
  },
  run(c, arg) {
    const e = visualApi.editor;
    if (c === 'wrap') return toggleWrapSetting();
    if (!e) return;
    const ch = e.chain().focus() as any;
    const s = String(arg ?? '');
    const listItem = e.isActive('taskItem') ? 'taskItem' : 'listItem';
    switch (c) {
      case 'bold': ch.toggleBold(); break;
      case 'italic': ch.toggleItalic(); break;
      case 'underline': ch.toggleUnderline(); break;
      case 'strike': ch.toggleStrike(); break;
      case 'code': ch.toggleCode(); break;
      case 'color': s ? ch.setColor(s) : ch.unsetColor(); break;
      case 'fontSize': ch.setFontSize(`${s}px`); break;
      case 'fontWeight': ch.setMark('textStyle', { fontWeight: s === '400' ? null : s }).removeEmptyTextStyle(); break;
      case 'body': ch.setParagraph(); break;
      case 'h1': case 'h2': case 'h3': ch.toggleHeading({ level: Number(c[1]) }); break;
      case 'quote': ch.toggleBlockquote(); break;
      case 'codeBlock': ch.toggleCodeBlock(); break;
      case 'alignLeft': ch.unsetTextAlign(); break;
      case 'alignCenter': ch.setTextAlign('center'); break;
      case 'alignRight': ch.setTextAlign('right'); break;
      case 'alignJustify': ch.setTextAlign('justify'); break;
      case 'bullet': ch.toggleBulletList(); break;
      case 'number': ch.toggleOrderedList(); break;
      case 'check': ch.toggleTaskList(); break;
      case 'indent': ch.sinkListItem(listItem); break;
      case 'outdent': ch.liftListItem(listItem); break;
      case 'link': {
        void askLink(e.getAttributes('link').href ?? 'https://').then((url) => {
          if (url === null) return;
          const c2 = e.chain().focus().extendMarkRange('link') as any;
          (url ? c2.setLink({ href: url }) : c2.unsetLink()).run();
        });
        return;
      }
      case 'table': {
        const [r, k] = (arg as [number, number] | undefined) ?? [2, 2];
        ch.insertTable({ rows: r + 1, cols: k, withHeaderRow: true });
        break;
      }
      case 'rule': ch.setHorizontalRule(); break;
    }
    ch.run();
  },
};

/** Read-only tabs: nothing that changes the text, only the word-wrap view setting. */
export const readonlyTarget: FormatTarget = {
  can: (c) => c === 'wrap',
  isActive: (c) => c === 'wrap' && settings.value.wordWrap,
  run: (c) => {
    if (c === 'wrap') toggleWrapSetting();
  },
};

export function targetFor(d: DocMeta | null): FormatTarget {
  if (d?.readonly) return readonlyTarget;
  if (!d || d.language !== 'markdown') return plainTarget;
  return activeView(d) === 'visual' ? visualTarget : sourceTarget;
}
