# Split panes, tray icon, Visual paper, chrome and layout moves Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Two documents side by side (toggle), a writing-paper tray icon, paper styles in Visual, darker chrome, the view switch inside each pane, Settings in the menu bar, Paper with the tab controls, Sort under search, and a vertical-text compact rail.

**Architecture:** Pane state is a small pure model (`lib/panes.ts`) held in signals in `state/panes.ts`. `state/app.ts` keeps its single "active view" (`view`) contract: every command still acts on `view`, which now points at the active pane's CodeMirror. A second pane gets its own EditorView (and its own Visual editor / preview / viewer); only the active pane edits; changes to a document shown on both sides are forwarded to the other view with a sync annotation. `EditorPane` becomes `Pane({ pane })` inside a new `EditorArea`.

**Tech Stack:** Preact + signals, CodeMirror 6, TipTap 3, Tauri 2 (Rust tray), vitest (happy-dom for view tests).

**Spec:** `docs/superpowers/specs/2026-09-30-split-panes-chrome-design.md`

## Global Constraints

- Work happens in the worktree `E:\___ Claude\_01-notepad-2-0-source-2026-09-28\np2-split-panes` (branch `feature/split-panes`); the main checkout holds another agent's uncommitted read-aloud work and must not be touched.
- Every command acts on the active pane; the inactive pane never edits.
- Tray icon colours: page #F7D774, outline #B8901F, rules #6E8FB8, margin #D9534F; 32×32 PNG; app icon unchanged.
- Chrome = title bar, menu bar, formatting toolbar, tab strip, sidebar, rail, compact rail, status bar: one step darker than `--bg-editor` in both themes.
- Menu bar order: File, Edit, Insert, View, Settings, Help. Right group: Tabs (menu: Top · Left · Rail · Compact), Split toggle.
- Split shortcut Ctrl+\\; divider 20–80%; session key `split` per window; new windows start with split off.
- `npm run typecheck`, `npm test`, `cargo test --lib` green before every commit.

## Review Focus

1. Typing fast in the active pane while the other pane shows the same document: the other side must stay identical (no dropped or doubled characters) — test in Task 8.
2. Closing, moving to another window, or reloading a document shown in the inactive pane: that pane must move on / refresh, never keep showing a removed document — tests in Tasks 7–8.
3. Visual editing in one pane with the same document in Visual in the other: the other Visual must refresh without writing anything back (no edit loop, no dirty flag from merely viewing) — test in Task 8 (sync writes only from the active pane).
4. Undo in a pane after the other pane typed into the same document: undo history is per view; undo must only undo that pane's own edits and the other side must follow — test in Task 8.
5. Restart with split on and a pane whose document no longer exists: restore falls back to a valid document, never a blank pane — test in Task 7.

---

### Task 1: Tray icon

**Files:** Create `assets/icon/tray-icon.svg`, `app/src-tauri/icons/tray.png` (rendered from the SVG with Edge via Playwright, 32×32), `app/e2e/render-tray-icon.mjs`. Modify `app/src-tauri/src/lib.rs` (`build_tray` uses `Image::from_bytes(include_bytes!("../icons/tray.png"))`).

- [ ] Step 1: failing Rust test in lib.rs tests: `tray_icon_is_a_32px_png` — `let img = tauri::image::Image::from_bytes(TRAY_ICON).unwrap(); assert_eq!((img.width(), img.height()), (32, 32));` (fails: `TRAY_ICON` undefined).
- [ ] Step 2: SVG (icon A from the spec), render script (`page.setContent(svg)`, `page.locator('svg').screenshot({ omitBackground: true })` at 32×32, deviceScaleFactor 1), `const TRAY_ICON: &[u8] = include_bytes!("../icons/tray.png");`, use it in `build_tray`.
- [ ] Step 3: cargo test → PASS; commit.

### Task 2: Chrome colours

**Files:** Modify `app/src/styles/app.css`.

