// Formatting toolbar under the menu bar. Drives whichever target the active tab uses
// (Visual editor, Markdown source, or plain text) through editor/format.ts.
import { useEffect, useState } from 'preact/hooks';
import type { JSX } from 'preact';
import { activeDoc, editTick, convertToMarkdown } from '../state/app';
import { settings } from '../state/settings';
import { targetFor, type FormatCommand } from '../editor/format';
import { visualApi, visualEpoch } from '../editor/visual/sync';
import * as I from './icons';

const SWATCHES = ['#000000', '#5f6368', '#d93025', '#e37400', '#f9ab00', '#188038', '#1a73e8', '#9334e6', '#d01884', '#007b83'];
const SIZES = [8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36, 40];
const STYLE_OPTIONS: [FormatCommand, string][] = [
  ['body', 'Body'],
  ['h1', 'Heading 1'],
  ['h2', 'Heading 2'],
  ['h3', 'Heading 3'],
  ['quote', 'Quote'],
  ['codeBlock', 'Code block'],
];

type Pop = 'color' | 'table' | 'align' | 'list' | null;

const ALIGN: { c: FormatCommand; label: string; Icon: (p: { size?: number }) => JSX.Element }[] = [
  { c: 'alignLeft', label: 'Align left', Icon: I.IcAlignLeft },
  { c: 'alignCenter', label: 'Centre', Icon: I.IcAlignCenter },
  { c: 'alignRight', label: 'Align right', Icon: I.IcAlignRight },
  { c: 'alignJustify', label: 'Justify', Icon: I.IcAlignJustify },
];
const LISTS: { c: FormatCommand; label: string; Icon: (p: { size?: number }) => JSX.Element }[] = [
  { c: 'bullet', label: 'Bulleted list (Ctrl+Shift+8)', Icon: I.IcListBullet },
  { c: 'number', label: 'Numbered list (Ctrl+Shift+7)', Icon: I.IcListNumber },
  { c: 'check', label: 'Checklist', Icon: I.IcListCheck },
];

