# Sub-plan 01: scaffold and Notepad parity shell (P0 + P1)

## P0 scaffold
- `npm create tauri-app` (Tauri 2, Vite, Preact + TypeScript), pnpm.
- Plugins: `single-instance`, `fs`, `dialog`, `global-shortcut`, `window-state`, `updater`, `store`, `decorum`.
- `src/platform/` interface (`openFile`, `saveFile`, `listRecent`, `tray`, `registry`) with two implementations: `tauri.ts` and `browser-mock.ts` (localStorage). The mock lets Playwright on the VPS screenshot every screen.
- GitHub Actions: `ci.yml` (typecheck, vitest, Playwright screenshots on ubuntu) and `release.yml` (`tauri-action` on `windows-latest`, MSI + NSIS artefacts, draft release on tag).

## P1 parity checklist
Window
- Custom title bar: app icon, tab strip, `+` new tab, min / max / close with Snap Layouts flyout.
- Mica backdrop, falls back to solid on Win10.
- Window size, position and maximised state remembered.

Menu row (File, Edit, View) and settings gear, matching Notepad's items and order:
- File: New tab, New window, Open, Recent, Save, Save as, Save all, Page setup, Print, Close tab, Close window, Exit.
- Edit: Undo, Cut, Copy, Paste, Delete, Find, Find next/previous, Replace, Go to, Select all, Time/Date, Font.
- View: Zoom, Status bar, Word wrap, plus our additions grouped under a separator (Tabs: Top / Left, Paper: Grid / Lines / Numbers / None, Markdown preview).

Editor
- Consolas 11pt default, font picker, zoom 10% to 500% (Ctrl+wheel too).
- Find/replace bar docked at top like Notepad (match case, wrap around, regex as an extra).
- Encoding detection (BOM, UTF-8 validity check, fallback Windows-1252), line ending detection, both shown and changeable in the status bar.
- Session restore: on reopen, every tab comes back with unsaved content, caret and scroll.

Status bar: `Ln x, Col y` | characters | language mode (Plain text / Markdown) | zoom | line ending | encoding.

## Done when
Side by side screenshots against Win11 Notepad in light and dark match layout, spacing and typography, and the shortcut table in `verification-feature-test.md` passes.
