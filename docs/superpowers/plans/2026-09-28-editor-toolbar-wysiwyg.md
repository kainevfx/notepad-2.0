# Formatting Toolbar, UI Scale, Sidebar, File Colours & WYSIWYG Markdown Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Word-style formatting toolbar, a UI scale slider, a clearer sidebar with file-type badges and per-file colours, and a TipTap 3 WYSIWYG "Visual" view for Markdown, to Notepad 2.0.

**Architecture:** CodeMirror stays the single source of truth for every tab's text. The new Visual view is a TipTap editor that parses the CodeMirror text on entry and, on each Visual edit, writes minimal-diff changes back into CodeMirror, so dirty tracking, autosave, recovery and saving are unchanged. A `FormatTarget` interface lets one toolbar drive TipTap (Visual), CodeMirror Markdown syntax (Source/Split) or a reduced plain-text set.

**Tech Stack:** Tauri 2, Preact 10 + @preact/signals, CodeMirror 6, TipTap 3.31 (`@tiptap/core`, `@tiptap/starter-kit`, `@tiptap/markdown`, `@tiptap/extension-text-style`, `@tiptap/extension-text-align`, `@tiptap/extension-list`, `@tiptap/extension-table`), unified/remark/rehype preview, vitest (+ happy-dom for TipTap tests).

**Spec:** `docs/superpowers/specs/2026-09-28-editor-toolbar-wysiwyg-design.md`

All paths below are relative to `app/` unless they start with `docs/`.

## Global Constraints

- UI scale: 75–150 %, step 5, default 100; applied with Tauri webview zoom; browser build falls back to CSS `zoom` on `<html>`.
- Text zoom (Ctrl +/−, `settings.zoom`) stays separate from UI scale.
- New text file = Ctrl+N (Ctrl+T also). New Markdown file = Ctrl+Alt+N. Ctrl+Shift+N stays Quick Note.
- `MdView` = `'visual' | 'edit' | 'split'`; UI labels Visual | Source | Split. Stored `'preview'` loads as `'visual'`. `mdDefaultView` default `'visual'`.
- HTML written for non-Markdown formatting: `<u>…</u>`; `<span style="color:#RRGGBB">…</span>`; `<span style="font-size:18px">…</span>`; `<span style="font-weight:300">…</span>` (merged into one `style` when combined); `<p align="center">…</p>` / `<hN align="…">…</hN>`; left alignment writes nothing.
- Preview sanitiser allows `style` on `span` only, and only `color`, `font-size`, `font-weight` with strict values.
- Locked (read-only in Visual, verbatim on save): front matter, `$$` block maths, inline `$` maths, ```` ```mermaid ```` blocks, footnote definitions and references, any other raw HTML.
- No Visual edit ⇒ no write: switching views or saving an untouched file is byte-identical.
- File colour palette = the 9 group colours (`GROUP_COLORS`) + None.
- Toolbar on `.txt`: only Word wrap, Indent/Outdent, Font size/weight (global editor font) enabled; everything else disabled; **Convert to Markdown** shown.

## Review Focus

1. **Visual view on a large or syntax-heavy real-world `.md` (front matter + tables + mermaid + footnotes)**: user expects nothing lost after an edit. Pinned by the "kitchen-sink" round-trip test in Task 6.
2. **Typing fast in Visual then pressing Ctrl+S immediately**: user expects the saved file to contain the last keystroke. Pinned by flushing the pending Visual→CodeMirror sync before `saveDoc` reads text (Task 7 test on `flushVisual`).
3. **Switching Visual → Source → Visual without edits**: user expects the file not to become dirty. Pinned by the "no edit, no write" test in Task 7.
4. **Malicious `style` in a pasted `.md` (`position:fixed`, `url()`, `expression()`)**: user expects the preview not to be hijacked. Pinned by sanitiser tests in Task 4.
5. **Undo in Visual (Ctrl+Z)**: user expects TipTap undo, not a CodeMirror undo that re-parses the whole doc. Pinned by routing `cmd.undo/redo` through the Visual editor when it is active (Task 7).

---

## File Structure

| File | Status | Responsibility |
|---|---|---|
| `src/state/settings.ts` | modify | `uiScale`, `MdView` union, `mdDefaultView: 'visual'`, `migrateMdView()` |
| `src/state/app.ts` | modify | `DocMeta.color`, `newNote({language})`, `setDocColor`, `convertToMarkdown`, view-mode plumbing, undo routing, `flushVisual` hook |
| `src/lib/file-badge.ts` (+ test) | create | Pure: badge label for a doc (`TXT`/`MD`/ext) |
| `src/ui/Sidebar.tsx`, `src/ui/TabStrip.tsx`, `src/ui/menus.ts`, `src/ui/MenuBar.tsx`, `src/ui/shortcuts.ts` | modify | Sidebar rows, labels, badges, colour stripe, colour submenu, new-file entries, shortcuts |
| `src/platform/types.ts`, `tauri.ts`, `mock.ts`, `src-tauri/capabilities/default.json` | modify | `setUiScale` |
| `src/ui/ScaleSlider.tsx` | create | Slider used in status bar and Settings |
| `src/markdown/pipeline.ts` (+ test) | modify | Restricted `style` on `span` |
| `src/editor/md-commands.ts` (+ test) | create | CodeMirror commands that insert Markdown/HTML syntax |
| `src/editor/visual/marks.ts` | create | Underline `<u>`, TextStyle `<span style>` Markdown handlers, FontWeight attribute |
| `src/editor/visual/align.ts` | create | `<p/hN align>` block tokenizer + paragraph/heading render override |
| `src/editor/visual/locked.ts` | create | Locked block / inline atom nodes + tokenizers |
| `src/editor/visual/extensions.ts` | create | Assembles the TipTap extension list |
| `src/editor/visual/markdown.test.ts` | create | Round-trip tests (happy-dom) |
| `src/editor/visual/sync.ts` (+ test) | create | Minimal-diff write-back into CodeMirror; `flushVisual` |
| `src/ui/VisualEditor.tsx` | create | Hosts TipTap for the active tab |
| `src/ui/EditorPane.tsx` | modify | Visual/Source/Split layout |
| `src/editor/format.ts` | create | `FormatCommand`, `FormatTarget`, three targets, `activeTarget` signal |
| `src/ui/FormatBar.tsx` | create | The toolbar |
| `src/ui/icons.tsx`, `src/styles/app.css`, `src/styles/visual.css` | modify/create | Icons and styles |
| `README.md` (app) | modify | Document new features |

---

### Task 1: Data model — settings, MdView migration, doc colour, typed new files

**Files:**
- Modify: `src/state/settings.ts`
- Modify: `src/state/app.ts` (`DocMeta` ~L29, `newNote` ~L224, `setLanguage`/`setMdView`/`cycleMdView` ~L647-670, `restoreSession` ~L950)
- Create: `src/state/settings.test.ts`

**Interfaces:**
- Produces: `type MdView = 'visual' | 'edit' | 'split'`; `migrateMdView(v: string | undefined): MdView`; `Settings.uiScale: number`; `DocMeta.color?: GroupColor`; `newNote(opts: { text?; groupId?; activate?; language?: 'plain' | 'markdown' }): string`; `setDocColor(id: string, color: GroupColor | null): void`; `convertToMarkdown(id: string): Promise<void>`.

- [ ] **Step 1: Write the failing test** — `src/state/settings.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { migrateMdView, DEFAULT_SETTINGS } from './settings';

describe('migrateMdView', () => {
  it('maps the old preview-only view to visual', () => expect(migrateMdView('preview')).toBe('visual'));
  it('keeps valid views', () => {
    expect(migrateMdView('edit')).toBe('edit');
    expect(migrateMdView('split')).toBe('split');
    expect(migrateMdView('visual')).toBe('visual');
  });
  it('falls back to visual for junk', () => expect(migrateMdView(undefined)).toBe('visual'));
});

describe('defaults', () => {
  it('opens markdown in visual and UI at 100%', () => {
    expect(DEFAULT_SETTINGS.mdDefaultView).toBe('visual');
    expect(DEFAULT_SETTINGS.uiScale).toBe(100);
  });
});
```

- [ ] **Step 2: Run it and see it fail** — `npx vitest run src/state/settings.test.ts` → FAIL (`migrateMdView` not exported). Note: `settings.ts` imports `platform`; if the import breaks in node, mock it at the top of the test with `vi.mock('../platform', () => ({ platform: {} }))`.

- [ ] **Step 3: Implement in `settings.ts`**

```ts
export type MdView = 'visual' | 'edit' | 'split';

export function migrateMdView(v: string | undefined): MdView {
  if (v === 'edit' || v === 'split' || v === 'visual') return v;
  return 'visual'; // 'preview' (removed) and anything unknown
}
```
Add `uiScale: number; // percent, 75-150` to `Settings`, `uiScale: 100` to `DEFAULT_SETTINGS`, change `mdDefaultView: 'visual'`. In `loadSettings`, after parsing: `settings.value = { ...merged, mdDefaultView: migrateMdView(merged.mdDefaultView) }`. Add `export function clampScale(n: number) { return Math.max(75, Math.min(150, Math.round(n / 5) * 5)); }`.

- [ ] **Step 4: Implement in `app.ts`**
  - `DocMeta`: add `color?: GroupColor;` (import `GroupColor` from `../lib/tree-ops`).
  - `newNote`: accept `language?: 'plain' | 'markdown'`; `const language = opts.language ?? (settings.value.mdForTxt ? 'markdown' : 'plain');` and `mdView: language === 'markdown' ? 'visual' : 'edit'`.
  - Add:
    ```ts
    export function setDocColor(id: string, color: GroupColor | null) {
      patchDoc(id, { color: color ?? undefined });
      scheduleSession();
    }
    ```
  - `restoreSession`: when adding each doc, `mdView: migrateMdView(meta.mdView)`.
  - `setLanguage`: default Markdown view is `settings.value.mdDefaultView` (already `'visual'`).
  - `cycleMdView`: `const order: MdView[] = ['visual', 'edit', 'split'];` and non-markdown case → `setMdView(d.id, 'visual')`.
  - `cmd.print`: rendered when `d.mdView !== 'edit'` stays; print reads from `.md-preview .markdown-body` or, if absent, from `.visual-editor .ProseMirror` (update the selector to `document.querySelector('.md-preview .markdown-body, .visual-editor .ProseMirror')`).
  - Add `convertToMarkdown`:
    ```ts
    export async function convertToMarkdown(id: string) {
      const d = docs.value[id];
      if (!d) return;
      setLanguage(id, 'markdown');
      if (d.kind === 'file' && d.path && !isMarkdownPath(d.path)) {
        const r = await ask({
          title: 'Convert to Markdown',
          body: 'Also save a Markdown (.md) copy of this file? The original .txt stays as it is.',
          buttons: [{ label: 'Save as .md…', value: 'save', primary: true }, { label: 'Not now', value: 'no' }],
        });
        if (r.value === 'save') await saveDocAs(id);
      }
    }
    ```
  - Update every other `'preview'` literal (`grep -n "'preview'" src`) to `'visual'`, and `mdView: md && !big ? settings.value.mdDefaultView : 'edit'` stays.

