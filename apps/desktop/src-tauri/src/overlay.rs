use tauri::{App, Manager};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutState};

/// Registers the global hotkey Cmd+Shift+K (macOS) / Ctrl+Shift+K (Win/Linux)
/// to toggle the overlay from anywhere on the system.
pub fn register_global_hotkey(app: &mut App) -> Result<(), Box<dyn std::error::Error>> {
    let shortcut: Shortcut = "CmdOrCtrl+Shift+K".parse()?;
    let handle = app.handle().clone();

    app.handle()
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())?;

    handle.global_shortcut().on_shortcut(shortcut, move |app, _shortcut, event| {
        if event.state == ShortcutState::Pressed {
            if let Some(window) = app.get_webview_window("overlay") {
                if window.is_visible().unwrap_or(false) {
                    let _ = window.hide();
                } else {
                    if let Some(monitor) = window.current_monitor().ok().flatten() {
                        let screen_size = monitor.size();
                        let win_size = window.outer_size().unwrap_or(tauri::PhysicalSize::new(420, 480));
                        let x = (screen_size.width as i32 - win_size.width as i32) / 2;
                        let y = screen_size.height as i32 / 4;
                        let _ = window.set_position(tauri::PhysicalPosition::new(x, y));
                    }
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
        }
    })?;

    Ok(())
}
