# Sub-plan 06: tray icon and Quick Note bubble (P6)

## Close to tray
- A title-bar button (down-arrow-into-tray icon) left of minimise, plus setting "Close button (X) sends to tray instead of quitting". Tray menu: Open Notepad 2.0, New Quick Note, Recent quick notes >, Settings, Quit.
- Single-instance: launching the exe again (or double-clicking a file) focuses the running window and opens the file in a new tab.
- "Start with Windows (in tray)" setting via the Run key.

## Quick Note bubble (screenshots bottom-right)
- Separate frameless, always-on-top Tauri window, rounded corners, Mica/Acrylic backdrop, shadow.
- Opens on: left-click tray icon, global hotkey (default `Win+Alt+N`, rebindable), or tray menu.
- Anchors bottom-right above the taskbar (reads the work area of the monitor with the tray; handles top/left taskbars), slides up 180 ms.
- Size presets: **1/8 screen** (default, ~ 480 x 540 on 1440p) or **1/4 screen**, plus free resize remembered.
- Header: icon, "Quick Note", `...` menu (Open in main window, Move to group >, New quick note, Pin on top, Size), close.
- Body: title line + text area, focus lands in the text area immediately so you just type. Markdown highlighting on.
- Autosaves continuously (sub-plan 05). The Save button in the mock becomes "Save as file..." since saving is automatic; confirm with Kaine.
- Esc or clicking elsewhere hides it (setting "Hide on focus loss"). Contents persist; next open resumes the same note, `Ctrl+N` inside starts a new one.
- Every quick note lands in a built-in "Quick Notes" group in the main window's sidebar, newest first.