- [ ] **Step 5: Run** `npx vitest run` and `npm run typecheck` → PASS (fix any `'preview'` type errors the compiler lists).

- [ ] **Step 6: Commit**
```bash
git add src/state
git commit -m "feat: MdView visual + migration, uiScale setting, doc colour, typed new files"
```

---

### Task 2: Sidebar, tab badges, file colours, new-file commands

**Files:**
- Create: `src/lib/file-badge.ts`, `src/lib/file-badge.test.ts`
- Modify: `src/ui/Sidebar.tsx`, `src/ui/TabStrip.tsx`, `src/ui/menus.ts`, `src/ui/MenuBar.tsx`, `src/ui/shortcuts.ts`, `src/ui/icons.tsx`, `src/styles/app.css`

**Interfaces:**
- Consumes: `newNote({ language })`, `setDocColor`, `DocMeta.color` (Task 1); `GROUP_PALETTE`, `GROUP_HEX` (`ui/colors.ts`).
- Produces: `fileBadge(d: { language: 'plain'|'markdown'; path: string | null }): { label: string; kind: 'txt' | 'md' | 'other' }`; `docColorVars(color?: GroupColor): Record<string,string>` in `ui/colors.ts`.

- [ ] **Step 1: Failing test** — `src/lib/file-badge.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { fileBadge } from './file-badge';

describe('fileBadge', () => {
  it('untitled plain note is TXT', () => expect(fileBadge({ language: 'plain', path: null })).toEqual({ label: 'TXT', kind: 'txt' }));
  it('untitled markdown note is MD', () => expect(fileBadge({ language: 'markdown', path: null })).toEqual({ label: 'MD', kind: 'md' }));
  it('.txt file is TXT', () => expect(fileBadge({ language: 'plain', path: 'C:\\a\\b.txt' })).toEqual({ label: 'TXT', kind: 'txt' }));
  it('.markdown file is MD', () => expect(fileBadge({ language: 'markdown', path: '/x/y.markdown' })).toEqual({ label: 'MD', kind: 'md' }));
  it('.log shows its extension', () => expect(fileBadge({ language: 'plain', path: 'C:\\s.log' })).toEqual({ label: 'LOG', kind: 'other' }));
  it('.txt treated as markdown shows MD', () => expect(fileBadge({ language: 'markdown', path: 'C:\\n.txt' })).toEqual({ label: 'MD', kind: 'md' }));
  it('long extension is cut to 4', () => expect(fileBadge({ language: 'plain', path: 'a.config' })).toEqual({ label: 'CONF', kind: 'other' }));
});
```

- [ ] **Step 2: Run** `npx vitest run src/lib/file-badge.test.ts` → FAIL.

- [ ] **Step 3: Implement** `src/lib/file-badge.ts`

```ts
export type BadgeKind = 'txt' | 'md' | 'other';

export function fileBadge(d: { language: 'plain' | 'markdown'; path: string | null }): { label: string; kind: BadgeKind } {
  if (d.language === 'markdown') return { label: 'MD', kind: 'md' };
  const ext = d.path && /\.([^.\\/]+)$/.exec(d.path)?.[1];
  if (!ext || ext.toLowerCase() === 'txt') return { label: 'TXT', kind: 'txt' };
  return { label: ext.slice(0, 4).toUpperCase(), kind: 'other' };
}
```

- [ ] **Step 4: Run** the test → PASS.

- [ ] **Step 5: `ui/colors.ts`** — add

```ts
export function docColorVars(color?: GroupColor): Record<string, string> {
  if (!color) return {};
  const [light, dark] = GROUP_PALETTE[color];
  return { '--f-light': light, '--f-dark': dark };
}
```

- [ ] **Step 6: Icons** — in `icons.tsx` add `IcNewText` (page with "+"), `IcNewMd` (page with "M↓"), `IcBold`, `IcItalic`, `IcUnderline`, `IcStrike`, `IcCode`, `IcColor`, `IcAlignLeft`, `IcAlignCenter`, `IcAlignRight`, `IcAlignJustify`, `IcListBullet`, `IcListNumber`, `IcListCheck`, `IcIndent`, `IcOutdent`, `IcLink`, `IcTable`, `IcRule`, `IcWrap`, `IcConvert` using the existing `S()` helper (16px grid, strokes). Example:
```tsx
export const IcAlignCenter = (p: P) => S(<path d="M3 4h10M5 7h6M3 10h10M5 13h6" />, p);
export const IcListBullet = (p: P) => S(<><circle cx="3.5" cy="4.5" r=".8" /><circle cx="3.5" cy="8" r=".8" /><circle cx="3.5" cy="11.5" r=".8" /><path d="M6.5 4.5h7M6.5 8h7M6.5 11.5h7" /></>, p);
export const IcBold = (p: P) => S(<path d="M5 3.5h4a2.25 2.25 0 0 1 0 4.5H5zM5 8h4.5a2.25 2.25 0 0 1 0 4.5H5z" stroke-width="1.6" />, p);
```
(Write all listed icons in this style; each is one `S(...)` call.)

- [ ] **Step 7: `Sidebar.tsx`** — replace the `side-tools` block with two rows, and use the badge + colour stripe in `NoteRow`:

```tsx
<div class="side-tools">
  <div class="side-search">
    <IcSearch size={14} />
    <input placeholder="Search tabs" value={q} onInput={(e) => setQ((e.target as HTMLInputElement).value)} />
  </div>
  <div class="side-actions">
    <button class="side-action" title="New text file (Ctrl+N)" onClick={() => newNote({ language: 'plain' })}><IcNewText /><span>Text file</span></button>
    <button class="side-action" title="New Markdown file (Ctrl+Alt+N)" onClick={() => newNote({ language: 'markdown' })}><IcNewMd /><span>Markdown</span></button>
    <button class="side-action" title="New group (Ctrl+Shift+G)" onClick={() => newGroupFrom([], null)}><IcFolderPlus /><span>Group</span></button>
    <span class="side-actions-flex" />
    <button class="icon-btn" title="Collapse sidebar to a rail" onClick={() => updateSettings({ tabsMode: 'rail' })}><IcChevronLeft /></button>
  </div>
</div>
```
In `NoteRow`: `const b = fileBadge(d);` add `style={{ '--depth': depth, ...docColorVars(d.color) } as any}`, add class `${d.color ? ' colored' : ''}`, replace the icon + `ext-badge` with `<span class={`type-badge type-${b.kind}`}>{b.label}</span>`.

- [ ] **Step 8: `TabStrip.tsx`** — in `Tab`: add `<span class={`type-badge type-${b.kind}`}>{b.label}</span>` before the title, merge `docColorVars(d.color)` into `style`, add `colored` class; the "+" button becomes `newNote({ language: 'plain' })` with title "New text file (Ctrl+N)", followed by a second button `tab-new` titled "New Markdown file (Ctrl+Alt+N)" rendering `<IcNewMd />` calling `newNote({ language: 'markdown' })`.

- [ ] **Step 9: `menus.ts`** — in `noteMenu`, after the group items insert:
```ts
{
  label: 'Colour',
  submenu: [
    { label: 'None', checked: !d.color, action: () => setDocColor(id, null) },
    ...T.GROUP_COLORS.map((c) => ({ label: c[0].toUpperCase() + c.slice(1), swatch: GROUP_HEX[c], checked: d.color === c, action: () => setDocColor(id, c) })),
  ],
},
```
Also replace any `newNote()` menu label "New note"/"New tab" with the two entries (`grep -n "newNote" src/ui` and update labels).

- [ ] **Step 10: `MenuBar.tsx` fileMenu** — replace `{ label: 'New tab', … }` with:
```ts
{ label: 'New text file', shortcut: 'Ctrl+N', action: () => newNote({ language: 'plain' }) },
{ label: 'New Markdown file', shortcut: 'Ctrl+Alt+N', action: () => newNote({ language: 'markdown' }) },
```

- [ ] **Step 11: `shortcuts.ts`** — in the Ctrl+Alt branch (where `k === 's'` → `saveAll`) add `if (k === 'n') return run(() => newNote({ language: 'markdown' }));`. Plain Ctrl+N / Ctrl+T call `newNote({ language: 'plain' })`.

- [ ] **Step 12: CSS (`app.css`)**
```css
.side-tools { flex-direction: column; align-items: stretch; gap: 6px; }
.side-search { flex: 0 0 auto; width: 100%; }
.side-actions { display: flex; align-items: center; gap: 4px; flex-wrap: wrap; }
.side-actions-flex { flex: 1; }
.side-action { display: inline-flex; align-items: center; gap: 5px; height: 28px; padding: 0 8px; border-radius: var(--radius); font-size: 12px; color: var(--text-2); }
.side-action:hover { background: var(--bg-hover); color: var(--text); }
.sidebar[data-narrow] .side-action span { display: none; }
.type-badge { flex: 0 0 auto; font: 600 9.5px/1 var(--ui-font); letter-spacing: .04em; padding: 3px 4px; border-radius: 4px; }
.type-txt { background: color-mix(in srgb, var(--text-3) 18%, transparent); color: var(--text-2); }
.type-md { background: color-mix(in srgb, var(--accent) 22%, transparent); color: var(--accent-text); }
.type-other { background: var(--bg-hover); color: var(--text-2); }
.side-note.colored, .tab.colored { box-shadow: inset 3px 0 0 var(--f-light); }
html.dark .side-note.colored, html.dark .tab.colored { box-shadow: inset 3px 0 0 var(--f-dark); }
```
The existing `.side-tools` rule sets `display:flex` — keep it and change direction as above. `data-narrow`: in `Sidebar`, set `data-narrow={s.sidebarWidth < 250 ? '' : undefined}` on `<aside>`.

- [ ] **Step 13: Verify** — `npm run typecheck && npx vitest run` → PASS. In the running `npx tauri dev` window: switch to left tabs, confirm the search is on its own row, the three labelled buttons, TXT/MD badges on sidebar and top tabs, right-click → Colour → Red shows a red stripe that survives an app restart.

