# Dossier: Notepad 2.0 development record

_Append-only. Newest entries at the bottom._

## 2026-09-27 planning (developer agent)
- Read the project brief and the 4 reference mockups (vertical coloured groups, collapsed rail, Grid/Lines/Numbers/None toolbar, split Markdown preview, Quick Note bubble).
- Copied mockups to `assets/reference/`.
- Chose Tauri 2 + Preact + CodeMirror 6 + unified/remark as the recommended stack (WinUI 3 left as the alternative for Kaine to decide).
- Defined save rules: autosave for untitled and quick notes, manual save for disk files with crash recovery, opt-in autosave for files.
- Documented the supported default-app route (register + Settings deep link, one user click) and the IFEO route for replacing notepad.exe.
- Flagged a trademark issue: mockups use "Notepad++"; the app needs its own name and icon.
- Wrote the full plan set in `plans/2026-09-27-notepad-2/`. No code written, nothing built, nothing installed.
- Project status set to `planned`.

## 2026-09-27 10:50-11:16 frontend build (developer agent, earlier session)
- Built the full UI in `app/src/`: Notepad-parity chrome, top/left/rail tab modes, nested colour groups with drag and drop, paper modes (None/Numbers/Lines/Grid), CodeMirror 6 editor, remark/rehype Markdown preview (GFM, footnotes, front matter, KaTeX, Mermaid, highlight, sanitised HTML), save model with crash recovery, Quick Note bubble, Settings incl. Windows integration page.
- Platform layer split: `platform/tauri.ts` (real app) and `platform/mock.ts` (browser build for screenshots).
- 56 vitest tests (encodings, Notepad argv, tree ops, Markdown pipeline). 15-screen Playwright tour in `app/e2e/`.
- Session ended before the Rust side was written and before this record was updated.

## 2026-09-27 22:48 native shell (developer agent)
- Wrote `app/src-tauri/`: `lib.rs` (21 commands matching `platform/tauri.ts`, tray with menu, left-click toggles Quick Note, double-click opens main, Win+Alt+N global hotkey, single-instance forwarding argv to the running window, Quick Note close = hide), `files.rs` (atomic save via temp + fsync + rename, app store under `%APPDATA%\Notepad2` with path-escape guard), `integration.rs` (HKCU ProgIDs + Capabilities + RegisteredApplications, UserChoice/UserChoiceLatest detection, IFEO via self-elevated helper, context menu, Run key, uninstall cleanup), `main.rs` (helper modes before app start).
- `tauri.conf.json`: two windows (main frameless, quicknote frameless/always-on-top/skip-taskbar, both start hidden), CSP, asset protocol for local images, NSIS per-user + MSI, WebView2 bootstrapper. `capabilities/default.json` for both windows.
- Icon: original page + blue "2" badge (no Microsoft artwork), generated to `.ico`/`.png` from `assets/icon/app-icon.svg`.
- NSIS uninstall hook runs `notepad2.exe --np2-cleanup`.
- `.github/workflows/build-windows.yml`: Linux job (typecheck, vitest, vite build) then windows-latest job (cargo test, `tauri build`, upload installers, attach to release on `v*` tags).
- Frontend fix: main window now shows itself after init (it starts hidden to avoid a blank flash); `--hidden` and `--quicknote` keep it in the tray.
- Verified: `cargo check --target x86_64-pc-windows-msvc` clean (resource compiler stubbed on Linux, real on CI), 9/9 Rust unit tests, 56/56 vitest, typecheck clean, vite build OK, 15-screen tour with zero console errors.
- Not verified: an actual Windows run. Needs the CI build or a local `npx tauri build` on the Home PC.
