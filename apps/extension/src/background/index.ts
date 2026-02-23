/**
 * Background Service Worker
 *
 * Bridges the content script and the Keynest desktop app via:
 *  - Native Messaging: chrome.runtime.connectNative("com.keynest.app")
 *  - Fallback WebSocket: ws://localhost:45678 (for when native messaging isn't available)
 */

import type { VaultItem } from "@keynest/vault";

// ---------------------------------------------------------------------------
// Native messaging connection to desktop app
// ---------------------------------------------------------------------------

let nativePort: chrome.runtime.Port | null = null;

function connectToDesktopApp() {
  try {
    nativePort = chrome.runtime.connectNative("com.keynest.app");

    nativePort.onMessage.addListener((message: unknown) => {
      handleDesktopMessage(message as DesktopMessage);
    });

    nativePort.onDisconnect.addListener(() => {
      nativePort = null;
      // Retry connection after 5 seconds
      setTimeout(connectToDesktopApp, 5000);
    });
  } catch {
    // Desktop app not installed — silently fail, show install prompt in popup
    nativePort = null;
  }
}

connectToDesktopApp();

// ---------------------------------------------------------------------------
// Message types
// ---------------------------------------------------------------------------

interface FieldFocusedPayload {
  x: number;
  y: number;
  width: number;
  height: number;
  hostname: string;
  url: string;
}

interface DesktopMessage {
  type: string;
  payload?: unknown;
}

// ---------------------------------------------------------------------------
// Content script → Background → Desktop app
// ---------------------------------------------------------------------------

chrome.runtime.onMessage.addListener((message, sender) => {
  if (message.type === "KEYNEST_PASSWORD_FIELD_FOCUSED") {
    const payload = message.payload as FieldFocusedPayload;

    // Forward to desktop app via native messaging
    if (nativePort) {
      nativePort.postMessage({
        type: "FIELD_FOCUSED",
        payload,
      });
    }

    // Store the active tab for autofill response
    if (sender.tab?.id) {
      chrome.storage.session.set({ activeTabId: sender.tab.id });
    }
  }
});

// ---------------------------------------------------------------------------
// Desktop app → Background → Content script (autofill response)
// ---------------------------------------------------------------------------

function handleDesktopMessage(message: DesktopMessage) {
  if (message.type === "AUTOFILL") {
    chrome.storage.session.get(["activeTabId"], (result) => {
      const tabId = result["activeTabId"] as number | undefined;
      if (tabId) {
        chrome.tabs.sendMessage(tabId, {
          type: "KEYNEST_AUTOFILL",
          payload: message.payload,
        });
      }
    });
  }
}

// ---------------------------------------------------------------------------
// Popup requests vault items (for popup UI)
// ---------------------------------------------------------------------------

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "KEYNEST_GET_VAULT_ITEMS") {
    chrome.storage.local.get(["encryptedVault"], (result) => {
      sendResponse({ vault: result["encryptedVault"] ?? null });
    });
    return true; // Keep message channel open for async response
  }
});
