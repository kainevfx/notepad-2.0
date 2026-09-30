# Split panes, tray icon, Visual paper, chrome and layout moves

Date: 2026-09-30 · Status: approved by Kaine in chat

## Why

Kaine wants two documents on screen at once, a tray icon that reads as writing paper, paper styles that also work in the Visual Markdown view, clearer separation between chrome and page, and a tidier layout: the view switch where the document is, Settings in the menu bar, the Paper control with the tab controls, Sort under search, and the original vertical-text compact rail back as an option.

## 1. Tray icon

Icon A ("legal pad sheet"): a yellow portrait page (#F7D774, outline #B8901F), blue ruled lines (#6E8FB8), a red margin rule (#D9534F). Source SVG in `assets/icon/tray-icon.svg`; a 32×32 PNG `app/src-tauri/icons/tray.png` is embedded in the binary and used only for the tray. The app / window / taskbar icon is unchanged.

## 2. Paper in the Visual view

Today Grid / Lines / Code paper only draw in CodeMirror (Source). In Visual:

- **Grid** and **Lines**: drawn as a CSS background of the Visual page at the line height of the current font size and zoom (`--lh`), behind the formatted text. Headings and images don't snap to lines (like real paper).
- **Code**: faint horizontal rules at the line height, no numbers.
- **Lines** keeps the optional red margin rule.
- The page margin already applies to Visual; the background starts at the text's top padding.

## 3. Chrome colours

New tokens `--bg-chrome` (and `--bg-chrome-2` for inputs on chrome) one step darker than the page (`--bg-editor`) in both themes. Applied to: title bar, menu bar, formatting toolbar, top tab strip (behind the tabs; the active tab stays page-coloured), left sidebar, rail, compact rail, status bar.

## 4. Split view

- A **Split** toggle button (icon + label) in the menu bar's right-hand group, next to Tabs; shortcut **Ctrl+\\**; also View → Split view. On: the document area shows two panes side by side with a draggable divider (20–80%). Off: one pane.
- **Active pane**: pointer-down anywhere in a pane makes it active; the active pane shows a 2 px accent line along its top edge. Clicking a tab (top strip, sidebar, rail, compact rail, Quick Notes group…) loads it into the active pane.
- **Tabs**: the active pane's document is highlighted as today; the other pane's document gets a subtle outline ("also showing").
- **Same document on both sides** is allowed. Only the active pane edits. The inactive pane is a live view: edits appear there at once. Each pane keeps its own view mode (Visual / Source / Split for Markdown; View / Source / Split for data files), cursor and scroll position.
- **Commands** (save, find, formatting, F5, zoom, print, …) act on the active pane.
- **Closing** a document shown in either pane moves that pane to the next tab (the existing neighbour rule). If both panes showed it, both move.
- **Turning split off** keeps the active pane's document.
- Per window, the session stores `split: { on, ratio, docs: { a, b }, active }`; restart restores it. Moving a document to another window removes it from both panes here.
- New windows start with split off.

Per-pane view mode: each document keeps one `mdView` (as today). When the same document is on both sides, a pane may override it: `paneView[pane]` holds that pane's own mode for a document shown on both sides; otherwise the document's `mdView` is used. (Simplest rule that lets "Source on one side, Visual on the other" work.)

## 5. View switch in the canvas

The Visual / Source / Split (View / Source / Split for data files) segmented control moves out of the menu bar into a small floating control in the top-right corner of each pane (over the document, semi-opaque chrome background). It acts on that pane and makes it active.

## 6. Menu bar

File · Edit · Insert · View · **Settings** · Help. "Settings" is a menu-bar item that opens the Settings page (no dropdown). The right-hand group keeps **Tabs** (now a small menu, §9) and the new **Split** toggle. The standalone Paper and Settings buttons are removed from the menu bar.

## 7. Paper button

The Paper button (same icon, same popover) moves to:

- **Sidebar**: the row with New text file / New MD file / New group.
- **Top tabs**: pinned at the right end of the tab strip (doesn't scroll with the tabs).
- **Rail / Compact rail**: an icon button at the top.

View → Paper keeps working.

## 8. Sidebar order

Search tabs field first, then the Sort dropdown underneath (the collapse chevron stays at the top right).

## 9. Compact rail (vertical text)

A fourth tabs layout, **Compact**: a narrow strip (~34 px) listing Ungrouped (if any) then each file group, each as a coloured bar with its name written vertically (rotated, reading bottom-to-top) and its file count. Clicking one opens the same peek list the rail uses. A button at the top expands to the sidebar. The **Tabs** button becomes a small menu: Top · Left · Rail · Compact (label shows the current one). View → Tabs and Settings → Tabs and groups gain "Compact (vertical labels)".

## Testing

- Unit: pane state rules (which pane a tab loads into, closing a document shown in one/both panes, turning split off, session round trip, pane-view override), same-document sync between two editor views, Visual paper class selection, tabs-mode menu options.
- Rust: the tray icon asset is a 32×32 PNG.
- Screenshots: split view, canvas view switch, Visual with Lines paper, compact rail; README and Quickstart PDF updated.
