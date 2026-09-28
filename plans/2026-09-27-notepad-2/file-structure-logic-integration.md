# File structure, logic and integration

## Repo (`kainevfx/notepad-2.0`, working copy at the project dev path under `app/`)
```
app/
  package.json  pnpm-lock.yaml  vite.config.ts  tsconfig.json
  src/
    main.tsx                 app entry (main window)
    quicknote.tsx            entry for the Quick Note window
    platform/                tauri.ts | browser-mock.ts | index.ts (interface)
    state/                   workspace store, settings store, session
    tree/tree-ops.ts         pure group-tree operations (+ tree-ops.test.ts)
    editor/                  CodeMirror setup, paper.ts, markdown-lang.ts, keymap.ts
    markdown/pipeline.ts     unified/remark/rehype chain (+ spec tests)
    ui/                      TitleBar, TabStrip, Sidebar, GroupHeader, StatusBar, MenuBar, FindBar, PaperToolbar, Preview, Settings/*
    styles/fluent.css        Notepad / Fluent 2 tokens, light + dark
  src-tauri/
    tauri.conf.json          windows: main + quicknote, fileAssociations, tray, updater
    src/main.rs              setup, single-instance, argv parsing (notepad-style)
    src/files.rs             encoding detect, atomic save, watcher
    src/registry.rs          default-app registration, IFEO toggle (elevated helper), context menu
    src/tray.rs              tray icon, menu, bubble positioning
  e2e/                       Playwright specs + screenshot baselines
  .github/workflows/         ci.yml, release.yml
assets/reference/            Kaine's 4 mockups
plans/2026-09-27-notepad-2/  this document set
```

## Runtime data (`%APPDATA%\Notepad2\`)
`settings.json`, `workspace.json` (group tree), `session.json` (open tabs, caret, scroll), `notes\*.md`, `recovery\*.json`, `logs\`.

## Integration points
- Windows Shell: ProgIDs, Capabilities, RegisteredApplications, IFEO, context-menu verb (sub-plan 07).
- WebView2 runtime (preinstalled on Win11; installer bootstraps it on Win10).
- GitHub Releases for installers and the updater feed.
- Claudette OS: none at runtime. Build missions only.
