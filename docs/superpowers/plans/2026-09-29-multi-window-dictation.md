# Multiple Windows & Quick Note Dictation — Implementation Plan

> **For agentic workers:** superpowers:executing-plans (Native), TDD per task.

**Goal:** Implement `docs/superpowers/specs/2026-09-29-multi-window-dictation-design.md`.
**Architecture:** Every window runs the full UI with its own tree/docs. Rust manages window lifecycle, `windows.json`, focus order, hit-testing and routing. Moves use a store-backed transfer file + ack handshake. Pure logic (extract/import/merge, titles) lives in `src/lib/transfer.ts` with tests.
**Spec:** `docs/superpowers/specs/2026-09-29-multi-window-dictation-design.md`

## Global Constraints
- A file/doc is owned by exactly one window; items are removed from the source only after the target acks.
- Window labels: `main`, `main-2`, `main-3`…; `main` keeps `session.json`.
- Moves by default; Ctrl at drop copies.

## Review Focus
1. A move interrupted (target never acks, or app quits mid-move) must not lose or duplicate items.
2. Quitting with several windows must flush every window's unsaved state.
3. Restart must restore every window and its items; old single-window installs keep their session.
4. Opening a file already open elsewhere must focus it, not open a second editable copy.
5. Win+H must only be sent when the Quick Note has focus.

### Task 1: Transfer logic (pure)
Files: `src/lib/transfer.ts`, `src/lib/transfer.test.ts`.
Produces: `extractItems(tree, ids) -> { nodes, docIds, rest }`, `importItems(tree, nodes, drop: { groupId: string|null, beforeId?: string|null }) -> tree`, `windowTitle(base, index, count)`, `sessionKey(label)`.

### Task 2: Rust window manager
Files: `src-tauri/src/windows.rs` (+ tests), `src-tauri/src/lib.rs`, `src-tauri/capabilities/default.json`, `src-tauri/Cargo.toml` (windows-sys KeyboardAndMouse).
Commands: `open_window(x,y,w,h,transfer) -> label`, `window_at(x,y) -> Option<label>`, `last_window() -> label`, `window_count`, `register_open_files(paths)`, `window_with_file(path) -> Option<label>`, `focus_window(label)`, `start_voice_typing`. Routing of single-instance / tray to last-focused. Restore windows on start.

### Task 3: UI per-window sessions, routing, quit flush, titles
Files: `src/platform/*`, `src/state/app.ts`, `src/ui/App.tsx`.

### Task 4: Drag out / drop across windows, hand-over, close-merge, focus existing file
Files: `src/ui/dnd.ts`, `src/state/app.ts` (transfer send/receive), `src/ui/TitleBar.tsx`.

### Task 5: Quick Note dictation
Files: `src/quicknote.tsx`, `src/platform/*`, Rust `start_voice_typing`.

### Task 6: Verify (tests, tauri build, manual multi-window check), review, fix pass, merge to main, installer.
