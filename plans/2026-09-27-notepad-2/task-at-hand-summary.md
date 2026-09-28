# Task at hand: Notepad 2.0

_Created 2026-09-27. Source: Kaine's project brief + 4 reference screenshots (`assets/reference/`)._

## The ask in one line
A Windows text editor that looks and behaves exactly like Windows 11 Notepad, plus a set of power features, and that can fully replace Notepad as the default for `.txt` and `.md`.

## Non-negotiable: Notepad parity
- Same window chrome (Mica title bar, tab strip in the title bar, File / Edit / View menu row, status bar with Ln/Col, character count, zoom, line ending, encoding).
- Same keyboard shortcuts (Ctrl+N/T/O/S/Shift+S/W/F/H/G/Z/Y, F5 time/date, Ctrl+Plus/Minus/0 zoom, etc.).
- Same light/dark theme behaviour (follows Windows), same fonts (Consolas default, font picker in Settings).
- Same session restore Win11 Notepad has (reopen with unsaved tabs intact).
- With every extra feature switched off, a user should not be able to tell it apart from Notepad.

## Added features (from the brief)
| # | Feature | Notes from brief and screenshots |
|---|---|---|
| F1 | Vertical tabs mode | Toggle between top tab strip (Notepad default) and a left sidebar. Screenshot 4 also shows a collapsed rail with rotated group labels. |
| F2 | Chrome-style tab groups | Named, colour-coded groups. Drag and drop notes between groups and to reorder. **Nested subgroups**. Click a group header to expand or collapse. |
| F3 | Close to tray + Quick Note bubble | A "close to tray" button. From the tray icon, a slide-out mini window (1/8 to 1/4 of the screen, bottom-right) you just start typing in. Quick notes autosave. |
| F4 | Save rules | Quick notes and new untitled notes autosave. Editing an existing file does NOT autosave by default: File > Save as normal. Autosave for existing files is an opt-in setting. |
| F5 | Full Markdown | Open any `.md` and render it correctly (CommonMark + GitHub flavoured). Edit with markdown highlighting, live split preview (screenshot 1), preview-only mode. No rendering errors. |
| F6 | Paper modes | Floating toolbar with **Grid** (graph paper), **Lines** (writing paper), **Numbers** (code line numbers), **None** (plain Notepad). Screenshots 2 to 4. |
| F7 | Notepad replacement | Option to make it launch whenever anything runs `notepad.exe`. |
| F8 | Default app for .txt / .md | Settings button that registers it and sets it as the default opener for `.txt` and `.md`, like Directory Opus does for its own role. |

## Reading the screenshots
- `01-split-md-preview.jpg`: editor left, "Markdown Preview" pane right with a toggle in the title bar. Note the mock preview renders `**Business Strategy**` with literal asterisks inside a heading. That is exactly the "syntax error" class Kaine wants gone: we use a spec-compliant parser, not a hand-rolled one.
- `02` / `03`: Lines and Numbers modes, vertical groups sidebar (Project Alpha blue, Development purple, Meeting Notes orange, Ideas green), Quick Note bubble bottom-right with a Save button.
- `04`: Grid mode plus the collapsed-rail variant (group names rotated 90 degrees in a thin strip).
- Status bar mentions "Markdown system", `100%`, `Unix (LF)`, `UTF-8`: same fields as Notepad plus a language mode indicator.

## Out of scope (v1)
- Cloud sync, accounts, collaboration.
- macOS / Linux builds (the stack allows them later).
- Spell-check beyond what the OS web view gives.
