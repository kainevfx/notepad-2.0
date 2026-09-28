# Kaine action items

## Now
- [ ] Decisions still open in `questions-approvals-and-decisions.md`: name/icon (2), code signing (6). The build went ahead on the recommended defaults for the rest (Tauri; Quick Note button = "Save as file..."; X goes to tray, switchable in Settings; Replace Notepad shipped as an opt-in toggle; all 8 file types offered).
- [ ] Get a Windows build, either way:
  - **GitHub:** create `kainevfx/notepad-2.0`, push the `app/` folder, open Actions > build-windows > download `notepad2-windows`.
  - **Home PC:** copy `app/` over, then `npm ci` and `npx tauri build` (needs Node 24 + Rust from rustup.rs).

## First run on the Home PC
- [ ] Install the NSIS `.exe` (per-user, no admin). SmartScreen will warn once: More info > Run anyway (unsigned).
- [ ] Open it next to Windows Notepad in light and dark; flag anything that looks different.
- [ ] Close to tray, click the tray icon, press Win+Alt+N: the Quick Note bubble should appear above the tray and autosave.

## Make it the default
- [ ] Settings > Windows integration > "Use Notepad 2.0 instead of Windows Notepad" (one UAC prompt), then click **Set default** on the Windows page it opens.
- [ ] Open App execution aliases from the same page and turn off the Notepad alias.
- [ ] Test: Win+R `notepad` opens ours. Double-click a `.md` in Explorer opens ours in split preview.
- [ ] To undo: flip the switch off, or uninstall (removes every key, including the notepad.exe redirect).

Nothing here spends money unless you choose code signing.
