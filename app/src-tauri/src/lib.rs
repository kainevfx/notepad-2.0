//! Notepad 2.0 native shell: file IO, the app store, tray + Quick Note, single instance,
//! global hotkey and Windows integration. The UI lives in ../src (Preact + CodeMirror).

pub mod files;
pub mod integration;
pub mod sheets;
pub mod speech;
pub mod windows;

use serde::Serialize;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Emitter, Manager, WindowEvent};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};

#[derive(Serialize, Clone)]
struct LaunchArgs {
    argv: Vec<String>,
    cwd: Option<String>,
}

struct AppState {
    launch: Mutex<LaunchArgs>,
    store_root: PathBuf,
}

fn state(app: &AppHandle) -> tauri::State<'_, AppState> {
    app.state::<AppState>()
}

// ------------------------------------------------------------------ commands: files

#[tauri::command]
fn get_launch_args(app: AppHandle) -> LaunchArgs {
    state(&app).launch.lock().unwrap().clone()
}

#[tauri::command]
async fn read_file(path: String) -> Result<tauri::ipc::Response, String> {
    std::fs::read(&path).map(tauri::ipc::Response::new).map_err(|e| format!("Could not open {path}: {e}"))
}

#[tauri::command]
fn file_stat(path: String) -> files::FileStat {
    files::stat(std::path::Path::new(&path))
}

/// Raw-body command: the file bytes come as the IPC body, the target path in an x-path header.
#[tauri::command]
async fn write_file(request: tauri::ipc::Request<'_>) -> Result<f64, String> {
    let tauri::ipc::InvokeBody::Raw(bytes) = request.body() else {
        return Err("write_file expects raw bytes".into());
    };
    let enc = request.headers().get("x-path").ok_or("missing x-path header")?.to_str().map_err(|e| e.to_string())?;
    let path = percent_encoding::percent_decode_str(enc).decode_utf8().map_err(|e| e.to_string())?.into_owned();
    files::write_atomic(std::path::Path::new(&path), bytes)
}

#[tauri::command]
fn store_read(app: AppHandle, key: String) -> Result<Option<String>, String> {
    files::store_read(&state(&app).store_root, &key)
}
#[tauri::command]
fn store_write(app: AppHandle, key: String, text: String) -> Result<(), String> {
    files::store_write(&state(&app).store_root, &key, &text)
}
#[tauri::command]
fn store_claim(app: AppHandle, key: String) -> Result<Option<String>, String> {
    files::store_claim(&state(&app).store_root, &key)
}

/// This launch was "start with Windows in the tray" (--hidden): no window shows itself.
#[tauri::command]
fn launch_hidden(app: AppHandle) -> bool {
    state(&app).launch.lock().unwrap().argv.iter().any(|a| a == "--hidden")
}

#[tauri::command]
fn store_delete(app: AppHandle, key: String) -> Result<(), String> {
    files::store_delete(&state(&app).store_root, &key)
}
#[tauri::command]
fn store_list(app: AppHandle, dir: String) -> Result<Vec<String>, String> {
    files::store_list(&state(&app).store_root, &dir)
}

// ------------------------------------------------------------------ commands: windows

/// The Notepad 2.0 window used most recently (launches, the tray and Quick Note go there).
fn last_main(app: &AppHandle) -> String {
    let last = app.state::<windows::WinState>().last();
    if app.get_webview_window(&last).is_some() {
        last
    } else {
        app.webview_windows().keys().find(|l| windows::is_main_label(l)).cloned().unwrap_or_else(|| "main".into())
    }
}

fn show_main_window(app: &AppHandle) {
    if let Some(w) = app.get_webview_window(&last_main(app)) {
        let _ = w.show();
        let _ = w.unminimize();
        let _ = w.set_focus();
    }
}

fn show_quicknote_window(app: &AppHandle) {
    if let Some(w) = app.get_webview_window("quicknote") {
        let _ = w.show();
        let _ = w.set_focus();
        // The bubble re-anchors itself above the tray and focuses its editor.
        let _ = app.emit_to("quicknote", "quicknote-shown", ());
    }
}

fn toggle_quicknote(app: &AppHandle) {
    if let Some(w) = app.get_webview_window("quicknote") {
        if w.is_visible().unwrap_or(false) && w.is_focused().unwrap_or(false) {
            let _ = w.hide();
        } else {
            show_quicknote_window(app);
        }
    }
}

#[tauri::command]
fn show_main(app: AppHandle) {
    show_main_window(&app);
}

#[tauri::command]
fn show_quicknote(app: AppHandle) {
    show_quicknote_window(&app);
}

