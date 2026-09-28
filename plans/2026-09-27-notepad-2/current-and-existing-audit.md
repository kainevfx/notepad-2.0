# Current and existing audit

_2026-09-27_

## What exists in the project
- Dev path `/srv/claudette-data/uploads/projects/f4b495f3-.../` was empty before this plan.
- GitHub repo set on the project: `https://github.com/kainevfx/notepad-2.0.git` (not yet checked for contents; first build mission clones or initialises it).
- 4 reference screenshots, now copied to `assets/reference/`.

## What we are replacing: Windows 11 Notepad (2024 to 2026 builds)
Has: tabs in the title bar, session restore of unsaved tabs, dark mode, Mica, find/replace, spell check, word wrap, zoom, status bar, basic Markdown formatting toggle (recent Insider builds), Copilot "Rewrite" button, character count.
Missing (our additions): vertical tabs, groups, nesting, colours, paper modes, full GFM preview with tables/maths/diagrams, tray quick notes, per-document autosave rules.
Keep out: Copilot/AI buttons and sign-in prompts. Parity means the core editor, not the upsell.

## Adjacent tools and what we take from each
| Tool | Useful idea | Not copying |
|---|---|---|
| Notepad++ | IFEO "replace Notepad" mechanism, `-notepadStyleCmdline` handling | Its dated Win32 UI |
| Notepad3 | Same IFEO approach, tiny footprint | |
| Chrome / Edge | Tab groups: colour palette of 9, collapse, drag into group, name chips | Edge's vertical tabs only have one level; we do nested |
| Obsidian / Typora | Split preview, GFM completeness | Vault model, proprietary rendering quirks |
| Directory Opus | Settings page that shows "is default: yes/no" and fixes it with one button | |
| Microsoft PowerToys / Sticky Notes | Tray-anchored mini window pattern | |

## Conflicts
- None with Claudette OS. This is a standalone Windows app. Nothing touches `src/`, `web/` or services.
