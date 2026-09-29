# Sidebar, File Actions, Paper, Scaling, Menus, Tables & Guide — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (chosen: Native). Steps use checkbox (`- [ ]`) syntax.

**Goal:** Implement spec `docs/superpowers/specs/2026-09-29-sidebar-paper-tables-design.md` sections A–J in three stages.

**Architecture:** Pure logic (ordering, sorting, time labels, copy names, title stripping, table serialisation, insert snippets) lives in small tested modules under `src/lib/` and `src/editor/`; UI components call them. Tree ordering is enforced centrally in `tree-ops`. Tables extend the TipTap table nodes with custom Markdown rendering/parsing.

**Tech Stack:** as before (Tauri 2, Preact, CodeMirror 6, TipTap 3, vitest + happy-dom).

**Spec:** `docs/superpowers/specs/2026-09-29-sidebar-paper-tables-design.md`

## Global Constraints
- Ungrouped files always precede groups at root level.
- Copy naming `<stem> (N)<ext>`, smallest free N ≥ 2.
- `pageMargin` 0–200 px, default 24, all papers and views.
- Interface scale affects only sidebar/rail and editor pane.
- Stored paper value `numbers` kept; UI label "Code".
- Tables: GFM when simple, HTML table when resized or block content.
- UI wording: "File group", "New text file", "New MD file", "New group", "Ungrouped".

## Review Focus
1. Renaming a saved file to a name that already exists must never overwrite it (Rust test + UI alert).
2. Duplicating/pasting a saved file must never overwrite an existing file on disk (copyName checks disk).
3. HTML tables written by Visual must re-open as editable tables with the same widths/heights and cell formatting (round-trip test).
4. Sorting must never change the stored manual order (test: sort view then switch back to Manual → same order).
5. Scaling the sidebar/editor with CSS zoom must keep CodeMirror click-to-position accurate (manual check at 75% and 150%).

---

## Stage 1 — sidebar, file actions, sorting, saving

### Task 1: Ungrouped-first ordering
**Files:** `src/lib/tree-ops.ts`, `src/lib/tree-ops.test.ts`, `src/state/app.ts` (`commitTree`, `placeNewNode`, `newGroupFrom`)
**Produces:** `normalizeLooseFirst(nodes: TreeNode[]): TreeNode[]` (stable: root notes first in their relative order, then groups in theirs; children untouched).
- [ ] Tests: mixed root `[g1, n1, g2, n2]` → `[n1, n2, g1, g2]`; already-normal input returns equal array; nested groups untouched.
- [ ] Implement; call it in every root-tree commit path (`commitTree`, `placeNewNode`, drag/drop `moveNode`, `moveNodeToRoot`, session restore).
- [ ] `placeNewNode`: new ungrouped file → end of ungrouped section; new file inside a group (active doc in a group) → end of that group. `newGroupFrom` appends after existing groups.
- [ ] Test via `app` with mocked platform (pattern of `app-flush.test.ts`): three `newNote()` then `newGroupFrom` → root order notes-then-group, notes in creation order.
- [ ] Commit.

### Task 2: Sorting, timestamps, sidebar header & styling
**Files:** create `src/lib/sort.ts` (+test), `src/lib/relative-time.ts` (+test); modify `src/state/settings.ts` (`sidebarSort`), `src/ui/Sidebar.tsx`, `src/ui/TabStrip.tsx`, `src/ui/menus.ts`, `src/styles/app.css`, all UI strings "group" → "File group".
**Produces:** `type SortMode = 'manual'|'modified'|'created'|'name'|'type'`; `sortNodes(nodes, mode, docs): TreeNode[]` (returns new arrays, recursive, loose-first preserved); `relativeTime(ts: number, now: number): string`.
- [ ] Tests: each mode orders a fixture; groups keep manual order except `name`; input array not mutated (Review Focus 4); `relativeTime` for 30 s, 5 min, today, yesterday, this year, last year.
- [ ] Sidebar header: Sort `<select>`; buttons "New text file / New MD file / New group" (wrap, never hidden); rows show `relativeTime(d.modified)` under title (re-render every 30 s); compact group head (height 26px, 13px font); toolbar-matching styles.
- [ ] Commit.