- [ ] **Step 14: Commit**
```bash
git add src
git commit -m "feat: labelled sidebar actions, TXT/MD badges, per-file colours, new text/markdown file"
```

---

### Task 3: UI scale slider

**Files:**
- Modify: `src/platform/types.ts`, `src/platform/tauri.ts`, `src/platform/mock.ts`, `src-tauri/capabilities/default.json`
- Create: `src/ui/ScaleSlider.tsx`
- Modify: `src/ui/StatusBar.tsx`, `src/ui/Settings.tsx`, `src/ui/App.tsx`, `src/styles/app.css`

**Interfaces:**
- Consumes: `settings.uiScale`, `clampScale` (Task 1).
- Produces: `Platform.setUiScale(factor: number): Promise<void>`; `<ScaleSlider compact?: boolean />`.

- [ ] **Step 1: Platform** — `types.ts`: add `/** Scale the whole UI (1 = 100%). */ setUiScale(factor: number): Promise<void>;` to `Platform`.
  - `tauri.ts`: `import { getCurrentWebview } from '@tauri-apps/api/webview';` and `setUiScale: (f) => getCurrentWebview().setZoom(f),`.
  - `mock.ts`: `async setUiScale(f) { (document.documentElement.style as any).zoom = String(f); },`.
  - `default.json`: add `"core:webview:allow-set-webview-zoom"` to `permissions`.

- [ ] **Step 2: Apply on change** — in `App.tsx`:
```tsx
useSignalEffect(() => {
  platform.setUiScale(settings.value.uiScale / 100).catch(() => {});
});
```

- [ ] **Step 3: `ScaleSlider.tsx`**
```tsx
import { settings, updateSettings, clampScale } from '../state/settings';

export function ScaleSlider({ compact = false }: { compact?: boolean }) {
  const v = settings.value.uiScale;
  return (
    <label class={`scale-slider${compact ? ' compact' : ''}`} title="Interface size (double-click the number to reset)">
      {!compact && <span>Interface size</span>}
      <input type="range" min={75} max={150} step={5} value={v}
        onInput={(e) => updateSettings({ uiScale: clampScale(Number((e.target as HTMLInputElement).value)) })} />
      <span class="scale-val" onDblClick={() => updateSettings({ uiScale: 100 })}>{v}%</span>
    </label>
  );
}
```

- [ ] **Step 4: Place it** — `StatusBar.tsx`: render `<ScaleSlider compact />` just before the `sb-zoom` button; relabel that button's title to "Text zoom". `Settings.tsx` Appearance card: add `<Row title="Interface size" desc="Makes the whole app more compact or roomier. Text zoom (Ctrl +/−) is separate."><ScaleSlider /></Row>` above "App theme".

- [ ] **Step 5: CSS**
```css
.scale-slider { display: inline-flex; align-items: center; gap: 8px; font-size: 12px; color: var(--text-2); }
.scale-slider input[type=range] { width: 140px; accent-color: var(--accent); }
.scale-slider.compact input[type=range] { width: 80px; }
.scale-val { min-width: 36px; text-align: right; cursor: pointer; }
```

- [ ] **Step 6: Verify** — `npm run typecheck`. Restart `npx tauri dev` (capability change needs a Rust rebuild). Drag the slider 75 → 150: every part of the UI scales, clicks still land on the right text in the editor, value survives a restart. Browser build: `npm run build && npm run preview`, slider still works via CSS zoom.

- [ ] **Step 7: Commit**
```bash
git add src src-tauri/capabilities
git commit -m "feat: UI scale slider (webview zoom) in status bar and settings"
```

---

### Task 4: Preview sanitiser allows restricted inline styles

**Files:**
- Modify: `src/markdown/pipeline.ts`
- Modify: `src/markdown/pipeline.test.ts`

**Interfaces:**
- Produces: `cleanStyle(style: string): string | null` (exported for tests).

- [ ] **Step 1: Failing tests** — append to `pipeline.test.ts`:
```ts
import { cleanStyle } from './pipeline';

describe('inline style allow-list', () => {
  it('keeps colour, size and weight on span', () => {
    const html = renderMarkdown('a <span style="color:#ff0000; font-size:18px; font-weight:300">b</span>');
    expect(html).toContain('style="color:#ff0000;font-size:18px;font-weight:300"');
  });
  it('drops dangerous properties', () => {
    expect(cleanStyle('position:fixed;top:0;color:red')).toBe('color:red');
    expect(cleanStyle('background:url(http://x)')).toBeNull();
    expect(cleanStyle('color:expression(alert(1))')).toBeNull();
    expect(cleanStyle('font-size:9999px')).toBeNull();
  });
  it('does not allow style on other tags', () => {
    expect(renderMarkdown('<div style="color:red">x</div>')).not.toContain('style=');
  });
  it('keeps align on paragraphs and headings', () => {
    expect(renderMarkdown('<p align="center">x</p>')).toContain('align="center"');
    expect(renderMarkdown('<h2 align="right">x</h2>')).toContain('align="right"');
  });
  it('keeps underline', () => expect(renderMarkdown('<u>x</u>')).toContain('<u>x</u>'));
});
```

- [ ] **Step 2: Run** `npx vitest run src/markdown` → FAIL.

- [ ] **Step 3: Implement** in `pipeline.ts`:
```ts
const STYLE_RULES: Record<string, RegExp> = {
  color: /^(#[0-9a-f]{3,8}|rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*(,\s*(0|1|0?\.\d+)\s*)?\)|[a-z]{3,20})$/i,
  'font-size': /^(\d{1,2}(\.\d+)?(px|pt|em|rem)|\d{2,3}%)$/i,
  'font-weight': /^(100|200|300|400|500|600|700|800|900|normal|bold)$/i,
};

export function cleanStyle(style: string): string | null {
  const out: string[] = [];
  for (const decl of style.split(';')) {
    const i = decl.indexOf(':');
    if (i < 0) continue;
    const prop = decl.slice(0, i).trim().toLowerCase();
    const val = decl.slice(i + 1).trim();
    const re = STYLE_RULES[prop];
    if (!re || !re.test(val) || /expression|url\(/i.test(val)) continue;
    if (prop === 'font-size' && /px$/i.test(val) && parseFloat(val) > 96) continue;
    out.push(`${prop}:${val}`);
  }
  return out.length ? out.join(';') : null;
}

function rehypeCleanStyles() {
  return (tree: any) => {
    visit(tree, 'element', (node: any) => {
      const p = node.properties;
      if (!p || p.style == null) return;
      const s = node.tagName === 'span' ? cleanStyle(String(p.style)) : null;
      if (s) p.style = s;
      else delete p.style;
    });
  };
}
```
In `schema.attributes` add `span: [...(defaultSchema.attributes?.span ?? []), 'style']`. In `buildProcessor`, `.use(rehypeCleanStyles)` directly **after** `.use(rehypeSanitize, schema)`.

- [ ] **Step 4: Run** → PASS (the `font-size:9999px` case is 4 digits so already fails the regex).

- [ ] **Step 5: Commit**
```bash
git add src/markdown
git commit -m "feat: preview keeps safe inline colour/size/weight styles"
```

---

### Task 5: Markdown source formatting commands (CodeMirror)

**Files:**
- Create: `src/editor/md-commands.ts`, `src/editor/md-commands.test.ts`
- Modify: `src/editor/setup.ts` (move `wrapWith`/`insertLink` into `md-commands.ts`, import them back)

**Interfaces:**
- Produces (all `(view: EditorView, ...args) => boolean`, operating on `view.state`): `toggleWrap(view, open, close, placeholder)`, `setBlockType(view, kind: 'body'|'h1'|'h2'|'h3'|'quote'|'code')`, `toggleList(view, kind: 'bullet'|'number'|'check')`, `indentLines(view, dir: 1 | -1)`, `wrapSpanStyle(view, prop: 'color'|'font-size'|'font-weight', value: string)`, `setAlign(view, align: 'left'|'center'|'right'|'justify')`, `insertTable(view, rows: number, cols: number)`, `insertRule(view)`, `insertLink(view)`.

- [ ] **Step 1: Failing tests** — `md-commands.test.ts`. Use a tiny harness so no DOM is needed:
```ts
import { describe, it, expect } from 'vitest';
import { EditorState, EditorSelection } from '@codemirror/state';
import * as C from './md-commands';

// Minimal fake view: commands only use state + dispatch.
function run(doc: string, from: number, to: number, fn: (v: any) => boolean) {
  let state = EditorState.create({ doc, selection: EditorSelection.single(from, to) });
  const v: any = { get state() { return state; }, dispatch: (tr: any) => { state = state.update(tr).state; } };
  fn(v);
  return { text: state.doc.toString(), sel: state.selection.main };
}

describe('md-commands', () => {
  it('bold wraps and unwraps', () => {
    expect(run('a word b', 2, 6, (v) => C.toggleWrap(v, '**', '**', 'bold')).text).toBe('a **word** b');
    expect(run('a **word** b', 4, 8, (v) => C.toggleWrap(v, '**', '**', 'bold')).text).toBe('a word b');
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
  it('numbered list numbers lines', () => expect(run('a\nb', 0, 3, (v) => C.toggleList(v, 'number')).text).toBe('1. a\n2. b'));
  it('checklist', () => expect(run('a', 0, 0, (v) => C.toggleList(v, 'check')).text).toBe('- [ ] a'));
  it('indent adds two spaces to list lines and a tab otherwise; outdent removes', () => {
    expect(run('- a', 0, 0, (v) => C.indentLines(v, 1)).text).toBe('  - a');
    expect(run('  - a', 0, 0, (v) => C.indentLines(v, -1)).text).toBe('- a');
    expect(run('a', 0, 0, (v) => C.indentLines(v, 1)).text).toBe('\ta');
  });
  it('colour wraps a span', () => expect(run('hi', 0, 2, (v) => C.wrapSpanStyle(v, 'color', '#ff0000')).text).toBe('<span style="color:#ff0000">hi</span>'));
  it('align centre wraps the paragraph', () => expect(run('hi', 0, 0, (v) => C.setAlign(v, 'center')).text).toBe('<p align="center">hi</p>'));
  it('align left unwraps', () => expect(run('<p align="center">hi</p>', 20, 20, (v) => C.setAlign(v, 'left')).text).toBe('hi'));
  it('table 2x2', () => expect(run('', 0, 0, (v) => C.insertTable(v, 2, 2)).text).toBe('| Column 1 | Column 2 |\n| --- | --- |\n|  |  |\n|  |  |\n'));
});
```

