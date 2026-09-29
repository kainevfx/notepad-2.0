# Sidebar, file actions, paper & margin, scaling, menus, tables, startup guide

Date: 2026-09-29
Status: design approved by Kaine in chat (sections A–I); spec written for the record
Builds on: `2026-09-28-editor-toolbar-wysiwyg-design.md` (branch `feature/toolbar-wysiwyg`)

## Decisions made in chat

| Question | Decision |
|---|---|
| Renaming a saved file | Renames it on disk; asks instead of overwriting an existing name. |
| Copy / duplicate naming | `Notes (2).md`, `Notes (3).md` … (number after the name). |
| Page margin scope | One setting for every paper type and view. |
| Sort options | Manual (default), Date modified, Date created, Name A–Z, File type. |
| Table storage | GFM pipe table while simple; automatically an HTML table when resized or when cells hold block content. |
| Delivery | Three stages: (1) sidebar, file actions, sorting, saving; (2) paper, margin, scaling, toolbar, menus, tables, theme; (3) startup guide. |

## A. Code paper & page margin
- The paper mode `numbers` is renamed **Code** (stored value stays `numbers` for old settings; label and icon change).
- Code paper: a line number on every line of the visible page, continuing past the last text line (numbers after the end are drawn by a CodeMirror view plugin, not part of the text); a very faint rule under every line (`--paper-rule-faint`).
- **Page margin** setting `pageMargin` (px, 0–200, default 24) applies to all papers and to Visual / Split preview: padding around the text area so text never touches the window edges.
- Controls: slider + number input in the Paper popover; same control in Settings → Paper; View → Paper → "Page margin…" opens the popover.

## B. Scaling
- The interface-size slider scales **only the left sidebar / rail and the document area** (CodeMirror, Visual editor, preview). Title bar, menu bar, formatting toolbar and status bar never scale.
- Implemented with CSS `zoom` on `.sidebar`/`.rail` and `.editor-pane`; the webview zoom and its capability are removed.
- Text zoom (Ctrl +/−) is unchanged.

## C. Left sidebar
- Header row: **Sort** dropdown (Manual, Date modified, Date created, Name A–Z, File type). Sorting is a view: it orders files within each level (ungrouped section and inside each group) and groups by name for Name A–Z; it never rewrites the manual order. Setting `sidebarSort`.
- Buttons read exactly **New text file**, **New MD file**, **New group**; text always shown; they wrap when narrow.
- **Ungrouped files always come first**, above all groups, in the tree, the sidebar, the top tab strip and the rail. Enforced in `tree-ops` (`normalizeLooseFirst`) after every tree change; dropping a file below a group at root level lands it at the end of the ungrouped section.
- New files: appended at the end of their section (ungrouped section, or the group they were created in); new groups appended after existing groups.
- Groups are called **File group(s)** in all UI text; headers are compact (~60% of the previous height).
- Each file row shows its last-edited time under the name: "just now" (<1 min), "N min ago" (<1 h), "HH:MM" (today), "Yesterday HH:MM", "Mon 28 Sep" (this year), "28 Sep 2025".
- Styling matches the formatting toolbar (same background token, button radius/height, font sizes).
- Collapsed rail: 132 px wide; labels horizontal with ellipsis; "Ungrouped" entry first.

## D. File actions
- Double-click a file row or group header → inline rename field (Enter commits, Esc cancels). Also first item **Rename** in both context menus.
- Saved file rename: new Rust command `rename_file(from, to)` using `std::fs::rename`, refusing when the target exists; the app shows an alert instead of overwriting. Title / path / recent files update.
- **Open in File Explorer** in the file context menu (disabled for unsaved notes).
- **Duplicate**: inserts the copy directly below the original in the same group. Name: `<stem> (N)<ext>`, smallest free N ≥ 2 among open docs and (for saved files) on disk in the same folder. Saved files are copied to a new file next to the original; notes become a new note with the copied text.
- **Copy** puts a doc reference on an in-app clipboard; **Paste** appears on group context menus and on an "Ungrouped" context menu (right-click empty sidebar space) and duplicates into that location.

## E. Formatting toolbar
- Tool groups are centred in the bar.
- **Alignment** and **Lists** become dropdown buttons showing the current state; their popups list the options with icons and labels.
- Font colour icon: a red letter **A**.
- A **Table** dropdown appears when the cursor is inside a table (Visual view): Add row above / below, Add column left / right, Delete row, Delete column, Toggle header row, Delete table.
- Top-right controls have text labels: **Paper**, **Tabs: Left / Tabs: Top**, **Settings**.

## F. Menus
- **Insert** (between Edit and View): Page break, Line break, Image…, Table…, Link…, Horizontal line, Date/Time.
  - Page break: Markdown `<div class="page-break"></div>` (prints as a new page); plain text: form feed `\f` (printing starts a new page there).
  - Line break: Markdown `<br>`; plain text: newline.
  - Image…: file picker (images); inserts `![name](relative/path)` relative to the document folder (absolute path for unsaved notes).
- **Help**: Run startup guide, Keyboard shortcuts, About Notepad 2.0.

## G. Settings
- Appearance → Theme is a **Light / Dark / System** segmented switch; View menu gets **Dark mode** as a checkable toggle.

## H. Saving & titles
- `noteTitle(text)` strips Markdown and HTML (tags, heading/list/quote markers, emphasis, link syntax, entities) before taking the first line, so `<span style="color:red">My Title</span>` → `My Title`, used for sidebar titles and suggested file names.

## I. Tables
- Cells may contain formatted inline text and block content (headings, lists, multiple paragraphs).
- Columns resize by dragging their border (TipTap `resizable: true`, widths in `colwidth`); rows resize by dragging the bottom border of a row (custom plugin, height in a `rowHeight` attribute).
- Serialisation: GFM pipe table when every cell is a single paragraph and no widths/heights are set; otherwise an HTML table:
  ```html
  <table>
  <colgroup><col style="width:120px"><col></colgroup>
  <tr style="height:40px"><th>

  **Name**

  </th>…</tr>
  </table>
  ```
  Cell contents are Markdown separated by blank lines (renders on GitHub and in the preview). The Visual parser reads these tables back as editable tables.
- Preview sanitiser allows `style` on `col` / `tr` / `td` / `th` restricted to `width` and `height` in px/%.
- Source view: the Insert → Table picker writes a GFM table (unchanged).

## J. Startup guide (stage 3)
- Overlay with a spotlight on the relevant UI and a card (title, 1–3 sentences, Back / Next / Skip). Steps: welcome; new text / MD file; file groups & drag; sort & right-click actions (rename, duplicate, copy/paste, open in Explorer); formatting toolbar; Visual / Source / Split; tables; Paper & page margin; interface size vs text zoom; Quick Note & tray; saving & recovery; finish.
- Help → Run startup guide; offered once on first run (`firstRunDone`).

## Testing
- Unit (vitest): `normalizeLooseFirst` and insert/move ordering; sort comparators; `relativeTime`; `copyName`; `noteTitle` stripping; table serialisation (simple → GFM, resized / block cells → HTML, HTML table → editable table round-trip); sanitiser width/height; Insert commands for plain / Markdown; page-margin clamp; Code paper filler count.
- Rust: `rename_file` refuses to overwrite and renames atomically.
- Manual (browser build + `tauri dev`): every menu item; sidebar at narrow / wide; rail; scaling slider no longer runs away; tables resize; guide end to end.
