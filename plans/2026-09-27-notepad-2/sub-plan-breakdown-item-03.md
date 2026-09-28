# Sub-plan 03: paper modes (P3)

Floating segmented toolbar (screenshots 2 to 4): **Grid**, **Lines**, **Numbers**, **None**. Appears from View > Paper and from a title-bar button; auto-hides after selection, like the screenshot's popover.

| Mode | Rendering |
|---|---|
| None | Plain Notepad canvas. |
| Numbers | CodeMirror `lineNumbers()` gutter, current line bold (screenshot 3). Numbers count logical lines, so wrapped lines leave a gap (as in the mock). |
| Lines | Ruled writing paper: `repeating-linear-gradient` on the content layer with the pitch bound to the editor's `--line-height`, so rules sit under every visual line including wrapped ones. Optional red margin rule. Rules follow zoom. |
| Grid | Graph paper: two gradients, minor cell = one line height, major line every 5 cells. |

- Paper can combine with Numbers (checkbox "Also show line numbers") because Kaine's screenshots show Grid and Lines with numbers visible.
- Default is global; "Remember per tab" setting stores the choice on the NoteNode.
- Colours derive from the theme: 6 to 8 percent contrast rules in dark, faint blue rules in light (paper feel).
- Printing respects the chosen paper (Page setup checkbox).
