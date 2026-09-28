// No console window in release builds.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    // The "Replace Notepad" toggle relaunches this exe elevated with a helper flag.
    // Handle it before any window or single-instance logic runs, then exit.
    if let Some(code) = notepad2_lib::integration::run_elevated_helper(std::env::args().collect()) {
        std::process::exit(code);
    }
    notepad2_lib::run();
}