export function FormatBar() {
  const d = activeDoc.value;
  editTick.value;
  const s = settings.value;
  const [, bump] = useState(0);
  const [pop, setPop] = useState<Pop>(null);
  const [pick, setPick] = useState<[number, number]>([0, 0]);
  visualEpoch.value;
  const editor = visualApi.editor;

  // Re-render on every Visual transaction so pressed states follow the cursor.
  useEffect(() => {
    if (!editor) return;
    const f = () => bump((n) => n + 1);
    editor.on('transaction', f);
    return () => {
      editor.off('transaction', f);
    };
  }, [editor, d?.id, d?.mdView]);

  // Visual editor's Ctrl+K asks here so it uses the same link dialog.
  useEffect(() => {
    const onLink = () => targetFor(activeDoc.value).run('link');
    window.addEventListener('np2-link', onLink);
    return () => window.removeEventListener('np2-link', onLink);
  }, []);

  useEffect(() => {
    if (!pop) return;
    const close = (e: PointerEvent) => !(e.target as HTMLElement).closest('.fb-pop-anchor') && setPop(null);
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setPop(null);
    window.addEventListener('pointerdown', close);
    window.addEventListener('keydown', esc);
    return () => {
      window.removeEventListener('pointerdown', close);
      window.removeEventListener('keydown', esc);
    };
  }, [pop]);

  const t = targetFor(d);
  const md = d?.language === 'markdown';
  const keep = (e: Event) => e.preventDefault(); // keep the editor's selection when clicking the bar

  const B = ({ c, icon, label, arg }: { c: FormatCommand; icon: JSX.Element; label: string; arg?: unknown }) => (
    <button
      class={`fb-btn${t.isActive(c) ? ' on' : ''}`}
      disabled={!t.can(c)}
      title={label}
      aria-label={label}
      aria-pressed={t.isActive(c)}
      onMouseDown={keep}
      onClick={() => t.run(c, arg)}
    >
      {icon}
    </button>
  );

  /** A button showing the current choice; its pop-up lists every option with its name. */
  const Menu = ({ kind, title, items, fallback }: { kind: Pop; title: string; items: typeof ALIGN; fallback: (typeof ALIGN)[number] }) => {
    const cur = items.find((it) => t.isActive(it.c)) ?? fallback;
    const on = kind === 'list' && items.some((it) => t.isActive(it.c));
    const enabled = items.some((it) => t.can(it.c));
    return (
      <div class="fb-pop-anchor">
        <button class={`fb-btn fb-drop${pop === kind || on ? ' on' : ''}`} disabled={!enabled} title={title} aria-label={title} aria-haspopup="menu" onMouseDown={keep} onClick={() => setPop(pop === kind ? null : kind)}>
          <cur.Icon />
          <I.IcChevronDown size={10} />
        </button>
        {pop === kind && (
          <div class="fb-pop fb-menu" role="menu" onMouseDown={keep}>
            {items.map((it) => (
              <button class={`fb-menu-item${t.isActive(it.c) ? ' on' : ''}`} role="menuitem" disabled={!t.can(it.c)} onClick={() => (t.run(it.c), setPop(null))}>
                <it.Icon />
                <span>{it.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  };

  const blockValue = STYLE_OPTIONS.map(([c]) => c).find((c) => c !== 'body' && t.isActive(c)) ?? 'body';

  return (
    <div class="formatbar" role="toolbar" aria-label="Formatting">
      <select
        class="fb-select fb-style"
        disabled={!t.can('h1')}
        value={blockValue}
        title="Paragraph style"
        onChange={(e) => t.run((e.target as HTMLSelectElement).value as FormatCommand)}
      >
        {STYLE_OPTIONS.map(([c, label]) => (
          <option value={c}>{label}</option>
        ))}
      </select>
      <span class="fb-sep" />
      <select
        class="fb-select fb-narrow"
        disabled={!t.can('fontSize')}
        title={md ? 'Font size of the selected text' : 'Font size (whole document)'}
        value={md ? '' : String(s.fontSize)}
        onChange={(e) => {
          const el = e.target as HTMLSelectElement;
          if (el.value) t.run('fontSize', el.value);
          if (md) el.value = '';
        }}
      >
        {md && <option value="">Size</option>}
        {SIZES.map((n) => (
          <option value={String(n)}>{n}</option>
        ))}
      </select>
      <select
        class="fb-select"
        disabled={!t.can('fontWeight')}
        title={md ? 'Font weight of the selected text' : 'Font weight (whole document)'}
        value={md ? '' : String(s.fontWeight)}
        onChange={(e) => {
          const el = e.target as HTMLSelectElement;
          if (el.value) t.run('fontWeight', el.value);
          if (md) el.value = '';
        }}
      >
        {md && <option value="">Weight</option>}
        <option value="300">Light</option>
        <option value="400">Regular</option>
        <option value="600">Semibold</option>
        <option value="700">Bold</option>
      </select>
      <span class="fb-sep" />
      <B c="bold" icon={<I.IcBold />} label="Bold (Ctrl+B)" />
      <B c="italic" icon={<I.IcItalic />} label="Italic (Ctrl+I)" />
      <B c="underline" icon={<I.IcUnderline />} label="Underline (Ctrl+U)" />
      <B c="strike" icon={<I.IcStrike />} label="Strikethrough (Ctrl+Shift+X)" />
      <div class="fb-pop-anchor">
        <button class={`fb-btn${pop === 'color' ? ' on' : ''}`} disabled={!t.can('color')} title="Font colour" aria-label="Font colour" onMouseDown={keep} onClick={() => setPop(pop === 'color' ? null : 'color')}>
          <I.IcColor />
        </button>
        {pop === 'color' && (
          <div class="fb-pop fb-colors" onMouseDown={keep}>
            {SWATCHES.map((c) => (
              <button class="fb-swatch" style={{ background: c }} title={c} onClick={() => (t.run('color', c), setPop(null))} />
            ))}
            <button class="fb-swatch fb-nocolor" title="Remove colour" onClick={() => (t.run('color', ''), setPop(null))} disabled={!md || d?.mdView !== 'visual'}>
              ✕
            </button>
            <label class="fb-custom" title="Custom colour">
              Custom…
              <input type="color" onChange={(e) => (t.run('color', (e.target as HTMLInputElement).value), setPop(null))} />
            </label>
          </div>
        )}
      </div>
      <B c="code" icon={<I.IcCode />} label="Inline code" />
      <span class="fb-sep" />
      <Menu kind="align" title="Paragraph alignment" items={ALIGN} fallback={ALIGN[0]} />
      <Menu kind="list" title="Lists" items={LISTS} fallback={LISTS[0]} />
      <B c="outdent" icon={<I.IcOutdent />} label="Decrease indent (Ctrl+[)" />
      <B c="indent" icon={<I.IcIndent />} label="Increase indent (Ctrl+])" />
      <span class="fb-sep" />
      <B c="link" icon={<I.IcLink />} label="Link (Ctrl+K)" />
      <div class="fb-pop-anchor">
        <button class={`fb-btn${pop === 'table' ? ' on' : ''}`} disabled={!t.can('table')} title="Insert table" aria-label="Insert table" onMouseDown={keep} onClick={() => (setPick([0, 0]), setPop(pop === 'table' ? null : 'table'))}>
          <I.IcTable />
        </button>
        {pop === 'table' && (
          <div class="fb-pop fb-grid" onMouseDown={keep}>
            {Array.from({ length: 64 }, (_, i) => {
              const r = Math.floor(i / 8) + 1;
              const c = (i % 8) + 1;
              return (
                <button
                  class={`fb-cell${r <= pick[0] && c <= pick[1] ? ' on' : ''}`}
                  aria-label={`${r} by ${c}`}
                  onMouseEnter={() => setPick([r, c])}
                  onClick={() => (t.run('table', [r, c]), setPop(null))}
                />
              );
            })}
            <div class="fb-grid-label">{pick[0] ? `${pick[0]} rows × ${pick[1]} columns` : 'Pick a size'}</div>
          </div>
        )}
      </div>
      <B c="rule" icon={<I.IcRule />} label="Horizontal line" />
      <span class="fb-sep" />
      <B c="wrap" icon={<I.IcWrap />} label="Word wrap" />
      {d && d.language === 'plain' && (
        <button class="fb-convert" title="Turn this tab into Markdown so it can be formatted" onClick={() => convertToMarkdown(d.id)}>
          <I.IcConvert /> Convert to Markdown
        </button>
      )}
    </div>
  );
}
