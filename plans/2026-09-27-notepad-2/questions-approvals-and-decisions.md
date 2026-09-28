# Questions, approvals and decisions

1. **Stack.** Build on **Tauri 2 (recommended)** or **WinUI 3 / C#**? Tauri can be built and screenshot-tested from the VPS and CI; WinUI is Microsoft's own toolkit but Windows-only to build and still needs WebView2 for Markdown.
2. **Name and icon.** The mockups say "Notepad++ Advanced". Notepad++ is someone else's trademark, and Microsoft owns "Notepad" and its icon, and you've had a cease-and-desist before. Pick: **"Notepad 2.0" as a working title only**, **a new name (e.g. Leaf, Jot, Slate)**, or **a GodMode-branded name**. The layout can look like Notepad; the name and icon have to be ours.
3. **Quick Note Save button.** Quick notes autosave, so the mock's Save button would do nothing. Make it **"Save as file..."** or **remove it**?
4. **Close (X) behaviour.** Should X **quit like Notepad (tray via its own button)** or **go to tray by default**?
5. **Replace Notepad globally.** Ship the IFEO **"Replace Notepad" toggle** (one admin prompt, affects every program that launches notepad.exe) or **default-app registration only**?
6. **Code signing.** Stay **unsigned (SmartScreen warning once)** or pay for **Azure Trusted Signing** (monthly fee, needs your ID verification)?
7. **Extra file types.** Register only **.txt and .md**, or also **.log, .ini, .cfg, .json, .csv**?
8. **Build go-ahead.** Queue the build as **one long fable mission (P0 to P8)** or **phase by phase with screenshots between**?
