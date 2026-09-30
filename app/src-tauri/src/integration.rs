//! Windows shell integration: file associations (the Directory Opus style "make default"
//! flow), the "Replace Notepad" IFEO switch, the Explorer context menu and start-up entry.
//!
//! Everything is per-user (HKCU) except IFEO, which lives in HKLM and needs one UAC prompt.
//! Windows guards the per-extension default (UserChoice) with a hash, so we never write it:
//! we register as a capable app and deep-link to Settings > Default apps for the one click.

use serde::Serialize;

pub const APP_KEY: &str = "Notepad2";
pub const PROGID_TXT: &str = "Notepad2.txt";
pub const PROGID_MD: &str = "Notepad2.md";
/// Every type Notepad 2.0 opens: offered in Open with (never made the default by itself).
pub const KNOWN_EXTS: &[&str] = &[
    ".txt", ".md", ".markdown", ".log", ".ini", ".cfg", ".conf", ".toml", ".json", ".yaml", ".yml", ".xml", ".csv", ".tsv", ".html", ".htm", ".xlsx", ".xls", ".ods", ".docx", ".pdf", ".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".bmp", ".ico",
];
pub const IFEO_KEY: &str = r"SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\notepad.exe";
pub const NOTEPAD_STYLE_FLAG: &str = "--notepad-style-cmdline";

#[derive(Serialize, Default, Debug)]
#[serde(rename_all = "camelCase")]
pub struct IntegrationState {
    pub supported: bool,
    pub exe_path: String,
    pub registered: bool,
    pub defaults: std::collections::BTreeMap<String, bool>,
    pub replace_notepad: bool,
    pub context_menu: bool,
    pub start_with_windows: bool,
}

pub fn progid_for(ext: &str) -> &'static str {
    match ext.to_ascii_lowercase().as_str() {
        ".md" | ".markdown" | ".mdown" | ".mkd" => PROGID_MD,
        _ => PROGID_TXT,
    }
}

/// Only ".something" with safe characters; anything else could write odd registry paths.
pub fn valid_ext(ext: &str) -> bool {
    ext.len() >= 2
        && ext.len() <= 16
        && ext.starts_with('.')
        && ext[1..].chars().all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '-')
}

pub fn open_command(exe: &str) -> String {
    format!("\"{exe}\" \"%1\"")
}

pub fn ifeo_debugger(exe: &str) -> String {
    format!("\"{exe}\" {NOTEPAD_STYLE_FLAG}")
}

/// Does a UserChoice ProgId belong to us?
pub fn is_our_progid(progid: &str) -> bool {
    let p = progid.to_ascii_lowercase();
    p.starts_with("notepad2.") || p.ends_with("\\notepad2.exe")
}

fn exe_path() -> String {
    std::env::current_exe().map(|p| p.to_string_lossy().into_owned()).unwrap_or_default()
}

// ------------------------------------------------------------------ Windows implementation

#[cfg(windows)]
mod imp {
    use super::*;
    use std::os::windows::process::CommandExt;
    use std::process::Command;
    use winreg::enums::*;
    use winreg::{RegKey, RegValue};

    const CREATE_NO_WINDOW: u32 = 0x0800_0000;

    fn hkcu() -> RegKey {
        RegKey::predef(HKEY_CURRENT_USER)
    }

    fn wide(s: &str) -> Vec<u16> {
        s.encode_utf16().chain(std::iter::once(0)).collect()
    }

    pub fn shell_open(target: &str) -> Result<(), String> {
        use windows_sys::Win32::UI::Shell::ShellExecuteW;
        let op = wide("open");
        let t = wide(target);
        // SW_SHOWNORMAL = 1. Return value > 32 means success.
        let r = unsafe { ShellExecuteW(std::ptr::null_mut(), op.as_ptr(), t.as_ptr(), std::ptr::null(), std::ptr::null(), 1) };
        if (r as isize) > 32 { Ok(()) } else { Err(format!("Windows could not open {target}")) }
    }

