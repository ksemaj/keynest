/// macOS Accessibility API observer.
///
/// Watches for AXSecureTextField focus events across all apps and emits
/// the field's screen coordinates so the overlay can appear nearby.
///
/// TODO: Implement real AXObserver using the accessibility-sys crate.
///       For now this is a stub — autofill in native apps is triggered
///       by the browser extension instead.
use tauri::AppHandle;

pub fn start_ax_observer(_app: AppHandle) {
    // Real implementation will use AXObserverCreate + AXObserverAddNotification
    // to watch for kAXFocusedUIElementChangedNotification system-wide and check
    // if the newly focused element has role AXSecureTextField.
}
