# Multiple windows (tear-off tabs) and Quick Note dictation

Date: 2026-09-29
Status: approved in chat (Kaine answered the three window questions and chose Windows voice typing)

## Decisions

| Question | Decision |
|---|---|
| Which windows come back after quitting | All of them, each with its own files, groups, size and position; the last-used one in front. |
| Closing one window while others are open | Its files and groups move into the window used before it (kept in their groups). The last window still goes to the tray / quits per settings. |
| Dropping an item on another window | Move (Ctrl while dropping = copy). |
| Dictation engine | Windows 11 voice typing (Win+H) started by a mic button in the Quick Note. |

## A. Tearing off and moving between windows
- Dragging a file, file group or subgroup from the sidebar or top tab strip and releasing **outside the window**:
  - over another Notepad 2.0 window → the item moves into that window at the drop point (file group under the pointer, between files, or Ungrouped);
  - anywhere else → a new window opens at that spot containing the item.
- Ctrl held at drop copies instead (uses Duplicate naming).
- Every file belongs to exactly one window. Opening a file already open in another window focuses that window and tab instead of opening a second copy.

## B. Hand-over protocol (no loss, no duplicates)
1. Source flushes Visual edits and writes notes to the store (`notes/<id>.md`); files carry their current text and dirty flag.
2. Source writes a transfer file `transfers/<id>.json` = { nodes (subtree), docs (meta + text), drop point, copy flag }.
3. Source asks Rust to deliver it: to an existing window (event `receive-transfer`) or by creating a new window with `?transfer=<id>`.
4. Target imports (adds docs + tree nodes), deletes the transfer file, emits `transfer-done` to the source.
5. Only on `transfer-done` does the source remove the items (without "save?" prompts and without deleting note files). If no ack arrives in 4 s the source deletes the transfer file and keeps its items; if the delete fails because the target already took it, the source removes its items.

## C. Windows and sessions
- Windows are `main` (from config) and `main-2`, `main-3`, … created at runtime with the same look as `main`.
- Rust owns `windows.json` in the store: `{ windows: [{ label, x, y, width, height, maximized }], order: [labels, most recent first] }`, updated on create / move / resize / focus / destroy. On start Rust restores every window listed (main from config, the others created), in their positions.
- Each window's layout: `main` keeps `session.json` (existing installs lose nothing); others use `sessions/<label>.json`. A window's session is deleted when it closes by merging.
- Single-instance launches, the tray's Open / Settings / Quit and Quick Note's "open in main window" go to the most recently focused window.
- Quit: the receiving window asks every window to flush (event `app-flush`, reply `app-flushed`, up to 1.5 s) before quitting.
- When more than one window is open, each title reads "… - Notepad 2.0 (Window N)".

## D. Closing a window
- X on a window while others are open: transfer all its files and groups to the most recently used other window (Ungrouped files into its Ungrouped, groups appended), then close it.
- X on the only window: current behaviour (tray or quit per "close to tray").

## E. Quick Note dictation
- A mic button in the Quick Note header, title "Dictate (Windows voice typing, Win+H)". It focuses the note and starts Windows voice typing by sending Win+H (Rust `start_voice_typing`, `SendInput`). Text lands at the cursor; auto-punctuation and language come from Windows settings.
- Browser build: the button is hidden.

## Testing
- Unit: transfer extract/import (subtree with nested groups, ungrouped-first after import, ids unique, copy mode renames), merge-on-close placement, window title numbering, session key per window.
- Rust: windows.json read/write round trip; window_at hit-testing on rectangles.
- Manual in the installed / dev app: tear off a file and a group, drag back, close a secondary window, quit and restart with 3 windows, open an already-open file from Explorer, dictate in Quick Note.