    /// File Explorer at a folder.
    pub fn open_folder(path: &str) -> Result<(), String> {
        Command::new("explorer.exe").arg(path).spawn().map(|_| ()).map_err(|e| e.to_string())
    }

    pub fn reveal(path: &str) -> Result<(), String> {
        Command::new("explorer.exe")
            .raw_arg(format!("/select,\"{path}\""))
            .spawn()
            .map(|_| ())
            .map_err(|e| e.to_string())
    }

    fn notify_assoc_changed() {
        use windows_sys::Win32::UI::Shell::{SHChangeNotify, SHCNE_ASSOCCHANGED, SHCNF_IDLIST};
        unsafe { SHChangeNotify(SHCNE_ASSOCCHANGED as _, SHCNF_IDLIST, std::ptr::null(), std::ptr::null()) };
    }

    fn write_progid(classes: &RegKey, progid: &str, label: &str, exe: &str) -> std::io::Result<()> {
        let (k, _) = classes.create_subkey(progid)?;
        k.set_value("", &label)?;
        k.set_value("FriendlyTypeName", &label)?;
        let (icon, _) = k.create_subkey("DefaultIcon")?;
        icon.set_value("", &format!("\"{exe}\",0"))?;
        let (cmd, _) = k.create_subkey(r"shell\open\command")?;
        cmd.set_value("", &open_command(exe))?;
        Ok(())
    }

    pub fn register(exts: &[String]) -> Result<(), String> {
        let exe = exe_path();
        let exts: Vec<String> = exts.iter().map(|e| e.to_ascii_lowercase()).filter(|e| valid_ext(e)).collect();
        let run = || -> std::io::Result<()> {
            let (classes, _) = hkcu().create_subkey(r"Software\Classes")?;
            write_progid(&classes, PROGID_TXT, "Text Document (Notepad 2.0)", &exe)?;
            write_progid(&classes, PROGID_MD, "Markdown Document (Notepad 2.0)", &exe)?;

            // "Open with" list entry for the exe itself.
            let (app, _) = classes.create_subkey(r"Applications\notepad2.exe")?;
            app.set_value("FriendlyAppName", &"Notepad 2.0")?;
            let (cmd, _) = app.create_subkey(r"shell\open\command")?;
            cmd.set_value("", &open_command(&exe))?;
            let (sup, _) = app.create_subkey("SupportedTypes")?;

            let (caps, _) = hkcu().create_subkey(format!(r"Software\{APP_KEY}\Capabilities"))?;
            caps.set_value("ApplicationName", &"Notepad 2.0")?;
            caps.set_value("ApplicationDescription", &"Notepad with grouped vertical tabs, Markdown, paper modes and a tray Quick Note.")?;
            caps.set_value("ApplicationIcon", &format!("\"{exe}\",0"))?;
            let _ = caps.delete_subkey_all("FileAssociations");
            let (fa, _) = caps.create_subkey("FileAssociations")?;

            for ext in &exts {
                let pid = progid_for(ext);
                let (owp, _) = classes.create_subkey(format!(r"{ext}\OpenWithProgids"))?;
                owp.set_raw_value(pid, &RegValue { bytes: vec![], vtype: REG_NONE })?;
                sup.set_value(ext, &"")?;
                fa.set_value(ext, &pid)?;
            }
            let (ra, _) = hkcu().create_subkey(r"Software\RegisteredApplications")?;
            ra.set_value(APP_KEY, &format!(r"Software\{APP_KEY}\Capabilities"))?;
            let (root, _) = hkcu().create_subkey(format!(r"Software\{APP_KEY}"))?;
            root.set_value("RegisteredExts", &exts.join(";"))?;
            root.set_value("ExePath", &exe)?;
            Ok(())
        };
        run().map_err(|e| format!("Registry write failed: {e}"))?;
        notify_assoc_changed();
        Ok(())
    }