- [ ] **Step 2: Run** `npx vitest run src/editor/md-commands.test.ts` → FAIL.

- [ ] **Step 3: Implement** `md-commands.ts`:
```ts
import { EditorSelection, type EditorState, type Line } from '@codemirror/state';
type V = { state: EditorState; dispatch: (tr: any) => void };

export function toggleWrap(view: V, open: string, close: string, placeholder: string) {
  const { state } = view;
  view.dispatch(state.changeByRange((r) => {
    const before = state.sliceDoc(r.from - open.length, r.from);
    const after = state.sliceDoc(r.to, r.to + close.length);
    if (before === open && after === close) {
      return {
        changes: [{ from: r.from - open.length, to: r.from }, { from: r.to, to: r.to + close.length }],
        range: EditorSelection.range(r.from - open.length, r.to - open.length),
      };
    }
    const body = state.sliceDoc(r.from, r.to) || placeholder;
    return {
      changes: { from: r.from, to: r.to, insert: open + body + close },
      range: EditorSelection.range(r.from + open.length, r.from + open.length + body.length),
    };
  }));
  return true;
}

function selectedLines(state: EditorState): Line[] {
  const seen = new Set<number>();
  const out: Line[] = [];
  for (const r of state.selection.ranges) {
    for (let n = state.doc.lineAt(r.from).number; n <= state.doc.lineAt(r.to).number; n++) {
      if (!seen.has(n)) { seen.add(n); out.push(state.doc.line(n)); }
    }
  }
  return out;
}

const BLOCK_PREFIX = /^(#{1,6}\s+|>\s?)/;

export function setBlockType(view: V, kind: 'body' | 'h1' | 'h2' | 'h3' | 'quote' | 'code') {
  const { state } = view;
  const lines = selectedLines(state);
  if (kind === 'code') {
    const from = lines[0].from, to = lines[lines.length - 1].to;
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

export function toggleList(view: V, kind: 'bullet' | 'number' | 'check') {
  const { state } = view;
  const lines = selectedLines(state);
  const want = (i: number) => (kind === 'bullet' ? '- ' : kind === 'check' ? '- [ ] ' : `${i + 1}. `);
  const isKind = (t: string) => {
    const m = LIST_RE.exec(t);
    if (!m) return false;
    const mk = m[2];
    return kind === 'check' ? /\[/.test(mk) : kind === 'number' ? /^\d/.test(mk) : !/\[/.test(mk) && !/^\d/.test(mk);
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

export function indentLines(view: V, dir: 1 | -1) {
  const { state } = view;
  view.dispatch({
    changes: selectedLines(state).map((l) => {
      const list = LIST_RE.test(l.text);
      if (dir === 1) return { from: l.from, insert: list ? '  ' : '\t' };
      const m = /^(\t| {1,2})/.exec(l.text);
      return { from: l.from, to: l.from + (m ? m[0].length : 0) };
    }),
  });
  return true;
}

export function wrapSpanStyle(view: V, prop: 'color' | 'font-size' | 'font-weight', value: string) {
  return toggleWrap(view, `<span style="${prop}:${value}">`, '</span>', 'text');
}

const ALIGN_RE = /^<(p|h[1-6]) align="(left|center|right|justify)">([\s\S]*)<\/\1>$/;

export function setAlign(view: V, align: 'left' | 'center' | 'right' | 'justify') {
  const { state } = view;
  view.dispatch({
    changes: selectedLines(state).map((l) => {
      const m = ALIGN_RE.exec(l.text);
      let tag = m ? m[1] : 'p';
      let body = m ? m[3] : l.text;
      const h = !m && /^(#{1,6})\s+(.*)$/.exec(l.text);
      if (h) { tag = `h${h[1].length}`; body = h[2]; }
      if (align === 'left') return { from: l.from, to: l.to, insert: m ? (tag === 'p' ? body : `${'#'.repeat(+tag[1])} ${body}`) : l.text };
      return { from: l.from, to: l.to, insert: `<${tag} align="${align}">${body}</${tag}>` };
    }),
  });
  return true;
}

export function insertTable(view: V, rows: number, cols: number) {
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

export function insertRule(view: V) {
  const pos = view.state.selection.main.head;
  view.dispatch({ changes: { from: pos, insert: '\n\n---\n\n' } });
  return true;
}

export function insertLink(view: V) {
  view.dispatch(view.state.changeByRange((r) => {
    const text = view.state.sliceDoc(r.from, r.to) || 'link text';
    const insert = `[${text}](https://)`;
    const urlStart = r.from + text.length + 3;
    return { changes: { from: r.from, to: r.to, insert }, range: EditorSelection.range(urlStart, urlStart + 8) };
  }));
  return true;
}
```
Note the `'   '` array in `row`: `Array(cols).fill('')` joined by `' | '` gives `|  |  |` for 2 columns, matching the test.

- [ ] **Step 4: Rewire `setup.ts`** — delete the local `wrapWith` and `insertLink`, import from `./md-commands`, and extend the keymap:
```ts
export const markdownEditingKeymap = keymap.of([
  { key: 'Mod-b', run: (v) => toggleWrap(v, '**', '**', 'bold') },
  { key: 'Mod-i', run: (v) => toggleWrap(v, '*', '*', 'italic') },
  { key: 'Mod-u', run: (v) => toggleWrap(v, '<u>', '</u>', 'text') },
  { key: 'Mod-Shift-x', run: (v) => toggleWrap(v, '~~', '~~', 'text') },
  { key: 'Mod-k', run: insertLink },
  { key: 'Mod-Shift-7', run: (v) => toggleList(v, 'number') },
  { key: 'Mod-Shift-8', run: (v) => toggleList(v, 'bullet') },
  { key: 'Mod-]', run: (v) => indentLines(v, 1) },
  { key: 'Mod-[', run: (v) => indentLines(v, -1) },
  { key: 'Mod-Alt-0', run: (v) => setBlockType(v, 'body') },
  { key: 'Mod-Alt-1', run: (v) => setBlockType(v, 'h1') },
  { key: 'Mod-Alt-2', run: (v) => setBlockType(v, 'h2') },
  { key: 'Mod-Alt-3', run: (v) => setBlockType(v, 'h3') },
  ...markdownKeymap,
]);
```

- [ ] **Step 5: Run** `npx vitest run && npm run typecheck` → PASS.

- [ ] **Step 6: Commit**
```bash
git add src/editor
git commit -m "feat: Markdown source formatting commands and shortcuts"
```

---

### Task 6: TipTap Visual engine — extensions and Markdown round-trip

**Files:**
- Modify: `package.json` (deps)
- Create: `src/editor/visual/marks.ts`, `src/editor/visual/align.ts`, `src/editor/visual/locked.ts`, `src/editor/visual/extensions.ts`, `src/editor/visual/markdown.test.ts`

**Interfaces:**
- Produces: `visualExtensions(opts?: { placeholder?: string }): AnyExtension[]`; `parseMarkdownToEditor(editor: Editor, md: string): void`; `editorToMarkdown(editor: Editor): string`; node names `lockedBlock` (attrs `{ raw: string; kind: 'frontmatter'|'math'|'mermaid'|'footnote'|'html' }`), `lockedInline` (attrs `{ raw: string; kind: 'math'|'footnote-ref'|'html' }`); TextStyle attrs `color`, `fontSize`, `fontWeight`.

- [ ] **Step 1: Install**
```bash
npm i @tiptap/core@^3.31 @tiptap/pm@^3.31 @tiptap/starter-kit@^3.31 @tiptap/markdown@^3.31 @tiptap/extension-text-style@^3.31 @tiptap/extension-text-align@^3.31 @tiptap/extension-list@^3.31 @tiptap/extension-table@^3.31 @tiptap/extensions@^3.31
npm i -D happy-dom
```
Then check the exact Markdown helper API names this plan relies on: `grep -n "parseInline\|applyMark\|renderChildren\|parseChildren\|markdownTokenizer\|getMarkdown" node_modules/@tiptap/markdown/dist/index.d.ts node_modules/@tiptap/core/dist/index.d.ts | head -40`. If a name differs, use the installed one everywhere below.

- [ ] **Step 2: Write the failing round-trip tests** — `src/editor/visual/markdown.test.ts`:
```ts
// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest';
import { Editor } from '@tiptap/core';
import { visualExtensions, parseMarkdownToEditor, editorToMarkdown } from './extensions';

let ed: Editor | null = null;
afterEach(() => { ed?.destroy(); ed = null; });
function rt(md: string): string {
  ed = new Editor({ extensions: visualExtensions() });
  parseMarkdownToEditor(ed, md);
  return editorToMarkdown(ed);
}
const same = (md: string) => expect(rt(md).trim()).toBe(md.trim());

describe('visual markdown round-trip', () => {
  it('headings and paragraphs', () => same('# One\n\n## Two\n\nBody text.'));
  it('emphasis', () => same('**b** *i* ~~s~~ `c`'));
  it('bullet, ordered and task lists, nested', () => same('- a\n  - b\n- c\n\n1. x\n2. y\n\n- [ ] todo\n- [x] done'));
  it('table', () => same('| A | B |\n| --- | --- |\n| 1 | 2 |'));
  it('link', () => same('[site](https://example.com)'));
  it('code block with language', () => same('```ts\nconst a = 1;\n```'));
  it('blockquote and rule', () => same('> quoted\n\n---\n\nafter'));
  it('underline as <u>', () => same('a <u>b</u> c'));
  it('colour span', () => same('a <span style="color:#ff0000">red</span> b'));
  it('size + weight merge into one span', () => same('<span style="font-size:18px;font-weight:300">x</span>'));
  it('centred paragraph and right heading', () => same('<p align="center">mid</p>\n\n<h2 align="right">R</h2>'));
  it('front matter is locked and verbatim', () => same('---\ntitle: X\ntags: [a, b]\n---\n\n# Doc'));
  it('block and inline maths verbatim', () => same('$$\n\\int_0^1 x\\,dx\n$$\n\nInline $a^2$ here.'));
  it('mermaid verbatim', () => same('```mermaid\ngraph TD\n  A-->B\n```'));
  it('footnotes verbatim', () => same('Text[^1].\n\n[^1]: The note.'));
  it('other raw HTML verbatim', () => same('<details>\n<summary>More</summary>\n\nHidden\n</details>'));
});

