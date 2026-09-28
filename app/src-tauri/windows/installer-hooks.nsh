; Notepad 2.0 NSIS hooks (Tauri 2 installerHooks).
; Uninstall removes every registry key the app wrote: file associations, context menu,
; start-up entry, and the "Replace Notepad" IFEO redirect (one UAC prompt, only if ours),
; so Windows Notepad works normally again afterwards.

!macro NSIS_HOOK_PREUNINSTALL
  ExecWait '"$INSTDIR\notepad2.exe" --np2-cleanup'
!macroend