    pub fn unregister() -> Result<(), String> {
        let cu = hkcu();
        let root_path = format!(r"Software\{APP_KEY}");
        let mut exts: Vec<String> = KNOWN_EXTS.iter().map(|s| s.to_string()).collect();
        if let Ok(root) = cu.open_subkey(&root_path) {
            if let Ok(list) = root.get_value::<String, _>("RegisteredExts") {
                exts.extend(list.split(';').filter(|s| !s.is_empty()).map(String::from));
            }
        }
        if let Ok(classes) = cu.open_subkey_with_flags(r"Software\Classes", KEY_ALL_ACCESS) {
            for ext in exts.iter().filter(|e| valid_ext(e)) {
                if let Ok(owp) = classes.open_subkey_with_flags(format!(r"{ext}\OpenWithProgids"), KEY_ALL_ACCESS) {
                    let _ = owp.delete_value(PROGID_TXT);
                    let _ = owp.delete_value(PROGID_MD);
                }
            }
            let _ = classes.delete_subkey_all(PROGID_TXT);
            let _ = classes.delete_subkey_all(PROGID_MD);
            let _ = classes.delete_subkey_all(r"Applications\notepad2.exe");
        }
        if let Ok(ra) = cu.open_subkey_with_flags(r"Software\RegisteredApplications", KEY_ALL_ACCESS) {
            let _ = ra.delete_value(APP_KEY);
        }
        let _ = cu.delete_subkey_all(format!(r"{root_path}\Capabilities"));
        if let Ok(root) = cu.open_subkey_with_flags(&root_path, KEY_ALL_ACCESS) {
            let _ = root.delete_value("RegisteredExts");
        }
        notify_assoc_changed();
        Ok(())
    }

    fn user_choice(ext: &str) -> Option<String> {
        let base = format!(r"Software\Microsoft\Windows\CurrentVersion\Explorer\FileExts\{ext}");
        // Windows 11 24H2 moved the live value to UserChoiceLatest; older builds use UserChoice.
        for sub in ["UserChoiceLatest", "UserChoice"] {
            if let Ok(k) = hkcu().open_subkey(format!(r"{base}\{sub}")) {
                if let Ok(v) = k.get_value::<String, _>("ProgId") {
                    return Some(v);
                }
                // Some 24H2 builds nest it one level down: UserChoiceLatest\ProgId\ProgId.
                if let Ok(v) = k.open_subkey("ProgId").and_then(|p| p.get_value::<String, _>("ProgId")) {
                    return Some(v);
                }
            }
        }
        None
    }

    fn ifeo_points_to_us() -> bool {
        let hklm = RegKey::predef(HKEY_LOCAL_MACHINE);
        hklm.open_subkey(IFEO_KEY)
            .and_then(|k| k.get_value::<String, _>("Debugger"))
            .map(|d| d.to_ascii_lowercase().contains("notepad2.exe"))
            .unwrap_or(false)
    }

    pub fn state() -> IntegrationState {
        let cu = hkcu();
        let registered = cu
            .open_subkey(r"Software\RegisteredApplications")
            .and_then(|k| k.get_value::<String, _>(APP_KEY))
            .is_ok();
        let defaults = KNOWN_EXTS
            .iter()
            .map(|e| (e.to_string(), user_choice(e).map(|p| is_our_progid(&p)).unwrap_or(false)))
            .collect();
        IntegrationState {
            supported: true,
            exe_path: exe_path(),
            registered,
            defaults,
            replace_notepad: ifeo_points_to_us(),
            context_menu: cu.open_subkey(r"Software\Classes\*\shell\Notepad2").is_ok(),
            start_with_windows: cu
                .open_subkey(r"Software\Microsoft\Windows\CurrentVersion\Run")
                .and_then(|k| k.get_value::<String, _>(APP_KEY))
                .is_ok(),
        }
    }

