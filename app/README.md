# Notepad 2.0

Looks and behaves like Windows 11 Notepad, plus:

- **Tabs on top, on the left, or a collapsed rail.** Left mode has Chrome-style groups: name, colour, collapse/expand, nest groups inside groups, drag notes and groups to reorder or move between groups.
- **Paper modes:** None, Numbers (line numbers), Lines (writing paper), Grid (graph paper). Per tab or global.
- **Markdown:** `.md` files open with a split editor + live preview (GFM tables, task lists, footnotes, front matter, maths, Mermaid, code highlighting). Edit / Split / Preview toggle. Saving an untouched file is byte-identical.
- **Save model:** untitled notes and Quick Notes autosave continuously. Opened files follow Notepad: you save with Ctrl+S, but unsaved edits survive a crash or reboot and come back with a banner. Optional autosave for files in Settings.
- **Tray + Quick Note:** the tray button in the title bar (or X, if "close to tray" is on) hides the app to the tray. Click the tray icon or press Win+Alt+N for a small always-on-top bubble anchored above the tray (1/8 or 1/4 of the screen) that autosaves as you type. Quick Notes show up in a "Quick Notes" group in the main window.
- **Windows integration (Settings > Windows integration):** register as the default for .txt/.md (Directory Opus style: we register, Windows asks you to click Set default once), "Replace notepad.exe" (IFEO redirect, one admin prompt, reversible), right-click "Edit with Notepad 2.0", start with Windows in the tray. Uninstall removes all of it.

## Layout

```
src/            Preact + CodeMirror 6 UI (shared by the main window and the Quick Note bubble)
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

- `npm run typecheck`, `npm test` (vitest: encodings, Notepad command-line parsing, group tree ops, Markdown pipeline).
- `cargo test --manifest-path src-tauri/Cargo.toml --lib` on Windows (atomic save, store path safety, registry value formats).

## Command line

```
notepad2.exe [--hidden] [--quicknote] [/P] [file ...]
notepad2.exe --notepad-style-cmdline C:\Windows\System32\notepad.exe [/A|/W|/P] file   (IFEO redirect)
notepad2.exe --np2-cleanup        (uninstaller: remove all registry keys)
```
