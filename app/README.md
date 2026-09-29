# Notepad 2.0

Looks and behaves like Windows 11 Notepad, plus:

- **Tabs along the top (under the toolbar, joined to the page), down the left, or a collapsed rail.** File groups: name, colour, collapse/expand, groups inside groups, drag files and groups to reorder or move them. Groups show as outlined containers with a GROUP label; each nesting level sits a little lower / further in. Ungrouped files always stay above the groups. Every tab shows a **TXT** or **MD** badge and when it was last edited; right-click > Colour tints a single tab.
- **Sidebar:** Sort by Manual (default), Date modified, Date created, Name A–Z or File type (a view only; your manual order is kept). Drag its edge to resize it (120–720 px). The collapsed rail lists Ungrouped first, labels running horizontally.
- **File actions:** double-click (or F2, or right-click > Rename) to rename a file or group in place; saved files are renamed on disk and never over an existing file. Duplicate, Copy and Paste into another group or Ungrouped (copies are named `Name (2).ext` and never overwrite anything), Open in File Explorer.
- **New text file (Ctrl+N) / New MD file (Ctrl+Alt+N)**, from the File menu, the sidebar buttons or the tab strip. Untitled files are named from their first line of plain words (formatting is ignored).
- **Formatting toolbar** (centred): paragraph style (Body, Heading 1-3, Quote, Code block), font size and weight, bold, italic, underline, strikethrough, font colour, inline code, an Alignment dropdown, a Lists dropdown (bullets / numbered / checklist), indent, link, table (size picker), horizontal line, word wrap. A **Table** dropdown appears inside a table (add/delete rows and columns, header row, merge/split, delete table). On a plain `.txt` tab only what plain text can hold stays active (word wrap, indent, display font size and weight) and a **Convert to Markdown** button appears.
- **Interface size:** a slider in the status bar (and Settings > Appearance) scales the sidebar and the page from 75% to 150%; menus, toolbars and the slider itself stay put. Text zoom (Ctrl +/-) is separate.
- **Menus:** File, Edit, **Insert** (page break, line break, image, table, link, horizontal line, date/time), View (including Dark mode), **Help** (startup guide, keyboard shortcuts, about). Settings has a Light / Dark / System theme switch.
- **Tables:** cells hold formatted text, headings and lists; drag column and row borders to resize. Simple tables are saved as Markdown tables, others as HTML tables with Markdown inside the cells (both render on GitHub and in the preview).
- **Startup guide:** a 13-step spotlight tour, offered once on first run and any time from Help.
- **Paper modes:** None, **Code** (a number on every line down the whole page, with faint rules), Lines (writing paper), Grid (graph paper). Per tab or global. A **Page margin** (0–200 px, slider or typed) keeps text away from the edges in every view.
- **Markdown:** three views, **Visual | Source | Split**. Visual is WYSIWYG: type straight into the formatted document. Source is the raw Markdown; Split is source + live preview (GFM tables, task lists, footnotes, front matter, maths, Mermaid, code highlighting). Formatting Markdown has no syntax for is stored as small HTML tags GitHub also understands: `<u>`, `<span style="color:…">`, and `<div align="center">` around aligned blocks. Front matter, maths, Mermaid, footnotes and other raw HTML show as locked blocks in Visual (double-click to edit them in Source) and are written back unchanged. Opening, viewing or saving an untouched file is byte-identical; after an edit in Visual the file is re-written in TipTap's Markdown style (for example table cells get padded), content unchanged.
- **Save model:** untitled notes and Quick Notes autosave continuously. Opened files follow Notepad: you save with Ctrl+S, but unsaved edits survive a crash or reboot and come back with a banner. Optional autosave for files in Settings.
- **Tray + Quick Note:** the tray button in the title bar (or X, if "close to tray" is on) hides the app to the tray. Click the tray icon or press Win+Alt+N for a small always-on-top bubble anchored above the tray (1/8 or 1/4 of the screen) that autosaves as you type. Quick Notes show up in a "Quick Notes" group in the main window.
- **Windows integration (Settings > Windows integration):** register as the default for .txt/.md (Directory Opus style: we register, Windows asks you to click Set default once), "Replace notepad.exe" (IFEO redirect, one admin prompt, reversible), right-click "Edit with Notepad 2.0", start with Windows in the tray. Uninstall removes all of it.

## Layout

```
src/            Preact + CodeMirror 6 UI (shared by the main window and the Quick Note bubble)
src/editor/visual/  TipTap (WYSIWYG) Markdown engine: HTML-backed marks, alignment, locked blocks, sync to CodeMirror
src/platform/   tauri.ts = real app, mock.ts = browser build used for screenshots on the VPS
src-tauri/      Rust shell: files, app store (%APPDATA%\Notepad2), tray, hotkey, registry
e2e/            Playwright screenshot tour of the browser build
.github/        Windows CI: tests, then builds the NSIS + MSI installers
```

## Build

On Windows (needs Node 24, Rust stable, WebView2 which Windows 11 already has):

```powershell
npm ci
npx tauri dev      # run it
npx tauri build    # installers in src-tauri\target\release\bundle\{nsis,msi}
```

Or push to GitHub: `.github/workflows/build-windows.yml` builds the installers on `windows-latest` and uploads them as an artifact (and to the release on a `v*` tag).

Browser preview (no Windows needed): `npm run build && npm run shots` writes screenshots to `e2e/out/`.

## Tests

- `npm run typecheck`, `npm test` (vitest: encodings, Notepad command-line parsing, group tree ops, Markdown pipeline and its style allow-list, Source-view formatting commands, Visual editor Markdown round-trips and locked blocks, Visual/CodeMirror sync, toolbar targets).
- `cargo test --manifest-path src-tauri/Cargo.toml --lib` on Windows (atomic save, store path safety, registry value formats).

## Command line

```
notepad2.exe [--hidden] [--quicknote] [/P] [file ...]
notepad2.exe --notepad-style-cmdline C:\Windows\System32\notepad.exe [/A|/W|/P] file   (IFEO redirect)
notepad2.exe --np2-cleanup        (uninstaller: remove all registry keys)
```