- [ ] Add `--bg-chrome` / `--bg-chrome-2` (light: `#ededed` / `#e4e4e4`; dark: `#1c1c1c` / `#252525`) and apply to `.titlebar`, `.menubar`, `.formatbar`, `.tabstrip` (active tab stays `--bg-editor`), `.sidebar`, `.rail`, `.statusbar`; inputs on chrome use `--bg-chrome-2`.
- [ ] No unit test (pure CSS) — verified by screenshot in Task 9 (Ruling recorded).
- [ ] typecheck + tests; commit.

### Task 3: Paper in the Visual view

**Files:** Create `app/src/editor/visual/paper.ts`, `paper.test.ts`. Modify `app/src/ui/VisualEditor.tsx` (host gets the classes/vars), `app/src/styles/visual.css`.

**Interfaces:** `visualPaper(paper: PaperMode, s: Settings): { cls: string; vars: Record<string, string> }` — cls `vpaper vpaper-{grid|lines|code|none}` (+ ` vpaper-margin` for Lines with `paperMargin`), vars `--vlh` = `lineHeightPx(s)` px.

- [ ] Step 1: tests: grid → `vpaper vpaper-grid`; lines + margin → includes `vpaper-margin`; numbers → `vpaper-code`; none → `vpaper vpaper-none`; `--vlh` equals `lineHeightPx(s)+'px'`.
- [ ] Step 2: implement; CSS: `.visual-editor.vpaper-lines .ProseMirror { background-image: linear-gradient(to bottom, transparent calc(var(--vlh) - 1px), var(--paper-rule) calc(var(--vlh) - 1px)); background-size: 100% var(--vlh); background-attachment: local; }`, grid adds a vertical gradient, code uses `--paper-rule-faint`, margin via an extra `linear-gradient(to right, …)` at the page margin.
- [ ] Step 3: VisualEditor applies `visualPaper(effectivePaper(doc), settings.value)` to its host; tests; commit.

### Task 4: Menu bar (Settings item, Tabs menu with Compact), Split button placeholder removed later

**Files:** Modify `app/src/state/settings.ts` (`TabsMode` adds `'compact'`), `app/src/ui/MenuBar.tsx`, `app/src/ui/Settings.tsx`, `app/src/state/app.ts` (`cmd.toggleTabsMode`), create `app/src/lib/tabs-modes.ts` + test.

**Interfaces:** `TABS_MODES: { mode: TabsMode; label: string }[]` = Top, Left, Rail, Compact; `nextTabsMode(m)` (Ctrl+Shift+, cycles top → left → rail → compact → top).

- [ ] Step 1: tests for `TABS_MODES` labels/order and `nextTabsMode`.
- [ ] Step 2: implement; MenuBar: add `Settings` menu-bar button (opens settings, no dropdown) between View and Help; remove the Paper and Settings buttons and the in-bar view seg; Tabs button opens a menu of `TABS_MODES` (checked current); View → Tabs submenu lists all four; Settings select gains Compact.
- [ ] Step 3: tests; commit.

### Task 5: Paper button in the tab controls; Sort under search

**Files:** Create `app/src/ui/PaperButton.tsx` (button + popover anchor, used in three places). Modify `Sidebar.tsx` (side-head holds search + collapse; Sort row under it; Paper in `side-actions`), `TabStrip.tsx` (wrap strip: scrolling tabs + a pinned `.tabstrip-end` with PaperButton), `Rail` top, `app.css`.

- [ ] No logic to unit test (layout) — Ruling; verified by screenshots.
- [ ] typecheck + tests; commit.

### Task 6: Compact rail (vertical text)

**Files:** Modify `Sidebar.tsx` (`export function CompactRail()`), `App.tsx` (render for `tabsMode === 'compact'`), `app.css` (`.crail`, `.crail-label { writing-mode: vertical-rl; transform: rotate(180deg); }`).

- [ ] Reuses the Rail's peek and menus; test: `countNotes` already covered; add a render test? (Ruling: layout only; screenshot.)
- [ ] typecheck + tests; commit.

