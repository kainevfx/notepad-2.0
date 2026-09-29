//! Several main windows ("main", "main-2", …): which exist, where they are, which was used last,
//! and which files each has open. Saved as windows.json in the app store so every window comes
//! back after a restart.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager, PhysicalPosition, PhysicalSize, WebviewUrl, WebviewWindowBuilder};

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
pub struct WindowRect {
    pub label: String,
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
    #[serde(default)]
    pub maximized: bool,
}

#[derive(Serialize, Deserialize, Clone, Debug, Default, PartialEq)]
pub struct WindowsFile {
    pub windows: Vec<WindowRect>,
    /// Labels, most recently used first.
    pub order: Vec<String>,
}

// ------------------------------------------------------------------ pure helpers

/// The next free label: main-2, main-3, …
pub fn next_label(existing: &[String]) -> String {
    (2..).map(|n| format!("main-{n}")).find(|l| !existing.contains(l)).unwrap()
}

/// Move `label` to the front of the recency order.
pub fn touch(order: &mut Vec<String>, label: &str) {
    order.retain(|l| l != label);
    order.insert(0, label.to_string());
}

/// The most recently used window whose rectangle contains the point (screen pixels).
pub fn hit_test(file: &WindowsFile, x: i32, y: i32, exclude: &str) -> Option<String> {
    let inside = |r: &WindowRect| x >= r.x && y >= r.y && x < r.x + r.width as i32 && y < r.y + r.height as i32;
    file.order
        .iter()
        .filter(|l| l.as_str() != exclude)
        .find(|l| file.windows.iter().any(|r| &r.label == *l && inside(r)))
        .cloned()
}

pub fn is_main_label(label: &str) -> bool {
    label == "main" || label.starts_with("main-")
}

pub fn read_file(path: &Path) -> WindowsFile {
    std::fs::read_to_string(path).ok().and_then(|s| serde_json::from_str(&s).ok()).unwrap_or_default()
}

// ------------------------------------------------------------------ runtime state

pub struct WinState {
    pub file: Mutex<WindowsFile>,
    pub open_files: Mutex<HashMap<String, Vec<String>>>,
    pub path: PathBuf,
}

impl WinState {
    pub fn load(store_root: &Path) -> Self {
        let path = store_root.join("windows.json");
        WinState { file: Mutex::new(read_file(&path)), open_files: Mutex::new(HashMap::new()), path }
    }
    pub fn save(&self) {
        let f = self.file.lock().unwrap().clone();
        if let Ok(json) = serde_json::to_string_pretty(&f) {
            let _ = std::fs::write(&self.path, json);
        }
    }
    pub fn last(&self) -> String {
        self.file.lock().unwrap().order.first().cloned().unwrap_or_else(|| "main".into())
    }
}

fn ws(app: &AppHandle) -> tauri::State<'_, WinState> {
    app.state::<WinState>()
}

/// Record a window's current position and size.
pub fn record_geometry(app: &AppHandle, label: &str) {
    let Some(w) = app.get_webview_window(label) else { return };
    let (Ok(pos), Ok(size)) = (w.outer_position(), w.outer_size()) else { return };
    let maximized = w.is_maximized().unwrap_or(false);
    let state = ws(app);
    {
        let mut f = state.file.lock().unwrap();
        let rect = WindowRect { label: label.into(), x: pos.x, y: pos.y, width: size.width, height: size.height, maximized };
        match f.windows.iter_mut().find(|r| r.label == label) {
            Some(r) => *r = rect,
            None => f.windows.push(rect),
        }
        if !f.order.iter().any(|l| l == label) {
            f.order.push(label.into());
        }
    }
    state.save();
}

pub fn record_focus(app: &AppHandle, label: &str) {
    let state = ws(app);
    touch(&mut state.file.lock().unwrap().order, label);
    state.save();
}