describe('kitchen sink survives an unrelated edit', () => {
  it('only the edited line changes', () => {
    const md = '---\na: 1\n---\n\n# T\n\nPara one.\n\n```mermaid\ngraph TD\n  A-->B\n```\n\n| A | B |\n| --- | --- |\n| 1 | 2 |\n\nNote[^n].\n\n[^n]: Foot.';
    ed = new Editor({ extensions: visualExtensions() });
    parseMarkdownToEditor(ed, md);
    // Append " Edited" to "Para one."
    let pos = -1;
    ed.state.doc.descendants((n, p) => { if (n.isText && n.text === 'Para one.') pos = p + n.nodeSize; });
    ed.commands.insertContentAt(pos, ' Edited');
    expect(editorToMarkdown(ed).trim()).toBe(md.replace('Para one.', 'Para one. Edited').trim());
  });
});
```

- [ ] **Step 3: Run** `npx vitest run src/editor/visual` → FAIL (module missing).

- [ ] **Step 4: `marks.ts`** — underline, text style (colour / size / weight):
```ts
import { Extension } from '@tiptap/core';
import Underline from '@tiptap/extension-underline';
import { TextStyle, Color, FontSize } from '@tiptap/extension-text-style';

export const HtmlUnderline = Underline.extend({
  markdownTokenizer: {
    name: 'underline',
    level: 'inline',
    start: (src: string) => src.indexOf('<u>'),
    tokenize: (src: string, _t: unknown, lexer: any) => {
      const m = /^<u>([\s\S]*?)<\/u>/.exec(src);
      return m ? { type: 'underline', raw: m[0], text: m[1], tokens: lexer.inlineTokens(m[1]) } : undefined;
    },
  },
  parseMarkdown: (token: any, h: any) => h.applyMark('underline', h.parseInline(token.tokens || [])),
  renderMarkdown: (node: any, h: any) => `<u>${h.renderChildren(node)}</u>`,
});

export const FontWeight = Extension.create({
  name: 'fontWeight',
  addGlobalAttributes() {
    return [{
      types: ['textStyle'],
      attributes: {
        fontWeight: {
          default: null,
          parseHTML: (el: HTMLElement) => el.style.fontWeight || null,
          renderHTML: (a: any) => (a.fontWeight ? { style: `font-weight:${a.fontWeight}` } : {}),
        },
      },
    }];
  },
});

function styleOf(attrs: any): string {
  const parts: string[] = [];
  if (attrs?.color) parts.push(`color:${attrs.color}`);
  if (attrs?.fontSize) parts.push(`font-size:${attrs.fontSize}`);
  if (attrs?.fontWeight) parts.push(`font-weight:${attrs.fontWeight}`);
  return parts.join(';');
}

function parseStyle(s: string) {
  const a: Record<string, string> = {};
  for (const d of s.split(';')) {
    const [k, v] = d.split(':').map((x) => x?.trim());
    if (k === 'color') a.color = v;
    if (k === 'font-size') a.fontSize = v;
    if (k === 'font-weight') a.fontWeight = v;
  }
  return a;
}

export const HtmlTextStyle = TextStyle.extend({
  markdownTokenizer: {
    name: 'textStyle',
    level: 'inline',
    start: (src: string) => src.indexOf('<span style='),
    tokenize: (src: string, _t: unknown, lexer: any) => {
      const m = /^<span style="([^"]*)">([\s\S]*?)<\/span>/.exec(src);
      return m ? { type: 'textStyle', raw: m[0], style: m[1], tokens: lexer.inlineTokens(m[2]) } : undefined;
    },
  },
  parseMarkdown: (token: any, h: any) => h.applyMark('textStyle', h.parseInline(token.tokens || []), parseStyle(token.style)),
  renderMarkdown: (node: any, h: any) => {
    const content = h.renderChildren(node);
    const style = styleOf(node.attrs);
    return style ? `<span style="${style}">${content}</span>` : content;
  },
});

export const markExtensions = [HtmlUnderline, HtmlTextStyle, Color, FontSize, FontWeight];
```
If `@tiptap/extension-underline` is not a separate package in 3.31, import `Underline` from `@tiptap/extensions` instead (check with `ls node_modules/@tiptap`). StarterKit 3 already bundles Underline — configure StarterKit with `underline: false` in `extensions.ts` so ours wins.

- [ ] **Step 5: `align.ts`** — block tokenizer for aligned `p`/`hN`, and render override:
```ts
import { Extension } from '@tiptap/core';
import TextAlign from '@tiptap/extension-text-align';

export const AlignedBlockMarkdown = Extension.create({
  name: 'alignedBlockMarkdown',
  markdownTokenizer: {
    name: 'alignedBlock',
    level: 'block',
    start: (src: string) => src.search(/<(p|h[1-6]) align="/),
    tokenize: (src: string, _t: unknown, lexer: any) => {
      const m = /^<(p|h([1-6])) align="(left|center|right|justify)">([\s\S]*?)<\/\1>\n*/.exec(src);
      return m ? { type: 'alignedBlock', raw: m[0], level: m[2] ? +m[2] : 0, align: m[3], tokens: lexer.inlineTokens(m[4]) } : undefined;
    },
  },
  parseMarkdown: (token: any, h: any) => ({
    type: token.level ? 'heading' : 'paragraph',
    attrs: { textAlign: token.align, ...(token.level ? { level: token.level } : {}) },
    content: h.parseInline(token.tokens || []),
  }),
} as any);

export const alignExtensions = [TextAlign.configure({ types: ['heading', 'paragraph'], alignments: ['left', 'center', 'right', 'justify'] }), AlignedBlockMarkdown];

/** Wraps a paragraph/heading renderer so aligned blocks come out as HTML. */
export function withAlignRender(base: any, tag: (node: any) => string) {
  return base.extend({
    renderMarkdown: (node: any, h: any, ctx: any) => {
      const a = node.attrs?.textAlign;
      if (!a || a === 'left') return base.config.renderMarkdown(node, h, ctx);
      return `<${tag(node)} align="${a}">${h.renderChildren(node)}</${tag(node)}>\n\n`;
    },
  });
}
```
(`base.config.renderMarkdown` is TipTap's stored config for the base node; if the installed version stores it elsewhere, look it up with `grep -n "renderMarkdown" node_modules/@tiptap/extension-paragraph/dist/index.js`.)

- [ ] **Step 6: `locked.ts`** — locked nodes and their tokenizers:
```ts
import { Node, mergeAttributes } from '@tiptap/core';

type BlockKind = 'frontmatter' | 'math' | 'mermaid' | 'footnote' | 'html';
const LABEL: Record<string, string> = { frontmatter: 'Front matter', math: 'Maths', mermaid: 'Mermaid diagram', footnote: 'Footnote', html: 'HTML' };

const blockRules: { kind: BlockKind; re: RegExp; first?: boolean }[] = [
  { kind: 'frontmatter', re: /^---\n[\s\S]*?\n---(\n+|$)/, first: true },
  { kind: 'math', re: /^\$\$\n[\s\S]*?\n\$\$(\n+|$)/ },
  { kind: 'mermaid', re: /^```mermaid\n[\s\S]*?\n```(\n+|$)/ },
  { kind: 'footnote', re: /^\[\^[^\]]+\]:[^\n]*(\n(?: {2,}|\t)[^\n]*)*(\n+|$)/ },
];