/// Start Windows voice typing (the same as pressing Win+H) in the focused window.
#[tauri::command]
fn start_voice_typing(app: AppHandle) -> Result<(), String> {
    // Only ever type Win+H into the Quick Note itself.
    let focused = app.get_webview_window("quicknote").map(|w| w.is_focused().unwrap_or(false)).unwrap_or(false);
    if !focused {
        return Err("Click in the Quick Note first.".into());
    }
    #[cfg(windows)]
    {
        use windows_sys::Win32::UI::Input::KeyboardAndMouse::{SendInput, INPUT, INPUT_0, INPUT_KEYBOARD, KEYBDINPUT, KEYEVENTF_KEYUP, VK_LWIN};
        let key = |vk: u16, up: bool| INPUT {
            r#type: INPUT_KEYBOARD,
            Anonymous: INPUT_0 { ki: KEYBDINPUT { wVk: vk, wScan: 0, dwFlags: if up { KEYEVENTF_KEYUP } else { 0 }, time: 0, dwExtraInfo: 0 } },
        };
        let h = b'H' as u16;
        let inputs = [key(VK_LWIN, false), key(h, false), key(h, true), key(VK_LWIN, true)];
        let sent = unsafe { SendInput(inputs.len() as u32, inputs.as_ptr(), std::mem::size_of::<INPUT>() as i32) };
        if sent as usize != inputs.len() {
            return Err("Windows voice typing could not be started.".into());
        }
        Ok(())
    }
    #[cfg(not(windows))]
    Err("Voice typing needs Windows.".into())
}

#[tauri::command]
fn quit_app(app: AppHandle) {
    app.exit(0);
}

// ------------------------------------------------------------------ commands: shell + integration

#[tauri::command]
fn open_url(url: String) -> Result<(), String> {
    let lower = url.to_ascii_lowercase();
    if !(lower.starts_with("https://") || lower.starts_with("http://") || lower.starts_with("mailto:")) {
        return Err("Only web and mail links can be opened.".into());
    }
    integration::shell_open(&url)
}

#[tauri::command]
fn rename_file(from: String, to: String) -> Result<(), String> {
    files::rename_no_overwrite(std::path::Path::new(&from), std::path::Path::new(&to))
}

#[tauri::command]
fn path_kind(path: String) -> &'static str {
    files::path_kind(std::path::Path::new(&path))
}

/// Every sheet of a workbook as cell text (at most 200,000 cells per sheet).
#[tauri::command]
async fn read_sheet(path: String) -> Result<sheets::Workbook, String> {
    sheets::read_sheet(std::path::Path::new(&path), 200_000)
}

#[tauri::command]
fn open_folder(path: String) -> Result<(), String> {
    integration::open_folder(&path)
}

/// A file in its default Windows app (e.g. a workbook too large to preview).
#[tauri::command]
fn open_default(path: String) -> Result<(), String> {
    integration::shell_open(&path)
}

#[tauri::command]
fn reveal_in_explorer(path: String) -> Result<(), String> {
    integration::reveal(&path)
}

#[tauri::command]
fn integration_state() -> integration::IntegrationState {
    integration::state()
}

#[tauri::command]
async fn register_file_types(exts: Vec<String>) -> Result<(), String> {
    integration::register(&exts)
}

#[tauri::command]
async fn unregister_file_types() -> Result<(), String> {
    integration::unregister()
}

#[tauri::command]
async fn open_default_apps() -> Result<(), String> {
    // Windows 11 22H2+ jumps straight to our app's page; older builds land on Default apps.
    integration::shell_open(&format!("ms-settings:defaultapps?registeredAppUser={}", integration::APP_KEY))
        .or_else(|_| integration::shell_open("ms-settings:defaultapps"))
}

#[tauri::command]
async fn set_replace_notepad(on: bool) -> Result<(), String> {
    integration::elevate_ifeo(on)
}

#[tauri::command]
async fn set_context_menu(on: bool) -> Result<(), String> {
    integration::set_context_menu(on)
}

#[tauri::command]
async fn set_start_with_windows(on: bool) -> Result<(), String> {
    integration::set_start_with_windows(on)
}

#[tauri::command]
async fn open_alias_settings() -> Result<(), String> {
    integration::shell_open("ms-settings:advanced-apps")
}

// ------------------------------------------------------------------ tray

/// The tray icon: a sheet of yellow writing paper (assets/icon/tray-icon.svg, rendered to 32 px).
const TRAY_ICON: &[u8] = include_bytes!("../icons/tray.png");

