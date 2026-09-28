# Sub-plan 07: Windows integration, installer, updates (P7 + P8)

## Settings > Default apps page (Directory Opus style)
Shows live state read from the registry, each with a button:

| Row | State shown | Button does |
|---|---|---|
| Default for `.txt` | Yes / No (reads `UserChoice\ProgId`) | Registers, then opens `ms-settings:defaultapps?registeredAppUser=Notepad2` |
| Default for `.md` / `.markdown` | Yes / No | same |
| Replace Notepad (`notepad.exe` launches us) | On / Off | Elevated helper writes or deletes the IFEO key (one UAC prompt) |
| Windows Notepad app alias | On / Off | Opens `ms-settings:advanced-apps` (App execution aliases) |
| "Edit with Notepad 2.0" in right-click menu | On / Off | Writes `HKCU\Software\Classes\*\shell\Notepad2` |

## Registry written (all HKCU except IFEO)
```
HKCU\Software\Classes\Notepad2.txt\shell\open\command  = "<exe>" "%1"
HKCU\Software\Classes\Notepad2.md\shell\open\command   = "<exe>" "%1"
HKCU\Software\Classes\.txt\OpenWithProgids   Notepad2.txt
HKCU\Software\Classes\.md\OpenWithProgids    Notepad2.md
HKCU\Software\Notepad2\Capabilities  ApplicationName, ApplicationDescription
HKCU\Software\Notepad2\Capabilities\FileAssociations  .txt=Notepad2.txt  .md=Notepad2.md  .markdown=Notepad2.md  .log .ini .cfg .json (optional)
HKCU\Software\RegisteredApplications  Notepad2 = Software\Notepad2\Capabilities
HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\notepad.exe
     Debugger = "<exe>" --notepad-style-cmdline
```
After writing: `SHChangeNotify(SHCNE_ASSOCCHANGED)`.

## Why there is always one click
Windows protects `UserChoice` with a hash tied to the user and machine. Tools that forge it (SetUserFTA style) break on updates and get flagged by Defender. We use the supported route: register, then deep-link Kaine to our app's page in Default apps where he clicks "Set default". The page in our settings then flips to "Yes".

## Notepad-style command line
When launched via IFEO, argv is `<our exe> --notepad-style-cmdline C:\Windows\System32\notepad.exe [/A|/W|/P] [file]`. Parser drops the notepad path, honours `/P` (print), opens the file. Covered by unit tests with every shape we have seen (quoted, unquoted with spaces, no file).

## Installer and updates
- NSIS per-user installer (no admin needed except the IFEO toggle), MSI for completeness.
- Uninstall removes every key above, including IFEO, and restores nothing it did not own.
- Tauri updater against GitHub Releases of `kainevfx/notepad-2.0`, signed with a Tauri update key (stored in the vault, never in the repo).
- Code signing optional: without it SmartScreen shows "unrecognised app" once. Azure Trusted Signing is the cheapest real option (paid, Kaine decides).
