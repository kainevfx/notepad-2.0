# Sub-plan 05: save model and autosave (P5)

## Stores (under `%APPDATA%\Notepad2\`)
- `notes\<id>.md` untitled notes and quick notes (plain files, readable without the app).
- `recovery\<id>.json` unsaved edits to on-disk files: `{ path, baseMtime, baseHash, text, encoding, eol }`.
- `workspace.json`, `settings.json`, `session.json`.

## Behaviour
| Event | Untitled / Quick note | File on disk (default) | File on disk (autosave on) |
|---|---|---|---|
| Typing | debounce 500 ms, write to `notes\` | debounce 1 s, write to `recovery\` only | debounce 1 s, atomic write to the file |
| Tab dirty dot | never | yes until Ctrl+S | never |
| Close tab | kept in store, tab closes (can reopen from "Notes" list) | Save / Don't save / Cancel | closes |
| App crash / power cut | nothing lost | recovery offers the edits on next start | at most 1 s lost |
| Save as | moves from store to disk, becomes a "file" doc | normal | normal |

## External changes
File watcher (`notify` crate). If a clean file changes on disk, reload silently. If dirty, yellow bar: "Changed on disk: Reload / Keep mine / Compare".

## Atomic write
Write `<name>.~n2tmp` in the same folder, flush, `ReplaceFileW` (keeps ACLs, timestamps of creation, alternate streams) with rename fallback. Read-only files prompt to Save as.

## Settings
- Autosave opened files: off (global), overridable per group ("Autosave everything in this group").
- Autosave delay: 0.5 to 10 s.
- Keep untitled notes for: forever / 30 days after close / delete on close.