### Task 7: Pane model (pure) + session

**Files:** Create `app/src/lib/panes.ts`, `app/src/lib/panes.test.ts`.

**Interfaces:**

```ts
export type PaneId = 'a' | 'b';
export interface PaneState { on: boolean; ratio: number; active: PaneId; docs: { a: string | null; b: string | null }; override: { a: MdView | null; b: MdView | null } }
export const SINGLE: PaneState; // { on: false, ratio: 0.5, active: 'a', docs: { a: null, b: null }, override: { a: null, b: null } }
export const other: (p: PaneId) => PaneId;
export function loadInto(s: PaneState, id: string): PaneState;               // active pane shows id; clears its override
export function focus(s: PaneState, p: PaneId): PaneState;
export function toggle(s: PaneState, order: string[]): PaneState;            // on: b = next doc after active in order (or same); off: keep active doc in a
export function onRemoved(s: PaneState, ids: string[], next: (removed: string) => string | null): PaneState;
export function viewFor(s: PaneState, p: PaneId, docView: MdView): MdView;   // override only when both panes show the same doc
export function setView(s: PaneState, p: PaneId): 'doc' | 'override';        // where a view change from pane p is stored
export function setRatio(s: PaneState, r: number): PaneState;                 // clamp 0.2–0.8
export function restore(raw: unknown, exists: (id: string) => boolean, fallback: string | null): PaneState;
```

- [ ] Step 1: tests (each rule above, including restore with a missing doc → fallback, garbage → SINGLE, ratio clamp, closing a doc on both sides).
- [ ] Step 2: implement; tests PASS; commit.

### Task 8: Two panes in the app

**Files:** Create `app/src/state/panes.ts` (signal `panes`, `focusPane`, `toggleSplit`, `setPaneView`, `registerPaneView`), `app/src/ui/EditorArea.tsx` (one or two `Pane`s + divider), `app/src/ui/ViewSwitch.tsx` (floating control). Modify `app/src/state/app.ts` (views per pane, `activate` loads into active pane, update handler ignores non-active views and forwards changes to the other pane, `closeDoc`/`removeDocs` move panes, `reloadDoc` syncs, session `split`), `app/src/ui/EditorPane.tsx` → `Pane({ pane })` (Banner/Preview/VisualEditor/ViewerPane take the pane's doc), `app/src/ui/VisualEditor.tsx` (prop `pane`; registers `visualApi` only while its pane is active; writes only when active), `MenuBar.tsx` (Split toggle button + View → Split view), `ui/shortcuts.ts` (Ctrl+\\), `TabStrip.tsx`/`Sidebar.tsx` (`also-shown` outline for the other pane's doc), `app.css`.

- [ ] Step 1: failing tests `app/src/state/panes-app.test.ts` (happy-dom, two real EditorViews):
  - activating a tab loads into the active pane only;
  - typing in pane A with the same doc in pane B: B's text equals A's after each of 50 random inserts/deletes; B never marks anything by itself (onEdited called once per edit);
  - undo in A after edits in A: B follows;
  - closing the doc shown in B moves B to the neighbour; closing a doc shown in both moves both;
  - toggling split off keeps the active pane's doc; session round trip keeps `split`;
  - removeDocs (moved to another window) of B's doc moves B.
- [ ] Step 2: implement; PASS; full suite; commit.

### Task 9: Docs, screenshots, review, merge, build, install

- [ ] Screenshots: split view (Markdown Visual left, CSV right), Visual with Lines paper, compact rail, the new menu bar; README (Split view section, layout notes), Quickstart PDF page updates; commit.
- [ ] Final fresh review; fix Critical/Important with RED→GREEN tests; merge `feature/split-panes` into `main` (the other agent's uncommitted files stay untouched — merge from the worktree with `git -C` on main only if the merge touches none of their modified paths; otherwise stop and ask); build installer; install.
