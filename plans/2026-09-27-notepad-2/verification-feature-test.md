# Verification and feature tests

Automated (CI, every push): `pnpm typecheck`, `pnpm test` (vitest), `pnpm e2e` (Playwright against the browser build with the Tauri mock, screenshot diffing), `cargo test` for the Rust side.

| Feature | Test | Pass condition |
|---|---|---|
| Parity | Screenshot diff vs. reference Notepad captures, light + dark | Layout within 2 px, same fonts |
| Shortcuts | Playwright walks the full shortcut table | Every action fires |
| Encoding round-trip | Open + save untouched: UTF-8, UTF-8 BOM, UTF-16 LE/BE, 1252, CRLF / LF / CR / mixed | Output bytes identical to input |
| Big file | 50 MB log | Opens under 2 s, typing latency under 16 ms |
| Tabs modes | Toggle Top / Left / Rail | State persists across restart |
| Groups | Create, colour, nest 4 deep, drag note in/out, drag group into sibling, attempt into own child | Tree correct, cycle rejected, persists |
| Paper | Each mode at 50%, 100%, 300% zoom, wrap on | Rules align to lines at every zoom |
| Markdown | CommonMark 0.31 + GFM spec suites through our pipeline | 100% pass |
| Markdown files | Open README-style docs with tables, footnotes, maths, Mermaid, HTML, front matter | Renders, saving unchanged file is byte-identical |
| Save model | Kill the process mid-typing in each doc kind | Untitled/quick: nothing lost. File: recovery prompt, file on disk untouched |
| External change | Edit file in another app while clean / dirty | Silent reload / yellow bar |
| Tray | Close to tray, hotkey, click tray | Bubble opens anchored above tray on each monitor/taskbar side, focus in text |
| Quick note autosave | Type, wait 1 s, kill process | Text in `notes\` |
| Default apps | Run the Settings flow on a clean VM | Explorer double-click opens ours |
| Replace Notepad | Win+R `notepad file.txt`, `start notepad`, another app's "Edit" verb | All open ours with the file; toggle off restores Notepad |
| Uninstall | Uninstall on the VM | No leftover keys, Notepad works normally |

Manual on the Home PC: the Kaine checklist in `kaine-action-items-to-complete.md`.
