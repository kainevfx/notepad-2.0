# Formatting toolbar, UI scale, sidebar polish, file colours, WYSIWYG Markdown

Date: 2026-09-28
Status: approved design, awaiting spec review
App: `app/` (Tauri 2 + Preact + CodeMirror 6)

## Goal

Make Notepad 2.0 feel like a document editor without losing its Notepad core:

1. A formatting toolbar across the top.
2. A slider that scales the whole UI (compact ↔ roomy).
3. A sidebar whose search has its own row and whose buttons carry text labels.
4. "New text file" and "New Markdown file" instead of "New note".
5. Every tab shows whether it is a text or Markdown file.
6. Right-click a file to give it a colour.
7. Type and edit directly in rendered Markdown (true WYSIWYG).

## Decisions already made

| Question | Decision |
|---|---|
| Formatting tools on a `.txt` file | Grey out anything that can't be stored in plain text; show a **Convert to Markdown** button. |
| Editing in the preview | True WYSIWYG, not Obsidian-style live preview. |
| WYSIWYG engine | TipTap 3 (`@tiptap/core` 3.31 + `@tiptap/markdown`). |
| Formatting Markdown can't express | Stored as inline HTML in the `.md` (`<u>`, `<span style>`, `<p align>`). |

## 1. Formatting toolbar

New component `ui/FormatBar.tsx`, rendered in `App.tsx` directly under `MenuBar`. Groups separated by thin dividers; wraps to a second row when narrow (flex-wrap, no horizontal scroll).

| Group | Controls |
|---|---|
| Style | Dropdown: Body, Heading 1, Heading 2, Heading 3, Quote, Code block |
| Font | Size (number box + dropdown), Weight (Light 300 / Regular 400 / Semibold 600 / Bold 700) |
| Text | Bold, Italic, Underline, Strikethrough, Font colour (swatch palette + custom), Inline code |
| Paragraph | Align left / centre / right / justify |
| Lists | Bullet list, Numbered list, Checklist, Decrease indent, Increase indent |
| Insert | Link, Table (rows × columns grid picker, up to 8×8), Horizontal rule |
| View | Word wrap toggle |
| (end) | **Convert to Markdown** (only on plain-text tabs) |

Every button shows a tooltip with its name and shortcut. Buttons reflect state (bold is highlighted when the cursor is in bold text).

### Command routing

`FormatBar` never touches an editor directly. It calls a small interface:

```ts
// editor/format.ts
interface FormatTarget {
  can(cmd: FormatCommand): boolean;      // drives disabled state
  isActive(cmd: FormatCommand): boolean; // drives pressed state
  run(cmd: FormatCommand, arg?: unknown): void;
}
```

Three implementations, chosen by the active tab:

| Active tab | Target | Behaviour |
|---|---|---|
| Markdown, Visual view | `TiptapTarget` | TipTap chain commands; everything enabled. |
| Markdown, Source / Split view | `MarkdownSourceTarget` | Inserts Markdown syntax in CodeMirror (extends the existing `wrapWith` / `insertLink`). Underline/colour/size/align insert the HTML tags from §4. |
| Plain text | `PlainTarget` | Only Word wrap, Indent / Outdent (tab insert/remove on selected lines) and Font size / weight (change the global editor font, same as Notepad's Font setting). Everything else `can() === false`. |

Existing shortcuts keep working: Ctrl+B, Ctrl+I, Ctrl+K. Added: Ctrl+U underline, Ctrl+Shift+X strikethrough, Ctrl+Shift+7 / 8 numbered / bullet list, Ctrl+] / Ctrl+[ indent / outdent, Ctrl+Alt+1..3 headings, Ctrl+Alt+0 body.

**Convert to Markdown**: switches the tab's language to Markdown (`setLanguage`). For a file with a path, it asks whether to also Save As `.md`; untitled notes just flip.

## 2. UI scale slider

- New setting `uiScale: number` (percent, 75–150, step 5, default 100).
- Applied with Tauri's native webview zoom (`getCurrentWebview().setZoom(uiScale / 100)`), so every element scales together and CodeMirror/TipTap measure correctly. In the browser build (`platform/mock.ts`) it falls back to CSS `zoom` on `<html>`.
- New platform method `setUiScale(factor: number)`; the capability file gets `core:webview:allow-set-webview-zoom`.
- Controls: a compact slider with a percentage label at the right of the status bar, plus the same slider in Settings > Appearance. Double-clicking the label resets it to 100%.
- Separate from text zoom (Ctrl +/−), which keeps working as before.

## 3. Sidebar, file types, colours

### Sidebar layout (`ui/Sidebar.tsx`)
- Row 1: search box, full width.
- Row 2: labelled buttons **+ Text file**, **+ Markdown file**, **+ Group**, then the collapse chevron at the right. Labels hide (icons only, tooltips stay) only when the sidebar is narrower than the labels fit.

### New file types
- `newNote(opts)` gains `language?: 'plain' | 'markdown'`.
- File menu: "New tab" becomes **New text file (Ctrl+N)** and **New Markdown file (Ctrl+Alt+N)** (Ctrl+Shift+N stays Quick Note; Ctrl+T stays a second shortcut for a new text file). The same two entries replace "New note" wherever it appears (menus, context menus, empty states).
- A new Markdown note opens in Visual view.

### Type badge
- Every tab, including untitled ones, shows a small pill: **TXT** or **MD**, based on `language`. For opened files with other extensions (`.log`, `.json`, …) the pill shows that extension instead, as the current `ext-badge` does.
- Shown in the left sidebar rows, the rail peek, and the top tab strip (`TabStrip.tsx`).

### File colour
- `DocMeta` gains `color?: GroupColor` (same 9-colour palette as groups). Persisted automatically via `session.json`.
- Right-click menu on a file (`noteMenu` in `ui/menus.ts`) gets **Colour ▸** None / Grey / Blue / Red / Yellow / Green / Pink / Purple / Cyan / Orange, with swatches and a check on the current one.
- Shown as a 3px stripe on the left edge of the sidebar row and the top tab, using the same light/dark palette values as groups.

## 4. WYSIWYG Markdown (TipTap 3)

### Views
`MdView` becomes `'visual' | 'edit' | 'split'`. Labels in the segmented control: **Visual | Source | Split**.
- **Visual**: TipTap editor only. Default for Markdown files (`mdDefaultView` default changes to `'visual'`).
- **Source** (`'edit'`): CodeMirror only, unchanged.
- **Split**: CodeMirror + rendered preview, unchanged.
- Migration: a stored `mdView: 'preview'` loads as `'visual'`. Files over the existing "big file" threshold still open in Source.

### Architecture
- New `editor/visual/` folder:
  - `extensions.ts`: StarterKit, Underline, TextStyle + Color + FontSize, TextAlign, TaskList/TaskItem, Table set, Link, Placeholder, plus custom nodes below.
  - `markdown.ts`: parse Markdown → TipTap doc and serialize back, via `@tiptap/markdown`, with custom handlers for the HTML-backed marks.
  - `locked.ts`: atom nodes for content Visual can't edit safely (front matter, `$$` maths, inline `$` maths, Mermaid code blocks, footnote definitions). They render with the existing pipeline (KaTeX / Mermaid) and store their exact source text, which is written back verbatim. Double-click opens Source view with the cursor at that block.
- New `ui/VisualEditor.tsx` hosts the TipTap editor for the active tab.
- **Single source of truth stays the Markdown text** in the existing doc store (`textOf(id)`). CodeMirror holds it as today.
  - Entering Visual: parse the current text into TipTap.
  - On a Visual edit (debounced ~150 ms): serialize and write the text back into the doc store, which marks it dirty and drives autosave/recovery as today.
  - No Visual edit, no write: switching views or saving an untouched file stays byte-identical.
- Undo: TipTap's history inside Visual, CodeMirror's inside Source. Switching views starts a fresh history for the view you enter (known limitation).

### Formatting Markdown can't express
| Formatting | Written as |
|---|---|
| Underline | `<u>text</u>` |
| Font colour | `<span style="color:#RRGGBB">text</span>` |
| Font size | `<span style="font-size:18px">text</span>` |
| Font weight (non-bold) | `<span style="font-weight:300">text</span>` |
| Alignment (centre/right/justify) | `<p align="center">…</p>` (headings: `<h2 align="center">`) |

Colour, size and weight on the same text merge into one `<span style="…">`. Left alignment writes nothing.

### Preview sanitiser (`markdown/pipeline.ts`)
- Allow `style` on `span` only, filtered to `color`, `font-size` and `font-weight` with strict value patterns (hex/rgb colours, `px`/`em`/`%` sizes, numeric weights). Everything else in `style` is dropped.
- `align` is already allowed on all elements.

### Trade-off (accepted)
After an edit in Visual, TipTap re-serializes the whole file in its own style: `*` bullets may become `-`, `__bold__` becomes `**bold**`, extra blank lines are normalised. Content is preserved; syntax style may change.

## Testing

- **Unit (vitest)**
  - Markdown round-trip: headings, emphasis, lists (nested, ordered, tasks), tables, links, code blocks, blockquotes, horizontal rules.
  - HTML-backed marks: underline, colour, size, weight, alignment round-trip exactly.
  - Locked blocks: front matter, maths, Mermaid and footnotes come back byte-identical after an unrelated edit elsewhere.
  - Sanitiser: allowed `style` values survive; `style="position:fixed"`, `url(...)`, `expression(...)` are stripped.
  - `MarkdownSourceTarget` insertions (bold/underline/colour/list/indent on selections).
  - Tree/session: `color` persists; old `mdView: 'preview'` migrates.
- **Existing suites** (`npm run typecheck`, `npm test`, `cargo test`) still pass.
- **Manual in `npx tauri dev`**: every toolbar button in Visual, Source and plain text; the scale slider from 75% to 150%; sidebar at minimum width; colours in light and dark themes; open, edit and save a real `.md` and diff it.

## Out of scope

- A rich-text file type (`.rtf` / `.html`).
- Collaborative editing, comments, images pasted as files (paste of image URLs works as links).
- Shared undo history across Visual and Source.