pub fn count(app: &AppHandle) -> usize {
    app.webview_windows().keys().filter(|l| is_main_label(l)).count()
}

pub fn notify_changed(app: &AppHandle) {
    let n = count(app);
    for (label, w) in app.webview_windows() {
        if is_main_label(&label) {
            let _ = w.emit("windows-changed", n);
        }
    }
}

/// Create a main window. `rect` restores a saved one; `transfer` hands it items to take in.
pub fn create(app: &AppHandle, label: &str, rect: Option<&WindowRect>, transfer: Option<&str>) -> tauri::Result<()> {
    let url = match transfer {
        Some(t) => format!("index.html?transfer={t}"),
        None => "index.html".into(),
    };
    let w = WebviewWindowBuilder::new(app, label, WebviewUrl::App(url.into()))
        .title("Notepad 2.0")
        .decorations(false)
        .shadow(true)
        .visible(false)
        .disable_drag_drop_handler()
        .min_inner_size(420.0, 260.0)
        .inner_size(1100.0, 720.0)
        .build()?;
    if let Some(r) = rect {
        let _ = w.set_size(PhysicalSize::new(r.width, r.height));
        let _ = w.set_position(PhysicalPosition::new(r.x, r.y));
        if r.maximized {
            let _ = w.maximize();
        }
    }
    Ok(())
}

/// Put every saved window back where it was ("main" comes from the config, the rest are made).
pub fn restore(app: &AppHandle) {
    let saved = ws(app).file.lock().unwrap().clone();
    for r in &saved.windows {
        if r.label == "main" {
            if let Some(w) = app.get_webview_window("main") {
                let _ = w.set_size(PhysicalSize::new(r.width, r.height));
                let _ = w.set_position(PhysicalPosition::new(r.x, r.y));
                if r.maximized {
                    let _ = w.maximize();
                }
            }
        } else if is_main_label(&r.label) && app.get_webview_window(&r.label).is_none() {
            let _ = create(app, &r.label, Some(r), None);
        }
    }
}

// ------------------------------------------------------------------ commands

/// New window at a screen point (the drop point of a dragged item), holding `transfer`.
#[tauri::command]
pub fn open_window(app: AppHandle, window: tauri::WebviewWindow, x: i32, y: i32, transfer: Option<String>) -> Result<String, String> {
    let existing: Vec<String> = app.webview_windows().keys().cloned().collect();
    let label = next_label(&existing);
    let size = window.outer_size().map_err(|e| e.to_string())?;
    let rect = WindowRect {
        label: label.clone(),
        x: x - 120,
        y: y - 20,
        width: (size.width as f64 * 0.8) as u32,
        height: (size.height as f64 * 0.85) as u32,
        maximized: false,
    };
    create(&app, &label, Some(&rect), transfer.as_deref()).map_err(|e| e.to_string())?;
    record_geometry(&app, &label);
    record_focus(&app, &label);
    notify_changed(&app);
    Ok(label)
}

/// Which other Notepad 2.0 window is under a screen point, if any.
#[tauri::command]
pub fn window_at(app: AppHandle, window: tauri::WebviewWindow, x: i32, y: i32) -> Option<String> {
    // Refresh positions of visible windows first (they may have moved without events).
    for label in app.webview_windows().keys().filter(|l| is_main_label(l)).cloned().collect::<Vec<_>>() {
        record_geometry(&app, &label);
    }
    let f = ws(&app).file.lock().unwrap().clone();
    let visible: Vec<String> = app
        .webview_windows()
        .iter()
        .filter(|(l, w)| is_main_label(l) && w.is_visible().unwrap_or(false) && !w.is_minimized().unwrap_or(false))
        .map(|(l, _)| l.clone())
        .collect();
    let file = WindowsFile { windows: f.windows.into_iter().filter(|r| visible.contains(&r.label)).collect(), order: f.order };
    hit_test(&file, x, y, window.label())
}