    pub fn set_context_menu(on: bool) -> Result<(), String> {
        let path = r"Software\Classes\*\shell\Notepad2";
        if !on {
            let _ = hkcu().delete_subkey_all(path);
            return Ok(());
        }
        let exe = exe_path();
        let r = (|| -> std::io::Result<()> {
            let (k, _) = hkcu().create_subkey(path)?;
            k.set_value("MUIVerb", &"Edit with Notepad 2.0")?;
            k.set_value("Icon", &format!("\"{exe}\",0"))?;
            let (c, _) = k.create_subkey("command")?;
            c.set_value("", &open_command(&exe))?;
            Ok(())
        })();
        r.map_err(|e| e.to_string())
    }

    pub fn set_start_with_windows(on: bool) -> Result<(), String> {
        let (run, _) = hkcu()
            .create_subkey(r"Software\Microsoft\Windows\CurrentVersion\Run")
            .map_err(|e| e.to_string())?;
        if on {
            run.set_value(APP_KEY, &format!("\"{}\" --hidden", exe_path())).map_err(|e| e.to_string())
        } else {
            let _ = run.delete_value(APP_KEY);
            Ok(())
        }
    }

    /// Relaunch ourselves elevated to flip the HKLM IFEO key. Blocks until the helper exits.
    pub fn elevate_ifeo(on: bool) -> Result<(), String> {
        let exe = exe_path().replace('\'', "''");
        let verb = if on { "set" } else { "clear" };
        let script = format!(
            "$p = Start-Process -FilePath '{exe}' -ArgumentList '--np2-ifeo','{verb}' -Verb RunAs -Wait -PassThru -WindowStyle Hidden; exit $p.ExitCode"
        );
        let status = Command::new("powershell.exe")
            .args(["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", &script])
            .creation_flags(CREATE_NO_WINDOW)
            .status()
            .map_err(|e| e.to_string())?;
        if ifeo_points_to_us() == on {
            Ok(())
        } else if !status.success() {
            Err("Windows did not grant admin rights (the UAC prompt was cancelled).".into())
        } else {
            Err("The Notepad redirect could not be changed.".into())
        }
    }

    /// Runs inside the elevated helper process.
    pub fn write_ifeo(on: bool) -> i32 {
        let hklm = RegKey::predef(HKEY_LOCAL_MACHINE);
        if on {
            match hklm.create_subkey(IFEO_KEY).and_then(|(k, _)| k.set_value("Debugger", &ifeo_debugger(&exe_path()))) {
                Ok(()) => 0,
                Err(_) => 2,
            }
        } else {
            match hklm.open_subkey_with_flags(IFEO_KEY, KEY_ALL_ACCESS) {
                Ok(k) => {
                    // Only remove what we own; leave another tool's debugger alone.
                    let ours = k.get_value::<String, _>("Debugger").map(|d| d.to_ascii_lowercase().contains("notepad2.exe")).unwrap_or(false);
                    if ours {
                        let _ = k.delete_value("Debugger");
                    }
                    drop(k);
                    // Remove the key only if we left it empty.
                    if let Ok(k) = hklm.open_subkey(IFEO_KEY) {
                        if k.enum_values().next().is_none() && k.enum_keys().next().is_none() {
                            let _ = hklm.delete_subkey(IFEO_KEY);
                        }
                    }
                    0
                }
                Err(_) => 0,
            }
        }
    }

    /// Uninstaller hook: remove every per-user key, then clear IFEO (one UAC prompt) if it is ours.
    pub fn cleanup() -> i32 {
        let _ = unregister();
        let _ = set_context_menu(false);
        let _ = set_start_with_windows(false);
        let _ = hkcu().delete_subkey_all(format!(r"Software\{APP_KEY}"));
        if ifeo_points_to_us() {
            let _ = elevate_ifeo(false);
        }
        0
    }
}

// ------------------------------------------------------------------ non-Windows stubs (dev builds)

