use tauri::{App, Manager};

/// Registers the global hotkey Cmd+Shift+K (macOS) / Ctrl+Shift+K (Win/Linux)
/// to toggle the overlay from anywhere on the system.
pub fn register_global_hotkey(app: &mut App) -> Result<(), Box<dyn std::error::Error>> {
    let handle = app.handle().clone();

    // Tauri 2.x global shortcut plugin would go here.
    // For now we use a platform-specific approach via the tray click.
    // TODO: integrate tauri-plugin-global-shortcut when stabilized.
    let _ = handle;

    Ok(())
}