#[tauri::command]
pub fn last_window(app: AppHandle) -> String {
    ws(&app).last()
}

#[tauri::command]
pub fn window_count(app: AppHandle) -> usize {
    count(&app)
}

#[tauri::command]
pub fn focus_window(app: AppHandle, label: String) {
    if let Some(w) = app.get_webview_window(&label) {
        let _ = w.show();
        let _ = w.unminimize();
        let _ = w.set_focus();
    }
}

/// A window reports the files it has open, so a file is never open in two windows.
#[tauri::command]
pub fn register_open_files(app: AppHandle, window: tauri::WebviewWindow, paths: Vec<String>) {
    ws(&app).open_files.lock().unwrap().insert(window.label().to_string(), paths);
}

#[tauri::command]
pub fn window_with_file(app: AppHandle, window: tauri::WebviewWindow, path: String) -> Option<String> {
    let p = path.to_lowercase();
    let state = ws(&app);
    let map = state.open_files.lock().unwrap();
    map.iter()
        .filter(|(l, _)| l.as_str() != window.label() && app.get_webview_window(l).is_some())
        .find(|(_, paths)| paths.iter().any(|q| q.to_lowercase() == p))
        .map(|(l, _)| l.clone())
}

/// Close a window for good after it handed its items to another window.
#[tauri::command]
pub fn close_window(app: AppHandle, window: tauri::WebviewWindow) {
    let label = window.label().to_string();
    let state = ws(&app);
    {
        let mut f = state.file.lock().unwrap();
        f.windows.retain(|r| r.label != label);
        f.order.retain(|l| l != &label);
    }
    state.open_files.lock().unwrap().remove(&label);
    state.save();
    let _ = window.destroy();
    notify_changed(&app);
}

// ------------------------------------------------------------------ tests

#[cfg(test)]
mod tests {
    use super::*;

    fn rect(label: &str, x: i32, y: i32, w: u32, h: u32) -> WindowRect {
        WindowRect { label: label.into(), x, y, width: w, height: h, maximized: false }
    }

    #[test]
    fn labels_fill_the_first_gap() {
        assert_eq!(next_label(&["main".into()]), "main-2");
        assert_eq!(next_label(&["main".into(), "main-2".into(), "main-4".into()]), "main-3");
    }

    #[test]
    fn touch_moves_to_front() {
        let mut o = vec!["main".to_string(), "main-2".to_string()];
        touch(&mut o, "main-2");
        assert_eq!(o, vec!["main-2", "main"]);
        touch(&mut o, "main-3");
        assert_eq!(o, vec!["main-3", "main-2", "main"]);
    }

    #[test]
    fn hit_test_prefers_the_most_recent_window_and_skips_the_source() {
        let f = WindowsFile {
            windows: vec![rect("main", 0, 0, 800, 600), rect("main-2", 400, 300, 800, 600)],
            order: vec!["main-2".into(), "main".into()],
        };
        assert_eq!(hit_test(&f, 500, 400, "x"), Some("main-2".into())); // overlap: front window wins
        assert_eq!(hit_test(&f, 100, 100, "x"), Some("main".into()));
        assert_eq!(hit_test(&f, 500, 400, "main-2"), Some("main".into()));
        assert_eq!(hit_test(&f, 5000, 5000, "x"), None);
    }

    #[test]
    fn windows_file_round_trips() {
        let d = std::env::temp_dir().join(format!("np2-win-{}", std::process::id()));
        std::fs::create_dir_all(&d).unwrap();
        let p = d.join("windows.json");
        let f = WindowsFile { windows: vec![rect("main", 1, 2, 3, 4)], order: vec!["main".into()] };
        std::fs::write(&p, serde_json::to_string(&f).unwrap()).unwrap();
        assert_eq!(read_file(&p), f);
        assert_eq!(read_file(&d.join("missing.json")), WindowsFile::default());
        std::fs::remove_dir_all(d).unwrap();
    }
}