### Task 3: Plain titles from formatted Markdown
**Files:** `src/lib/note-title.ts`, create `src/lib/note-title.test.ts`.
- [ ] Tests: `<span style="color:red">My Title</span>` → `My Title`; `# **Bold** head` → `Bold head`; `[link](x) text` → `link text`; `&amp; x` → `& x`; `<div align="center">` first line skipped to first text line; empty → `Untitled`.
- [ ] Implement; commit.

### Task 4: Rename (inline + on disk)
**Files:** `src-tauri/src/files.rs` (+ Rust test), `src-tauri/src/lib.rs`, `src/platform/{types,tauri,mock}.ts`, `src/state/app.ts` (`renameDoc`), `src/ui/Sidebar.tsx`, `src/ui/TabStrip.tsx`, `src/ui/menus.ts`, `src/ui/InlineRename.tsx` (new).
**Produces:** Rust `rename_file(from, to) -> Result<(), String>` (Err if `to` exists); `Platform.renameFile(from, to)`; `renameDoc(id, newName): Promise<boolean>`; `renamingId` signal in `state/ui.ts`.
- [ ] Rust tests: renames; refuses existing target (file content untouched).
- [ ] `renameDoc`: notes → customTitle; files → keep extension if omitted, same folder, platform.renameFile, update path/title/recent; alert on failure.
- [ ] Inline field on double-click (file row, group head, top tab) and via context-menu Rename (first item); Enter/blur commit, Esc cancel.
- [ ] Commit.

### Task 5: Duplicate, copy/paste, open in Explorer
**Files:** create `src/lib/copy-name.ts` (+test); `src/state/app.ts` (`duplicateDoc(id, targetGroupId?: string|null, afterId?)`, `copyDoc`, `pasteInto(groupId|null)`, `docClipboard` signal); `src/ui/menus.ts`; `src/ui/Sidebar.tsx` (empty-area context menu = Ungrouped).
**Produces:** `copyName(name: string, taken: (n: string) => boolean): string`.
- [ ] Tests: `Notes.md` → `Notes (2).md`; taken 2 → 3; `Notes (2).md` → `Notes (3).md`; no extension → `Notes (2)`.
- [ ] duplicate saved file: read bytes, `copyName` with taken = open docs ∪ `stat(exists)`, `writeFile`, open it, place after original in same group. Notes: new note with same text, title copyName.
- [ ] Menus: file — Rename, Duplicate, Copy, Open in File Explorer (disabled unsaved), …; group — Rename, Paste (disabled when clipboard empty), …; empty sidebar — Paste into Ungrouped, New text file, New MD file, New group.
- [ ] Commit.

### Task 6: Rail
**Files:** `src/ui/Sidebar.tsx` (Rail), `src/styles/app.css`.
- [ ] Rail 132px; "Ungrouped (n)" first then groups; horizontal labels with ellipsis; `title` shows full name. Commit.

## Stage 2 — paper, margin, scaling, toolbar, menus, tables, theme

### Task 7: Code paper & page margin
**Files:** `src/state/settings.ts` (`pageMargin`, clamp), `src/editor/setup.ts` (filler plugin, margin var), `src/editor/code-paper.ts` (new, + test for `fillerCount(viewportPx, contentPx, lineHeightPx)`), `src/ui/PaperPopover.tsx`, `src/ui/Settings.tsx`, `src/ui/menus`/`MenuBar.tsx` labels, `src/styles/app.css`, `src/styles/visual.css`.
- [ ] Tests: `clampMargin`; `fillerCount` (0 when content taller than viewport; ceil otherwise).
- [ ] Filler: view plugin draws numbered rows after the last line in a gutter-aligned overlay when paper is Code; faint rules via background; margin via `--page-margin` padding on `.cm-content`, `.markdown-body` (Visual + preview).
- [ ] Paper popover: rename Numbers → Code; Page margin slider + number input. Commit.