fn build_tray(app: &AppHandle) -> tauri::Result<()> {
    let open = MenuItem::with_id(app, "open", "Open Notepad 2.0", true, None::<&str>)?;
    let quick = MenuItem::with_id(app, "quick", "Quick Note\tWin+Alt+N", true, None::<&str>)?;
    let new_quick = MenuItem::with_id(app, "new-quick", "New Quick Note", true, None::<&str>)?;
    let settings = MenuItem::with_id(app, "settings", "Settings", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "Exit", true, None::<&str>)?;
    let sep1 = PredefinedMenuItem::separator(app)?;
    let sep2 = PredefinedMenuItem::separator(app)?;
    let menu = Menu::with_items(app, &[&open, &quick, &new_quick, &sep1, &settings, &sep2, &quit])?;

    TrayIconBuilder::with_id("main-tray")
        .icon(tauri::image::Image::from_bytes(TRAY_ICON)?)
        .tooltip("Notepad 2.0: click for Quick Note")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, e| match e.id.as_ref() {
            "open" => show_main_window(app),
            "quick" => show_quicknote_window(app),
            "new-quick" => {
                show_quicknote_window(app);
                let _ = app.emit_to("quicknote", "quicknote-new", ());
            }
            "settings" => {
                let _ = app.emit_to(last_main(app).as_str(), "open-settings", ());
            }
            // The last-used window asks every window to flush unsaved state, then calls quit_app.
            "quit" => {
                let _ = app.emit_to(last_main(app).as_str(), "quit-requested", ());
            }
            _ => {}
        })
        .on_tray_icon_event(|tray, e| match e {
            TrayIconEvent::Click { button: MouseButton::Left, button_state: MouseButtonState::Up, .. } => {
                toggle_quicknote(tray.app_handle());
            }
            TrayIconEvent::DoubleClick { button: MouseButton::Left, .. } => show_main_window(tray.app_handle()),
            _ => {}
        })
        .build(app)?;
    Ok(())
}

// ------------------------------------------------------------------ entry

fn store_root(app: &AppHandle) -> PathBuf {
    // %APPDATA%\Notepad2 on Windows (Roaming), ~/.local/share/Notepad2 elsewhere.
    app.path().data_dir().map(|d| d.join("Notepad2")).unwrap_or_else(|_| PathBuf::from("Notepad2-data"))
}

pub fn run() {
    let argv: Vec<String> = std::env::args().collect();
    let cwd = std::env::current_dir().ok().map(|p| p.to_string_lossy().into_owned());
    let quick_hotkey = Shortcut::new(Some(Modifiers::SUPER | Modifiers::ALT), Code::KeyN);

    tauri::Builder::default()
        // Must be first: a second launch (double-clicked file, IFEO redirect) forwards its
        // argv to the running instance and exits.
        .plugin(tauri_plugin_single_instance::init(|app, argv, cwd| {
            let _ = app.emit_to(last_main(app).as_str(), "second-instance", LaunchArgs { argv, cwd: Some(cwd) });
        }))
        .plugin(tauri_plugin_dialog::init())
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(move |app, sc, ev| {
                    if sc == &quick_hotkey && ev.state() == ShortcutState::Pressed {
                        toggle_quicknote(app);
                    }
                })
                .build(),
        )
        .setup(move |app| {
            let handle = app.handle().clone();
            let root = store_root(&handle);
            let _ = std::fs::create_dir_all(root.join("notes"));
            app.manage(windows::WinState::load(&root));
            app.manage(AppState { launch: Mutex::new(LaunchArgs { argv, cwd }), store_root: root });
            // Every window that was open last time comes back where it was.
            let root2 = store_root(&handle);
            windows::restore(&handle, &root2);
            build_tray(&handle)?;
            // Another app may already own Win+Alt+N; the tray still works without it.
            if let Err(e) = handle.global_shortcut().register(quick_hotkey) {
                eprintln!("Quick Note hotkey unavailable: {e}");
            }
            Ok(())
        })
        .on_window_event(|w, e| {
            // The bubble never closes, it hides. The main window's close is handled in the UI
            // (tray or quit per settings), which prevents the default close itself.
            if w.label() == "quicknote" {
                if let WindowEvent::CloseRequested { api, .. } = e {
                    api.prevent_close();
                    let _ = w.hide();
                }
            } else if windows::is_main_label(w.label()) {
                match e {
                    WindowEvent::Focused(true) => windows::record_focus(w.app_handle(), w.label()),
                    WindowEvent::Moved(_) | WindowEvent::Resized(_) => windows::record_geometry(w.app_handle(), w.label()),
                    _ => {}
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            speech::kokoro_speech,
            get_launch_args,
            read_file,
            file_stat,
            write_file,
            store_read,
            store_write,
            store_delete,
            store_list,
            show_main,
            show_quicknote,
            quit_app,
            open_url,
            reveal_in_explorer,
            path_kind,
            open_folder,
            open_default,
            read_sheet,
            rename_file,
            start_voice_typing,
            store_claim,
            launch_hidden,
            windows::open_window,
            windows::window_at,
            windows::last_window,
            windows::last_other_window,
            windows::window_count,
            windows::focus_window,
            windows::register_open_files,
            windows::window_with_file,
            windows::close_window,
            integration_state,
            register_file_types,
            unregister_file_types,
            open_default_apps,
            set_replace_notepad,
            set_context_menu,
            set_start_with_windows,
            open_alias_settings,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Notepad 2.0");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn tray_icon_is_a_32px_png() {
        let img = tauri::image::Image::from_bytes(TRAY_ICON).unwrap();
        assert_eq!((img.width(), img.height()), (32, 32));
    }
}
