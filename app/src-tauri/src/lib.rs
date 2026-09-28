//! Notepad 2.0 native shell: file IO, the app store, tray + Quick Note, single instance,
//! global hotkey and Windows integration. The UI lives in ../src (Preact + CodeMirror).

pub mod files;
pub mod integration;

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
fn store_delete(app: AppHandle, key: String) -> Result<(), String> {
    files::store_delete(&state(&app).store_root, &key)
}
#[tauri::command]
fn store_list(app: AppHandle, dir: String) -> Result<Vec<String>, String> {
    files::store_list(&state(&app).store_root, &dir)
}

// ------------------------------------------------------------------ commands: windows

fn show_main_window(app: &AppHandle) {
    if let Some(w) = app.get_webview_window("main") {
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
        .icon(app.default_window_icon().cloned().expect("bundle icon"))
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
                let _ = app.emit_to("main", "open-settings", ());
            }
            // The main window flushes unsaved state, then calls quit_app.
            "quit" => {
                let _ = app.emit_to("main", "quit-requested", ());
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
            let _ = app.emit_to("main", "second-instance", LaunchArgs { argv, cwd: Some(cwd) });
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
            app.manage(AppState { launch: Mutex::new(LaunchArgs { argv, cwd }), store_root: root });
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
            }
        })
        .invoke_handler(tauri::generate_handler![
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