export const LockedBlock = Node.create({
  name: 'lockedBlock',
  group: 'block',
  atom: true,
  selectable: true,
  addAttributes() { return { raw: { default: '' }, kind: { default: 'html' } }; },
  parseHTML() { return [{ tag: 'div[data-locked]' }]; },
  renderHTML({ node, HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-locked': node.attrs.kind, class: 'locked-block', title: `${LABEL[node.attrs.kind]}: double-click to edit in Source` }), ['pre', {}, node.attrs.raw.trimEnd()]];
  },
  markdownTokenizer: {
    name: 'lockedBlock',
    level: 'block',
    start: (src: string) => {
      const i = src.search(/^(---\n|\$\$\n|```mermaid\n|\[\^)/m);
      return i;
    },
    tokenize: (src: string, tokens: unknown[]) => {
      for (const r of blockRules) {
        if (r.first && tokens.length > 0) continue;
        const m = r.re.exec(src);
        if (m) return { type: 'lockedBlock', raw: m[0], kind: r.kind };
      }
      return undefined;
    },
  },
  parseMarkdown: (token: any) => ({ type: 'lockedBlock', attrs: { raw: token.raw.replace(/\n+$/, ''), kind: token.kind } }),
  renderMarkdown: (node: any) => `${node.attrs.raw}\n\n`,
} as any);

export const LockedInline = Node.create({
  name: 'lockedInline',
  group: 'inline',
  inline: true,
  atom: true,
  addAttributes() { return { raw: { default: '' }, kind: { default: 'html' } }; },
  parseHTML() { return [{ tag: 'span[data-locked]' }]; },
  renderHTML({ node, HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes, { 'data-locked': node.attrs.kind, class: 'locked-inline' }), node.attrs.raw];
  },
  markdownTokenizer: {
    name: 'lockedInline',
    level: 'inline',
    start: (src: string) => src.search(/\$|\[\^/),
    tokenize: (src: string) => {
      const m = /^\$(?!\s)[^$\n]+?\$(?!\d)/.exec(src) || /^\[\^[^\]]+\](?!:)/.exec(src);
      return m ? { type: 'lockedInline', raw: m[0], kind: m[0][0] === '$' ? 'math' : 'footnote-ref' } : undefined;
    },
  },
  parseMarkdown: (token: any) => ({ type: 'lockedInline', attrs: { raw: token.raw, kind: token.kind } }),
  renderMarkdown: (node: any) => node.attrs.raw,
} as any);

/** Any raw HTML marked emits that no other rule claimed. */
export const RawHtml = Node.create({
  name: 'rawHtmlCatcher',
  markdownTokenName: 'html',
  parseMarkdown: (token: any) =>
    token.block
      ? { type: 'lockedBlock', attrs: { raw: token.raw.replace(/\n+$/, ''), kind: 'html' } }
      : { type: 'lockedInline', attrs: { raw: token.raw, kind: 'html' } },
} as any);

export const lockedExtensions = [LockedBlock, LockedInline, RawHtml];
```

- [ ] **Step 7: `extensions.ts`**
```ts
import type { AnyExtension, Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Paragraph from '@tiptap/extension-paragraph';
import Heading from '@tiptap/extension-heading';
import { Markdown } from '@tiptap/markdown';
import { TaskList, TaskItem } from '@tiptap/extension-list';
import { TableKit } from '@tiptap/extension-table';
import { Placeholder } from '@tiptap/extensions';
import { markExtensions } from './marks';
import { alignExtensions, withAlignRender } from './align';
import { lockedExtensions } from './locked';

export function visualExtensions(opts: { placeholder?: string } = {}): AnyExtension[] {
  return [
    StarterKit.configure({ underline: false, paragraph: false, heading: false, link: { openOnClick: false, autolink: true } }),
    withAlignRender(Paragraph, () => 'p'),
    withAlignRender(Heading, (n) => `h${n.attrs.level}`),
    ...lockedExtensions, // registered before code/html handlers so they win
    ...markExtensions,
    ...alignExtensions,
    TaskList,
    TaskItem.configure({ nested: true }),
    TableKit.configure({ table: { resizable: false } }),
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
```

- [ ] **Step 8: Run** `npx vitest run src/editor/visual` and iterate until every test passes. Rules while iterating: a failing case must be fixed in the extension (tokenizer/renderer), never by loosening the test; the only permitted normalisation is trailing whitespace (`trim()` already applied). If `@tiptap/markdown` emits `*` for italics where the source uses `*`, fine; if the source in a test uses a style TipTap can't reproduce, change the **test input** to TipTap's canonical style and add a comment explaining the accepted normalisation from the spec's trade-off section.

- [ ] **Step 9: Run full suite** `npx vitest run && npm run typecheck` → PASS.

- [ ] **Step 10: Commit**
```bash
git add package.json package-lock.json src/editor/visual
git commit -m "feat: TipTap visual engine with lossless locked blocks and HTML-backed formatting"
```

---

### Task 7: Visual view in the app — sync, view switching, undo routing

**Files:**
- Create: `src/editor/visual/sync.ts`, `src/editor/visual/sync.test.ts`, `src/ui/VisualEditor.tsx`, `src/styles/visual.css`
- Modify: `src/ui/EditorPane.tsx`, `src/ui/MenuBar.tsx`, `src/state/app.ts` (`cmd.undo/redo/find/replace`, `saveDoc`, `flushAll`), `src/main.tsx` (import css), `src/ui/Settings.tsx` (Markdown default view options)

**Interfaces:**
- Consumes: `visualExtensions`, `parseMarkdownToEditor`, `editorToMarkdown` (Task 6); `getView`, `textOf`, `activeDoc`, `setMdView`, `editTick` (app.ts).
- Produces: `minimalChange(oldText: string, newText: string): { from: number; to: number; insert: string } | null`; `visualApi` signal-less registry in `sync.ts`:
  ```ts
  export const visualApi: { editor: Editor | null; flush: () => void; undo: () => boolean; redo: () => boolean } =
    { editor: null, flush: () => {}, undo: () => false, redo: () => false };
  ```

- [ ] **Step 1: Failing test** — `sync.test.ts`
```ts
import { describe, it, expect } from 'vitest';
import { minimalChange } from './sync';

describe('minimalChange', () => {
  it('null when equal', () => expect(minimalChange('abc', 'abc')).toBeNull());
  it('insert in middle', () => expect(minimalChange('abcd', 'abXcd')).toEqual({ from: 2, to: 2, insert: 'X' }));
  it('delete at end', () => expect(minimalChange('abcd', 'ab')).toEqual({ from: 2, to: 4, insert: '' }));
  it('replace with overlap of repeated chars', () => expect(minimalChange('aaa', 'aaaa')).toEqual({ from: 3, to: 3, insert: 'a' }));
  it('whole replace', () => expect(minimalChange('abc', 'xyz')).toEqual({ from: 0, to: 3, insert: 'xyz' }));
});
```

- [ ] **Step 2: Run** → FAIL.

- [ ] **Step 3: Implement** `sync.ts`
```ts
import type { Editor } from '@tiptap/core';

export function minimalChange(a: string, b: string) {
  if (a === b) return null;
  let s = 0;
  const max = Math.min(a.length, b.length);
  while (s < max && a.charCodeAt(s) === b.charCodeAt(s)) s++;
  let ea = a.length, eb = b.length;
  while (ea > s && eb > s && a.charCodeAt(ea - 1) === b.charCodeAt(eb - 1)) { ea--; eb--; }
  return { from: s, to: ea, insert: b.slice(s, eb) };
}

export const visualApi: { editor: Editor | null; flush: () => void; undo: () => boolean; redo: () => boolean } = {
  editor: null, flush: () => {}, undo: () => false, redo: () => false,
};
```

- [ ] **Step 4: Run** → PASS.

- [ ] **Step 5: `VisualEditor.tsx`**
```tsx
import { useEffect, useRef } from 'preact/hooks';
import { useSignalEffect } from '@preact/signals';
import { Editor } from '@tiptap/core';
import { activeDoc, editTick, getView, textOf, setMdView } from '../state/app';
import { visualExtensions, parseMarkdownToEditor, editorToMarkdown } from '../editor/visual/extensions';
import { minimalChange, visualApi } from '../editor/visual/sync';

export function VisualEditor() {
  const host = useRef<HTMLDivElement>(null);
  const edRef = useRef<Editor | null>(null);
  const shown = useRef<{ id: string; text: string } | null>(null); // text last parsed or written
  const timer = useRef<ReturnType<typeof setTimeout>>();

  const flush = () => {
    clearTimeout(timer.current);
    const ed = edRef.current, v = getView(), cur = shown.current;
    if (!ed || !v || !cur || activeDoc.value?.id !== cur.id || !ed.isEditable) return;
    if (!(ed as any).__dirty) return;
    (ed as any).__dirty = false;
    const md = editorToMarkdown(ed);
    const ch = minimalChange(v.state.doc.toString(), md);
    shown.current = { id: cur.id, text: md };
    if (ch) v.dispatch({ changes: ch });
  };

  useEffect(() => {
    const ed = new Editor({
      element: host.current!,
      extensions: visualExtensions(),
      editorProps: { attributes: { class: 'markdown-body', spellcheck: 'false' } },
      onUpdate: () => {
        (ed as any).__dirty = true;
        clearTimeout(timer.current);
        timer.current = setTimeout(flush, 150);
      },
    });
    ed.view.dom.addEventListener('dblclick', (e) => {
      const el = (e.target as HTMLElement).closest('[data-locked]');
      const id = activeDoc.value?.id;
      if (el && id) setMdView(id, 'edit');
    });
    edRef.current = ed;
    visualApi.editor = ed;
    visualApi.flush = flush;
    visualApi.undo = () => ed.commands.undo();
    visualApi.redo = () => ed.commands.redo();
    return () => {
      flush();
      visualApi.editor = null;
      visualApi.flush = () => {};
      visualApi.undo = visualApi.redo = () => false;
      ed.destroy();
    };
  }, []);

  // Re-parse when the tab changes or its text changed outside Visual (Source edit, reload, quick note).
  useSignalEffect(() => {
    editTick.value;
    const d = activeDoc.value;
    const ed = edRef.current;
    if (!d || !ed) return;
    const text = textOf(d.id);
    if (shown.current?.id === d.id && shown.current.text === text) return;
    if (shown.current && shown.current.id !== d.id) flush();
    parseMarkdownToEditor(ed, text);
    (ed as any).__dirty = false;
    shown.current = { id: d.id, text };
    ed.setEditable(!d.readonly);
  });

  return <div class="visual-editor" ref={host} />;
}
```

- [ ] **Step 6: `EditorPane.tsx`** — layout per view:
```tsx
const view = d?.language === 'markdown' ? d.mdView : 'edit';
// …
<div class="editor-split">
  <div class="editor-host" ref={host}
    style={view === 'split' ? { flex: `0 0 ${split * 100}%` } : view === 'visual' ? { display: 'none' } : undefined} />
  {view === 'split' && <div class="split-divider" onPointerDown={(e) => onDivider(e as PointerEvent)} />}
  {view === 'split' && <Preview syncRef={syncRef} />}
  {view === 'visual' && <VisualEditor />}
</div>
```
In `Preview`'s signal effect change the guard to `if (!doc || doc.language !== 'markdown' || doc.mdView !== 'split') return;`.

- [ ] **Step 7: Segmented control (`MenuBar.tsx`)** — three buttons: `visual` (IcEye, "Visual"), `edit` (IcPencil, "Source"), `split` (IcSplit, "Split"). Titles: "Visual editing", "Markdown source", "Source and preview side by side (Ctrl+Shift+V cycles)". Update the View ▸ Markdown submenu to the same three entries. `Settings.tsx` Markdown default view options: `[['visual','Visual (WYSIWYG)'],['edit','Source'],['split','Source and preview side by side']]`.

- [ ] **Step 8: Routing in `app.ts`**
  - `import { visualApi } from '../editor/visual/sync';`
  - `const inVisual = () => activeDoc.value?.language === 'markdown' && activeDoc.value.mdView === 'visual' && !!visualApi.editor;`
  - `cmd.undo: () => (inVisual() ? visualApi.undo() : withView((v) => undo(v)))`, same for `redo`.
  - `cmd.find` / `cmd.replace`: `if (inVisual()) { visualApi.flush(); setMdView(activeId.value!, 'edit'); }` then the existing behaviour (queued with `queueMicrotask`).
  - `saveDoc` first line: `visualApi.flush();` (before `textOf`). Same at the top of `flushAll` and `stashActive`.

- [ ] **Step 9: `visual.css`** (imported in `main.tsx` after `markdown.css`)
```css
.visual-editor { flex: 1 1 auto; overflow-y: auto; background: var(--bg-editor); }
.visual-editor .ProseMirror { outline: none; min-height: 100%; user-select: text; }
.visual-editor .ProseMirror p.is-editor-empty:first-child::before { content: attr(data-placeholder); color: var(--text-3); float: left; height: 0; pointer-events: none; }
.visual-editor .locked-block { border: 1px dashed var(--stroke-strong); border-radius: 8px; padding: 8px 12px; margin: 0 0 16px; background: var(--bg-status); cursor: default; position: relative; }
.visual-editor .locked-block::before { content: attr(data-locked); position: absolute; top: -9px; left: 10px; font: 11px var(--ui-font); padding: 0 6px; background: var(--bg-editor); color: var(--text-3); }
.visual-editor .locked-block pre { margin: 0; border: 0; background: none; padding: 0; white-space: pre-wrap; }
.visual-editor .locked-inline { font-family: Consolas, monospace; font-size: .9em; padding: 0 3px; border-radius: 4px; background: var(--bg-hover); }
.visual-editor ul[data-type="taskList"] { list-style: none; padding-left: 0.4em; }
.visual-editor ul[data-type="taskList"] li { display: flex; gap: 6px; }
.visual-editor .ProseMirror-selectednode { outline: 2px solid var(--accent); }
.visual-editor table { border-collapse: collapse; }
.visual-editor td, .visual-editor th { border: 1px solid var(--stroke-strong); padding: 6px 13px; min-width: 60px; }
```

- [ ] **Step 10: Verify** — `npm run typecheck && npx vitest run`. In `npx tauri dev`:
  1. New Markdown file (Ctrl+Alt+N) opens in Visual; type `Hello`, Ctrl+B mid-word; switch to Source → `**…**` present.
  2. Open an existing `.md` with front matter + mermaid: switch Visual → Source → Visual without typing; title bar has no `*` (not dirty).
  3. Type in Visual and immediately Ctrl+S; reopen the file from disk: last character present.
  4. Ctrl+Z in Visual undoes the last Visual step only.
  5. Double-click a locked block → Source view.
  Write the results of 1–5 in the commit message body.

- [ ] **Step 11: Commit**
```bash
git add src
git commit -m "feat: Visual (WYSIWYG) view for Markdown with CodeMirror sync and undo routing"
```

---

### Task 8: Formatting toolbar and targets

**Files:**
- Create: `src/editor/format.ts`, `src/editor/format.test.ts`, `src/ui/FormatBar.tsx`
- Modify: `src/ui/App.tsx`, `src/styles/app.css`, `src/editor/setup.ts` (plain Ctrl+]/[ in plain text)

**Interfaces:**
- Consumes: Task 5 commands, Task 6/7 `visualApi.editor`, `convertToMarkdown`, `updateSettings`, `refreshView`, `getView`.
- Produces:
  ```ts
  export type FormatCommand =
    | 'bold' | 'italic' | 'underline' | 'strike' | 'code'
    | 'color' | 'fontSize' | 'fontWeight'
    | 'body' | 'h1' | 'h2' | 'h3' | 'quote' | 'codeBlock'
    | 'alignLeft' | 'alignCenter' | 'alignRight' | 'alignJustify'
    | 'bullet' | 'number' | 'check' | 'indent' | 'outdent'
    | 'link' | 'table' | 'rule' | 'wrap';
  export interface FormatTarget { can(c: FormatCommand): boolean; isActive(c: FormatCommand): boolean; run(c: FormatCommand, arg?: unknown): void; }
  export function targetFor(d: DocMeta | null): FormatTarget;
  export const PLAIN_ALLOWED: ReadonlySet<FormatCommand>;
  ```

- [ ] **Step 1: Failing test** — `format.test.ts`
```ts
import { describe, it, expect, vi } from 'vitest';
vi.mock('../platform', () => ({ platform: {} }));
import { PLAIN_ALLOWED, plainTarget } from './format';

describe('plain text target', () => {
  it('only allows plain-safe commands', () => {
    expect([...PLAIN_ALLOWED].sort()).toEqual(['fontSize', 'fontWeight', 'indent', 'outdent', 'wrap']);
    expect(plainTarget.can('bold')).toBe(false);
    expect(plainTarget.can('wrap')).toBe(true);
  });
});
```

- [ ] **Step 2: Run** → FAIL.

- [ ] **Step 3: Implement** `format.ts`
```ts
import type { DocMeta } from '../state/app';
import { getView, refreshView } from '../state/app';
import { settings, updateSettings } from '../state/settings';
import { visualApi } from './visual/sync';
import * as C from './md-commands';

export type FormatCommand =
  | 'bold' | 'italic' | 'underline' | 'strike' | 'code'
  | 'color' | 'fontSize' | 'fontWeight'
  | 'body' | 'h1' | 'h2' | 'h3' | 'quote' | 'codeBlock'
  | 'alignLeft' | 'alignCenter' | 'alignRight' | 'alignJustify'
  | 'bullet' | 'number' | 'check' | 'indent' | 'outdent'
  | 'link' | 'table' | 'rule' | 'wrap';
export interface FormatTarget { can(c: FormatCommand): boolean; isActive(c: FormatCommand): boolean; run(c: FormatCommand, arg?: unknown): void; }

export const PLAIN_ALLOWED: ReadonlySet<FormatCommand> = new Set(['wrap', 'indent', 'outdent', 'fontSize', 'fontWeight']);

function common(c: FormatCommand, arg: unknown): boolean {
  if (c === 'wrap') { updateSettings({ wordWrap: !settings.value.wordWrap }); refreshView(); return true; }
  return false;
}

export const plainTarget: FormatTarget = {
  can: (c) => PLAIN_ALLOWED.has(c),
  isActive: (c) => c === 'wrap' && settings.value.wordWrap,
  run(c, arg) {
    if (common(c, arg)) return;
    const v = getView();
    if (c === 'fontSize') { updateSettings({ fontSize: Number(arg) }); refreshView(); }
    else if (c === 'fontWeight') { updateSettings({ fontWeight: Number(arg) }); refreshView(); }
    else if (v && c === 'indent') C.indentLines(v, 1);
    else if (v && c === 'outdent') C.indentLines(v, -1);
    v?.focus();
  },
};

export const sourceTarget: FormatTarget = {
  can: () => !!getView(),
  isActive: (c) => c === 'wrap' && settings.value.wordWrap,
  run(c, arg) {
    if (common(c, arg)) return;
    const v = getView();
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
      case 'table': { const [r, k] = (arg as [number, number]) ?? [2, 2]; C.insertTable(v, r, k); break; }
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
    switch (c) {
      case 'bold': return e.isActive('bold');
      case 'italic': return e.isActive('italic');
      case 'underline': return e.isActive('underline');
      case 'strike': return e.isActive('strike');
      case 'code': return e.isActive('code');
      case 'h1': case 'h2': case 'h3': return e.isActive('heading', { level: +c[1] });
      case 'quote': return e.isActive('blockquote');
      case 'codeBlock': return e.isActive('codeBlock');
      case 'body': return e.isActive('paragraph') && !e.isActive('blockquote');
      case 'alignCenter': return e.isActive({ textAlign: 'center' });
      case 'alignRight': return e.isActive({ textAlign: 'right' });
      case 'alignJustify': return e.isActive({ textAlign: 'justify' });
      case 'alignLeft': return !['center', 'right', 'justify'].some((a) => e.isActive({ textAlign: a }));
      case 'bullet': return e.isActive('bulletList');
      case 'number': return e.isActive('orderedList');
      case 'check': return e.isActive('taskList');
      case 'link': return e.isActive('link');
      case 'wrap': return settings.value.wordWrap;
      default: return false;
    }
  },
  run(c, arg) {
    if (common(c, arg)) return;
    const e = visualApi.editor;
    if (!e) return;
    const ch = e.chain().focus() as any;
    const s = String(arg ?? '');
    switch (c) {
      case 'bold': ch.toggleBold(); break;
      case 'italic': ch.toggleItalic(); break;
      case 'underline': ch.toggleUnderline(); break;
      case 'strike': ch.toggleStrike(); break;
      case 'code': ch.toggleCode(); break;
      case 'color': s ? ch.setColor(s) : ch.unsetColor(); break;
      case 'fontSize': ch.setFontSize(`${s}px`); break;
      case 'fontWeight': ch.setMark('textStyle', { fontWeight: s === '400' ? null : s }); break;
      case 'body': ch.setParagraph(); break;
      case 'h1': case 'h2': case 'h3': ch.toggleHeading({ level: +c[1] }); break;
      case 'quote': ch.toggleBlockquote(); break;
      case 'codeBlock': ch.toggleCodeBlock(); break;
      case 'alignLeft': ch.unsetTextAlign(); break;
      case 'alignCenter': ch.setTextAlign('center'); break;
      case 'alignRight': ch.setTextAlign('right'); break;
      case 'alignJustify': ch.setTextAlign('justify'); break;
      case 'bullet': ch.toggleBulletList(); break;
      case 'number': ch.toggleOrderedList(); break;
      case 'check': ch.toggleTaskList(); break;
      case 'indent': e.isActive('taskItem') ? ch.sinkListItem('taskItem') : ch.sinkListItem('listItem'); break;
      case 'outdent': e.isActive('taskItem') ? ch.liftListItem('taskItem') : ch.liftListItem('listItem'); break;
      case 'link': {
        const prev = e.getAttributes('link').href ?? 'https://';
        const url = window.prompt('Link address', prev);
        if (url === null) return;
        url ? ch.extendMarkRange('link').setLink({ href: url }) : ch.extendMarkRange('link').unsetLink();
        break;
      }
      case 'table': { const [r, k] = (arg as [number, number]) ?? [2, 2]; ch.insertTable({ rows: r + 1, cols: k, withHeaderRow: true }); break; }
      case 'rule': ch.setHorizontalRule(); break;
    }
    ch.run();
  },
};

export function targetFor(d: DocMeta | null): FormatTarget {
  if (!d || d.language !== 'markdown') return plainTarget;
  return d.mdView === 'visual' ? visualTarget : sourceTarget;
}
```
Replace the `window.prompt` in `link` with the app's own `ask({ title: 'Link', input: { value: prev, label: 'Address' }, buttons: [...] })` from `state/ui` (async; restructure the case as `void (async () => { … })()` and run the chain inside).

- [ ] **Step 4: Run** `npx vitest run src/editor/format.test.ts` → PASS.

- [ ] **Step 5: `FormatBar.tsx`** — one component; re-renders on `editTick`, `activeDoc`, `settings` and TipTap `selectionUpdate`/`transaction` (subscribe via a `tick` state bumped from `visualApi.editor.on('transaction')` inside a `useEffect` keyed on the active doc + view).
```tsx
import { useEffect, useState } from 'preact/hooks';
import { activeDoc, editTick, convertToMarkdown } from '../state/app';
import { settings } from '../state/settings';
import { targetFor, type FormatCommand } from '../editor/format';
import { visualApi } from '../editor/visual/sync';
import * as I from './icons';

const SWATCHES = ['#000000', '#5f6368', '#d93025', '#e37400', '#188038', '#1a73e8', '#9334e6', '#d01884', '#007b83'];
const SIZES = [10, 12, 14, 16, 18, 20, 24, 28, 32, 40];

export function FormatBar() {
  const d = activeDoc.value;
  editTick.value; settings.value;
  const [, bump] = useState(0);
  useEffect(() => {
    const e = visualApi.editor;
    if (!e) return;
    const f = () => bump((n) => n + 1);
    e.on('transaction', f);
    return () => e.off('transaction', f);
  }, [d?.id, d?.mdView, visualApi.editor]);
  const t = targetFor(d);
  const B = ({ c, icon, label, arg }: { c: FormatCommand; icon: any; label: string; arg?: unknown }) => (
    <button class={`fb-btn${t.isActive(c) ? ' on' : ''}`} disabled={!t.can(c)} title={label}
      onMouseDown={(e) => e.preventDefault()} onClick={() => t.run(c, arg)}>{icon}</button>
  );
  const [tablePick, setTablePick] = useState<[number, number] | null>(null);
  const [colorOpen, setColorOpen] = useState(false);
  const blockValue = (['h1', 'h2', 'h3', 'quote', 'codeBlock'] as FormatCommand[]).find((c) => t.isActive(c)) ?? 'body';
  return (
    <div class="formatbar" role="toolbar" aria-label="Formatting">
      <select class="fb-select" disabled={!t.can('h1')} value={blockValue} title="Paragraph style"
        onChange={(e) => t.run((e.target as HTMLSelectElement).value as FormatCommand)}>
        <option value="body">Body</option><option value="h1">Heading 1</option><option value="h2">Heading 2</option>
        <option value="h3">Heading 3</option><option value="quote">Quote</option><option value="codeBlock">Code block</option>
      </select>
      <span class="fb-sep" />
      <select class="fb-select fb-narrow" disabled={!t.can('fontSize')} title="Font size"
        value={d?.language === 'markdown' ? '' : String(settings.value.fontSize)}
        onChange={(e) => t.run('fontSize', (e.target as HTMLSelectElement).value)}>
        {d?.language === 'markdown' && <option value="">Size</option>}
        {SIZES.map((n) => <option value={n}>{n}</option>)}
      </select>
      <select class="fb-select" disabled={!t.can('fontWeight')} title="Font weight"
        value={d?.language === 'markdown' ? '' : String(settings.value.fontWeight)}
        onChange={(e) => t.run('fontWeight', (e.target as HTMLSelectElement).value)}>
        {d?.language === 'markdown' && <option value="">Weight</option>}
        <option value="300">Light</option><option value="400">Regular</option><option value="600">Semibold</option><option value="700">Bold</option>
      </select>
      <span class="fb-sep" />
      <B c="bold" icon={<I.IcBold />} label="Bold (Ctrl+B)" />
      <B c="italic" icon={<I.IcItalic />} label="Italic (Ctrl+I)" />
      <B c="underline" icon={<I.IcUnderline />} label="Underline (Ctrl+U)" />
      <B c="strike" icon={<I.IcStrike />} label="Strikethrough (Ctrl+Shift+X)" />
      <div class="fb-pop-anchor">
        <button class="fb-btn" disabled={!t.can('color')} title="Font colour" onMouseDown={(e) => e.preventDefault()} onClick={() => setColorOpen(!colorOpen)}><I.IcColor /></button>
        {colorOpen && (
          <div class="fb-pop" onMouseDown={(e) => e.preventDefault()}>
            {SWATCHES.map((c) => <button class="fb-swatch" style={{ background: c }} title={c} onClick={() => { t.run('color', c); setColorOpen(false); }} />)}
            <input type="color" title="Custom colour" onChange={(e) => { t.run('color', (e.target as HTMLInputElement).value); setColorOpen(false); }} />
          </div>
        )}
      </div>
      <B c="code" icon={<I.IcCode />} label="Inline code" />
      <span class="fb-sep" />
      <B c="alignLeft" icon={<I.IcAlignLeft />} label="Align left" />
      <B c="alignCenter" icon={<I.IcAlignCenter />} label="Centre" />
      <B c="alignRight" icon={<I.IcAlignRight />} label="Align right" />
      <B c="alignJustify" icon={<I.IcAlignJustify />} label="Justify" />
      <span class="fb-sep" />
      <B c="bullet" icon={<I.IcListBullet />} label="Bulleted list (Ctrl+Shift+8)" />
      <B c="number" icon={<I.IcListNumber />} label="Numbered list (Ctrl+Shift+7)" />
      <B c="check" icon={<I.IcListCheck />} label="Checklist" />
      <B c="outdent" icon={<I.IcOutdent />} label="Decrease indent (Ctrl+[)" />
      <B c="indent" icon={<I.IcIndent />} label="Increase indent (Ctrl+])" />
      <span class="fb-sep" />
      <B c="link" icon={<I.IcLink />} label="Link (Ctrl+K)" />
      <div class="fb-pop-anchor">
        <button class="fb-btn" disabled={!t.can('table')} title="Insert table" onMouseDown={(e) => e.preventDefault()} onClick={() => setTablePick(tablePick ? null : [0, 0])}><I.IcTable /></button>
        {tablePick && (
          <div class="fb-pop fb-grid" onMouseLeave={() => setTablePick([0, 0])}>
            {Array.from({ length: 64 }, (_, i) => {
              const r = Math.floor(i / 8) + 1, c = (i % 8) + 1;
              const on = r <= tablePick[0] && c <= tablePick[1];
              return <button class={`fb-cell${on ? ' on' : ''}`} onMouseEnter={() => setTablePick([r, c])} onClick={() => { t.run('table', [r, c]); setTablePick(null); }} />;
            })}
            <div class="fb-grid-label">{tablePick[0] ? `${tablePick[0]} × ${tablePick[1]}` : 'Pick a size'}</div>
          </div>
        )}
      </div>
      <B c="rule" icon={<I.IcRule />} label="Horizontal line" />
      <span class="fb-sep" />
      <B c="wrap" icon={<I.IcWrap />} label="Word wrap" />
      {d && d.language === 'plain' && (
        <button class="fb-convert" onClick={() => convertToMarkdown(d.id)}><I.IcConvert /> Convert to Markdown</button>
      )}
    </div>
  );
}
```
Close popovers on outside `pointerdown` with a `useEffect` window listener (same pattern as `MenuBar`).

- [ ] **Step 6: Mount** — `App.tsx`: `<MenuBar />` then `<FormatBar />`.

- [ ] **Step 7: TipTap shortcuts** — TipTap already binds Mod-b/i/u, Mod-Shift-x (strike), Mod-Shift-7/8 (lists), Mod-Alt-0..3 (paragraph/headings). Add a tiny extension in `extensions.ts`:
```ts
const ExtraKeys = Extension.create({
  name: 'extraKeys',
  addKeyboardShortcuts() {
    return {
      'Mod-]': () => this.editor.commands.sinkListItem('listItem') || this.editor.commands.sinkListItem('taskItem'),
      'Mod-[': () => this.editor.commands.liftListItem('listItem') || this.editor.commands.liftListItem('taskItem'),
      'Mod-k': () => { document.querySelector<HTMLButtonElement>('.formatbar [title^="Link"]')?.click(); return true; },
    };
  },
});
```
and include `ExtraKeys` in `visualExtensions`. In `setup.ts` add a plain-text keymap (always on, lower precedence than the Markdown one): `{ key: 'Mod-]', run: (v) => indentLines(v, 1) }, { key: 'Mod-[', run: (v) => indentLines(v, -1) }`.

- [ ] **Step 8: CSS**
```css
.formatbar { display: flex; flex-wrap: wrap; align-items: center; gap: 2px; padding: 3px 8px; border-bottom: 1px solid var(--stroke); background: var(--bg-chrome, var(--bg-editor)); }
.fb-btn { width: 30px; height: 28px; display: grid; place-items: center; border-radius: 4px; color: var(--text); }
.fb-btn:hover:not(:disabled) { background: var(--bg-hover); }
.fb-btn.on { background: color-mix(in srgb, var(--accent) 22%, transparent); color: var(--accent-text); }
.fb-btn:disabled, .fb-select:disabled { opacity: .35; }
.fb-select { height: 26px; border-radius: 4px; border: 1px solid var(--stroke); background: var(--bg-input); font-size: 12px; padding: 0 4px; }
.fb-narrow { width: 64px; }
.fb-sep { width: 1px; height: 18px; background: var(--stroke-strong); margin: 0 6px; }
.fb-pop-anchor { position: relative; }
.fb-pop { position: absolute; top: 32px; left: 0; z-index: 50; padding: 8px; border-radius: 8px; background: var(--bg-card); border: 1px solid var(--stroke); box-shadow: 0 8px 24px rgba(0,0,0,.2); display: grid; grid-template-columns: repeat(5, 22px); gap: 6px; }
.fb-swatch { width: 22px; height: 22px; border-radius: 50%; border: 1px solid var(--stroke-strong); }
.fb-grid { grid-template-columns: repeat(8, 16px); gap: 3px; }
.fb-cell { width: 16px; height: 16px; border: 1px solid var(--stroke-strong); border-radius: 2px; }
.fb-cell.on { background: var(--accent); border-color: var(--accent); }
.fb-grid-label { grid-column: 1 / -1; text-align: center; font-size: 12px; color: var(--text-2); }
.fb-convert { margin-left: auto; display: inline-flex; align-items: center; gap: 6px; height: 26px; padding: 0 10px; border-radius: 4px; font-size: 12px; background: var(--accent); color: #fff; }
```

- [ ] **Step 9: Verify** — `npm run typecheck && npx vitest run`. In `npx tauri dev`, for each of (a) Visual `.md`, (b) Source `.md`, (c) `.txt`: click every toolbar control and confirm the result, confirm disabled states on `.txt`, confirm the bold/heading/list/align buttons light up with the cursor in Visual, Convert to Markdown on a saved `.txt` offers Save as `.md`, table grid inserts the picked size, colour custom picker works, the toolbar wraps to two rows at a narrow window and at 150 % UI scale.

- [ ] **Step 10: Commit**
```bash
git add src
git commit -m "feat: formatting toolbar driving Visual, Source and plain-text targets"
```

---

### Task 9: Final verification, docs, release build

**Files:**
- Modify: `README.md` (app), `docs/superpowers/plans/2026-09-28-editor-toolbar-wysiwyg.md` (tick boxes)

- [ ] **Step 1: Full checks**
```bash
npm run typecheck
npx vitest run
cargo test --manifest-path src-tauri/Cargo.toml --lib
```
All must pass; paste the summary lines into the commit body.

- [ ] **Step 2: README** — in the feature list add bullets for: formatting toolbar (and what it does on `.txt`), Visual/Source/Split, Interface size slider, TXT/MD badges, file colours, New text file / New Markdown file and their shortcuts. Update "Markdown:" bullet: Edit/Split/Preview → Visual/Source/Split; add the accepted trade-off sentence ("After an edit in Visual, Markdown syntax is normalised…").

- [ ] **Step 3: Release build** — `npx tauri build`; confirm both installers are produced.

- [ ] **Step 4: Commit and push**
```bash
git add -A
git commit -m "docs: README for toolbar, Visual view, UI scale, badges and colours"
git push origin main
```