### Task 8: Scaling
**Files:** `src/ui/App.tsx`, `src/platform/*` (remove `setUiScale`), `src-tauri/capabilities/default.json` (remove zoom permission), `src/styles/app.css`.
- [ ] Apply `style.zoom = uiScale/100` to sidebar/rail and `.editor-pane` only. Manual check Review Focus 5. Commit.

### Task 9: Toolbar polish
**Files:** `src/ui/FormatBar.tsx`, `src/ui/icons.tsx`, `src/ui/MenuBar.tsx`, `src/styles/app.css`.
- [ ] Centre groups; Alignment + Lists dropdown buttons (current icon + chevron; popup of options); red-A colour icon; top-right labelled buttons. Commit.

### Task 9b: Tabs & layout (added 2026-09-29 from Kaine's screenshot feedback)
**Files:** `src/ui/App.tsx`, `src/ui/TitleBar.tsx`, `src/ui/TabStrip.tsx`, `src/ui/Sidebar.tsx`, `src/styles/app.css`.
- [ ] Layout order: title bar → File/Edit/View menu bar → formatting toolbar → top tab strip → document. The tab strip leaves the title bar (the title bar shows the window title when tabs are on top).
- [ ] Active top tab uses the document background and has no bottom border, so it joins the page; inactive tabs are muted.
- [ ] Hierarchy in the top tab strip: tabs inside a file group sit slightly lower than the group chip (+3px per nesting level); a subgroup chip is lower than its parent chip.
- [ ] Hierarchy in the sidebar: each nesting level indents further right (files and subgroups inside a group).
- [ ] Sidebar resizable 120–720 px by dragging its right edge (was 180–420); width remembered.
- [ ] Verify in the browser build; commit.

### Task 10: Insert & Help menus, theme switch
**Files:** create `src/editor/insert.ts` (+test), `src/ui/MenuBar.tsx`, `src/ui/Settings.tsx`, `src/state/app.ts` (print: split on `\f`), `src/styles/markdown.css` (`.page-break`), `src/platform/*` (`openImageDialog`).
**Produces:** `insertSnippet(kind: 'pageBreak'|'lineBreak', markdown: boolean): string`; `imageMarkdown(docPath: string|null, imagePath: string): string`.
- [ ] Tests: snippets for both languages; relative image path (same folder, subfolder, parent folder, different drive → absolute; spaces encoded as `%20`).
- [ ] Menus wired for Visual (TipTap insertContent / locked image) and Source/plain (CodeMirror); Help: guide (stub until Task 12), Keyboard shortcuts dialog, About. Theme segmented switch + View → Dark mode. Commit.

### Task 11: Tables
**Files:** `src/editor/visual/tables.ts` (new: Table/Row/Cell/Header extensions with rowHeight attr, row-resize plugin, markdown render/parse, HTML table tokenizer), `src/editor/visual/extensions.ts`, `src/editor/visual/tables.test.ts`, `src/markdown/pipeline.ts` (+test: width/height styles), `src/editor/format.ts` + `src/ui/FormatBar.tsx` (Table dropdown), `src/styles/visual.css`.
- [ ] Tests: simple table → GFM; bold/colour in cells stays GFM; heading/list in a cell → HTML; set colwidth → HTML with `<col style="width:120px">`; set rowHeight → `<tr style="height:40px">`; HTML table source → editable table with same widths/heights/formatting (Review Focus 3); sanitizer keeps `width/height` on col/tr/td/th and drops others.
- [ ] Column resize (`resizable: true`), row resize plugin (drag bottom border), table dropdown commands. Commit.

## Stage 3 — guide & finish

### Task 12: Startup guide
**Files:** create `src/ui/Guide.tsx`, `src/ui/guide-steps.ts` (+test: every step's `target` selector exists in the rendered App — rendered in happy-dom with mocked platform, or validated against a list of selectors used in components), `src/ui/App.tsx`, `src/state/ui.ts` (`guideStep` signal), first-run hook.
- [ ] Spotlight overlay + card (Back / Next / Skip, step n of N), steps per spec J, keyboard ←/→/Esc. Commit.

### Task 13: Verify, docs, build, review
- [ ] `npx vitest run`, `npx tsc --noEmit`, `cargo test --lib`; README update; `npx tauri build`; final reviewer; fix pass; commit.
