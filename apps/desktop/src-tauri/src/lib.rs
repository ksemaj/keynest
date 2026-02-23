mod overlay;
mod tray;

#[cfg(target_os = "macos")]
mod accessibility;

use tauri::{AppHandle, Manager};

#[tauri::command]
fn show_overlay(app: AppHandle, x: f64, y: f64) {
    if let Some(window) = app.get_webview_window("overlay") {
        let _ = window.set_position(tauri::PhysicalPosition::new(x as i32, y as i32));
        let _ = window.show();
        let _ = window.set_focus();
    }
}

#[tauri::command]
fn hide_overlay(app: AppHandle) {
    if let Some(window) = app.get_webview_window("overlay") {
        let _ = window.hide();
    }
}

#[tauri::command]
fn toggle_overlay(app: AppHandle) {
    if let Some(window) = app.get_webview_window("overlay") {
        if window.is_visible().unwrap_or(false) {
            let _ = window.hide();
        } else {
            // Center on screen when triggered via hotkey/tray
            if let Some(monitor) = window.current_monitor().ok().flatten() {
                let screen_size = monitor.size();
                let win_size = window.outer_size().unwrap_or(tauri::PhysicalSize::new(420, 480));
                let x = (screen_size.width as i32 - win_size.width as i32) / 2;
                let y = (screen_size.height as i32) / 4;
                let _ = window.set_position(tauri::PhysicalPosition::new(x, y));
            }
            let _ = window.show();
            let _ = window.set_focus();
        }
    }
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            // Set up system tray
            tray::setup_tray(app)?;

            // Register global hotkey: Cmd+Shift+K
            overlay::register_global_hotkey(app)?;

            // Start accessibility observer for native app autofill
            #[cfg(target_os = "macos")]
            accessibility::start_ax_observer(app.handle().clone());

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            show_overlay,
            hide_overlay,
            toggle_overlay,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Keynest");
}
