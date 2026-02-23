/**
 * Content Script — runs on every page.
 *
 * Responsibilities:
 *  1. Detect password fields and their screen positions
 *  2. Notify the background service worker (which relays to the desktop app)
 *  3. Listen for autofill commands and fill the active field
 */

let activePasswordField: HTMLInputElement | null = null;
let lastReportedField: HTMLInputElement | null = null;

// ---------------------------------------------------------------------------
// Observe password field focus
// ---------------------------------------------------------------------------

function onFocus(e: FocusEvent) {
  const el = e.target as HTMLElement;
  if (el.tagName !== "INPUT") return;

  const input = el as HTMLInputElement;
  if (input.type !== "password") return;

  activePasswordField = input;

  if (input === lastReportedField) return;
  lastReportedField = input;

  const rect = input.getBoundingClientRect();
  const scrollX = window.scrollX;
  const scrollY = window.scrollY;

  chrome.runtime.sendMessage({
    type: "KEYNEST_PASSWORD_FIELD_FOCUSED",
    payload: {
      x: rect.left + scrollX,
      y: rect.top + scrollY,
      width: rect.width,
      height: rect.height,
      hostname: window.location.hostname,
      url: window.location.href,
    },
  });
}

function onBlur(e: FocusEvent) {
  const el = e.target as HTMLElement;
  if (el === activePasswordField) {
    activePasswordField = null;
    lastReportedField = null;
  }
}

document.addEventListener("focusin", onFocus, true);
document.addEventListener("focusout", onBlur, true);

// ---------------------------------------------------------------------------
// Listen for autofill commands
// ---------------------------------------------------------------------------

chrome.runtime.onMessage.addListener((message) => {
  if (message.type !== "KEYNEST_AUTOFILL") return;

  const { username, password } = message.payload as {
    username: string;
    password: string;
  };

  // Find username field (sibling or nearby input)
  if (activePasswordField) {
    fillField(activePasswordField, password);

    // Try to find and fill the username field
    const form = activePasswordField.closest("form");
    if (form) {
      const usernameInput = form.querySelector<HTMLInputElement>(
        'input[type="email"], input[type="text"], input[autocomplete="username"]',
      );
      if (usernameInput) {
        fillField(usernameInput, username);
      }
    }
  }
});

/**
 * Fills a field using native input value setter to trigger React/Vue/etc.
 * event listeners correctly.
 */
function fillField(input: HTMLInputElement, value: string) {
  const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    "value",
  )?.set;

  if (nativeInputValueSetter) {
    nativeInputValueSetter.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  } else {
    input.value = value;
  }
}