#[cfg(not(windows))]
mod imp {
    use super::*;
    const NO: &str = "Windows integration is only available on Windows.";
    pub fn shell_open(target: &str) -> Result<(), String> {
        std::process::Command::new("xdg-open").arg(target).spawn().map(|_| ()).map_err(|e| e.to_string())
    }
    pub fn open_folder(path: &str) -> Result<(), String> {
        shell_open(path)
    }
    pub fn reveal(path: &str) -> Result<(), String> {
        let dir = std::path::Path::new(path).parent().map(|p| p.to_string_lossy().into_owned()).unwrap_or_default();
        shell_open(&dir)
    }
    pub fn register(_: &[String]) -> Result<(), String> { Err(NO.into()) }
    pub fn unregister() -> Result<(), String> { Err(NO.into()) }
    pub fn state() -> IntegrationState {
        IntegrationState { supported: false, exe_path: exe_path(), ..Default::default() }
    }
    pub fn set_context_menu(_: bool) -> Result<(), String> { Err(NO.into()) }
    pub fn set_start_with_windows(_: bool) -> Result<(), String> { Err(NO.into()) }
    pub fn elevate_ifeo(_: bool) -> Result<(), String> { Err(NO.into()) }
    pub fn write_ifeo(_: bool) -> i32 { 1 }
    pub fn cleanup() -> i32 { 0 }
}

pub use imp::*;

/// Helper modes handled in main() before the app starts. Returns an exit code if one ran.
pub fn run_elevated_helper(args: Vec<String>) -> Option<i32> {
    match args.get(1).map(String::as_str) {
        Some("--np2-ifeo") => Some(match args.get(2).map(String::as_str) {
            Some("set") => imp::write_ifeo(true),
            Some("clear") => imp::write_ifeo(false),
            _ => 1,
        }),
        Some("--np2-cleanup") => Some(imp::cleanup()),
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn progids() {
        assert_eq!(progid_for(".md"), PROGID_MD);
        assert_eq!(progid_for(".MARKDOWN"), PROGID_MD);
        assert_eq!(progid_for(".txt"), PROGID_TXT);
        assert_eq!(progid_for(".log"), PROGID_TXT);
    }

    #[test]
    fn known_exts_cover_every_viewer() {
        for e in [".xlsx", ".xls", ".ods", ".csv", ".tsv", ".json", ".yaml", ".yml", ".xml", ".toml", ".html", ".htm", ".docx", ".pdf", ".png", ".jpg", ".svg"] {
            assert!(KNOWN_EXTS.contains(&e), "{e}");
        }
        assert!(KNOWN_EXTS.iter().all(|e| valid_ext(e)));
    }

    #[test]
    fn ext_validation() {
        for ok in [".txt", ".md", ".c-sharp", ".x_y"] {
            assert!(valid_ext(ok), "{ok}");
        }
        for bad in ["txt", ".", r".a\b", ".a b", "..", ".verylongextension1"] {
            assert!(!valid_ext(bad), "{bad}");
        }
    }

    #[test]
    fn commands_are_quoted() {
        assert_eq!(open_command(r"C:\Program Files\N2\notepad2.exe"), r#""C:\Program Files\N2\notepad2.exe" "%1""#);
        assert_eq!(ifeo_debugger(r"C:\a b\notepad2.exe"), r#""C:\a b\notepad2.exe" --notepad-style-cmdline"#);
    }

    #[test]
    fn user_choice_matching() {
        assert!(is_our_progid("Notepad2.txt"));
        assert!(is_our_progid(r"Applications\notepad2.exe"));
        assert!(!is_our_progid("txtfile"));
        assert!(!is_our_progid(r"AppX4ztfk9yxwwrg5sqx2m2wp8ryjqbjsjqb"));
    }

    #[test]
    fn helper_modes() {
        assert_eq!(run_elevated_helper(vec!["x".into()]), None);
        assert_eq!(run_elevated_helper(vec!["x".into(), "file.txt".into()]), None);
        assert_eq!(run_elevated_helper(vec!["x".into(), "--np2-ifeo".into(), "bogus".into()]), Some(1));
    }
}
