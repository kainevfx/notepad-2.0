# Notepad 2.0: master plan

_Created 2026-09-27 by developer. Status: planned, awaiting Kaine's decisions (see `questions-approvals-and-decisions.md`)._

Sub-documents in this folder:
- `task-at-hand-summary.md` what was asked, feature list F1 to F8, screenshot reading
- `current-and-existing-audit.md` what exists today (Win11 Notepad, Notepad++, competitors) and what we replace
- `sub-plan-breakdown-item-01.md` to `-07.md` one per feature area
- `file-structure-logic-integration.md` repo layout, data files, registry keys
- `questions-approvals-and-decisions.md` what only Kaine can decide
- `kaine-action-items-to-complete.md` steps on the Home PC
- `verification-feature-test.md` acceptance tests per feature
- `agent-suggested-improvements.md` extras worth adding
- `dossier-feature-development-memory-record.md` append-only build log
- `interactive-master-document.html` all of the above in one self-contained page

## 1. Recommended stack

**Tauri 2 (Rust shell) + TypeScript/Preact UI + CodeMirror 6 editor + unified/remark Markdown pipeline.**

| Need | How the stack covers it |
|---|---|
| Looks exactly like Win11 Notepad | Tauri 2 `windowEffects: mica`, custom title bar with the tab strip in it (same as Notepad), Fluent 2 tokens (Segoe UI Variable, Notepad spacing), follows Windows light/dark. `tauri-plugin-decorum` keeps the Win11 Snap Layouts flyout on the custom maximise button. |
| Big files, line numbers, paper backgrounds | CodeMirror 6 renders only the viewport (fine at 50 MB+), has a native line-number gutter, and its content layer takes CSS backgrounds for Grid and Lines. |
| Markdown with zero rendering errors | `micromark` (the parser behind remark) is 100% CommonMark and GFM spec compliant. Tables, task lists, footnotes, strikethrough, autolinks, front matter, HTML (sanitised), KaTeX maths, Mermaid, Shiki code highlighting. |
| Tray + Quick Note bubble | Tauri 2 has a built-in tray API, multi-window, global shortcuts and `single-instance` plugin. |
| File associations + Notepad replacement | Tauri bundler writes ProgIDs from `bundle.fileAssociations`; a small Rust module writes Capabilities / RegisteredApplications / IFEO keys. |
| Size and speed | ~8 to 12 MB installer, uses the WebView2 runtime already on every Win11 box. Cold start target under 400 ms. |
| Buildable from the VPS workflow | The UI runs in a normal browser with a mocked Tauri layer, so Playwright screenshots verify every UI change on the VPS. Windows binaries build on GitHub Actions (`tauri-action`, `windows-latest`) into `kainevfx/notepad-2.0` releases. |

Alternative considered: **WinUI 3 / Windows App SDK (C#)**. That is literally what Microsoft's Notepad is built on, so native fidelity is marginally higher. Against it: Markdown preview and a rich code editor still need WebView2 inside it, nothing can be built or previewed from the VPS, tray support needs a third-party lib, and the repo becomes Windows-only forever. Kept as a decision for Kaine, recommendation is Tauri.

## 2. Feature map and phases

| Phase | Scope | Sub-plan | Est. (agent build time) |
|---|---|---|---|
| P0 | Repo scaffold, Tauri 2 app, CI build to MSI + NSIS, browser dev mode with Tauri mock | 01 | 0.5 day |
| P1 | Notepad parity shell: title bar tabs, menus, status bar, find/replace, go to line, zoom, word wrap, font, encodings (UTF-8/16, ANSI, BOM), line endings (CRLF/LF/CR) preserved on save, session restore, all shortcuts | 01 | 2 days |
| P2 | Vertical tabs, collapsible rail, Chrome-style groups with colours, nested subgroups, drag and drop | 02 | 2 days |
| P3 | Paper modes toolbar: Grid, Lines, Numbers, None, per-tab or global | 03 | 0.5 day |
| P4 | Markdown: highlighting, split preview, preview-only, scroll sync, the full GFM set | 04 | 1.5 days |
| P5 | Save model: autosave for untitled and quick notes, manual save for files, crash-safe writes, opt-in autosave for files | 05 | 1 day |
| P6 | Tray, close-to-tray button, Quick Note bubble, global hotkey | 06 | 1 day |
| P7 | Windows integration: default app for .txt/.md, "Replace Notepad" (IFEO), Open With entries, context menu, uninstall cleanup | 07 | 1 day |
| P8 | Polish, installer, auto-update (Tauri updater against GitHub Releases), optional code signing | 07 | 0.5 day |

Total roughly 10 agent-days, run as one `claude-fable-5-1` build mission per 2 to 3 phases, each phase ending with screenshots and a green CI build Kaine can install.

## 3. Save rules (the bit most likely to go wrong)

| Document kind | Default behaviour | Setting |
|---|---|---|
| Quick Note (tray bubble) | Autosaves 500 ms after typing stops, into the app's note store. Never asks. | none |
| New untitled tab (Ctrl+N) | Autosaves to the note store (like Win11 Notepad's session restore). Tab shows no dirty dot. "Save as" moves it to disk. | none |
| Existing file on disk | **Does not autosave.** Dirty dot on the tab, Ctrl+S to write. On close: Save / Don't save / Cancel. Unsaved edits still survive a crash (kept in the recovery store, not the file). | "Autosave opened files" off by default, per group override |

All disk writes are atomic: write `file.tmp`, fsync, rename over the original, preserving encoding, BOM and line endings exactly as read. Opening a file never rewrites it.

## 4. Windows integration: what is and is not possible

- **Default app for .txt/.md.** Since Windows 8, no app can silently set itself as default: the per-user choice is hash-protected and only the user can confirm it. The legitimate route (what Directory Opus, browsers and Notepad++ do) is: register ProgIDs and Capabilities, add the app to `RegisteredApplications`, then open `ms-settings:defaultapps?registeredAppUser=Notepad2` which lands on our app's page with a "Set default" button. One click from Kaine, once. The settings pane in our app shows the current state and a button that does all of this.
- **Replace Notepad.** Image File Execution Options: `HKLM\...\Image File Execution Options\notepad.exe` value `Debugger` = `"<install>\notepad2.exe" --notepad-style-cmdline`. Every launch of `notepad.exe` (Run box, scripts, "Edit" verbs, other apps) then opens ours; the app strips the injected `notepad.exe` path from argv. Needs one UAC prompt (HKLM). Toggle off removes the key. This is the same mechanism Notepad++ and Notepad3 use.
- **Win11 caveat:** Win11's Store Notepad also has an App Execution Alias. The toggle opens Settings > Apps > Advanced > App execution aliases so Kaine can switch the Notepad alias off, and we verify both launch paths in P7 tests.

## 5. Risks

| Risk | Mitigation |
|---|---|
| Custom title bar loses Win11 Snap Layouts | `tauri-plugin-decorum`; tested in P1 acceptance. |
| Name / icon trademark ("Notepad", "Notepad++" in the mockups) | Own name and icon, look-alike layout only. See decisions. |
| Unsigned installer triggers SmartScreen | Fine for personal use; optional Azure Trusted Signing (paid) in P8. |
| Encoding round-trip bugs corrupting files | Byte-exact round-trip test suite (UTF-8, UTF-8 BOM, UTF-16 LE/BE, Windows-1252, mixed line endings) gates every release. |
| Group tree drag and drop edge cases (dropping a group into its own child) | Pure tree-ops module with unit tests, UI only calls it. |
