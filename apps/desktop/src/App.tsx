import { useEffect, useRef } from "react";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { AnimatePresence } from "framer-motion";
import { useKeynestStore } from "./store.ts";
import { RegisterView } from "./views/RegisterView.tsx";
import { UnlockView } from "./views/UnlockView.tsx";
import { OverlayView } from "./views/OverlayView.tsx";
import { SearchView } from "./views/SearchView.tsx";
import { AddItemView } from "./views/AddItemView.tsx";
import { ItemDetailView } from "./views/ItemDetailView.tsx";
import { SettingsView } from "./views/SettingsView.tsx";

/** Hides the overlay after this many ms of no interaction (not the same as auto-lock). */
const IDLE_DISMISS_MS = 8_000;

export default function App() {
  const { view, lock, setAutofillContext, isUnlocked, settings } = useKeynestStore();

  // Auto-lock timer ref — reset on any user activity
  const autoLockTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Idle dismiss timer ref — hides overlay after brief inactivity
  const idleDismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // -------------------------------------------------------------------------
  // Auto-lock (configurable, locks the vault on expiry)
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!isUnlocked || settings.autoLockMinutes === null) {
      if (autoLockTimer.current) clearTimeout(autoLockTimer.current);
      return;
    }

    function resetAutoLock() {
      if (autoLockTimer.current) clearTimeout(autoLockTimer.current);
      autoLockTimer.current = setTimeout(() => {
        lock();
        invoke("hide_overlay");
      }, settings.autoLockMinutes! * 60 * 1000);
    }

    resetAutoLock();
    document.addEventListener("pointermove", resetAutoLock, true);
    document.addEventListener("pointerdown", resetAutoLock, true);
    document.addEventListener("keydown", resetAutoLock, true);

    return () => {
      if (autoLockTimer.current) clearTimeout(autoLockTimer.current);
      document.removeEventListener("pointermove", resetAutoLock, true);
      document.removeEventListener("pointerdown", resetAutoLock, true);
      document.removeEventListener("keydown", resetAutoLock, true);
    };
  }, [isUnlocked, settings.autoLockMinutes, lock]);

  // -------------------------------------------------------------------------
  // Tauri events + overlay dismiss logic
  // -------------------------------------------------------------------------
  useEffect(() => {
    const unlisten1 = listen("vault:lock", () => lock());

    const unlisten2 = listen<{ x: number; y: number; width: number; height: number }>(
      "autofill:field-focused",
      (event) => {
        if (!isUnlocked) return;
        const { x, y, height } = event.payload;
        setAutofillContext(null, { x, y: y + height + 8 });
        invoke("show_overlay", { x, y: y + height + 8 });
      },
    );

    // Escape to dismiss
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") invoke("hide_overlay");
    };
    document.addEventListener("keydown", handleKeyDown);

    // Blur to dismiss
    const handleBlur = () => invoke("hide_overlay");
    window.addEventListener("blur", handleBlur);

    // Idle dismiss (hides overlay, does NOT lock)
    function resetIdleDismiss() {
      if (idleDismissTimer.current) clearTimeout(idleDismissTimer.current);
      idleDismissTimer.current = setTimeout(() => invoke("hide_overlay"), IDLE_DISMISS_MS);
    }
    window.addEventListener("pointermove", resetIdleDismiss);
    window.addEventListener("pointerdown", resetIdleDismiss);
    window.addEventListener("keydown", resetIdleDismiss, true);
    resetIdleDismiss();

    return () => {
      unlisten1.then((f) => f());
      unlisten2.then((f) => f());
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("blur", handleBlur);
      window.removeEventListener("pointermove", resetIdleDismiss);
      window.removeEventListener("pointerdown", resetIdleDismiss);
      window.removeEventListener("keydown", resetIdleDismiss, true);
      if (idleDismissTimer.current) clearTimeout(idleDismissTimer.current);
    };
  }, [lock, setAutofillContext, isUnlocked]);

  return (
    <div id="keynest-overlay" className="w-full min-h-screen">
      <AnimatePresence mode="wait">
        {!isUnlocked && view === "register" && <RegisterView key="register" />}
        {!isUnlocked && view !== "register" && <UnlockView key="unlock" />}
        {isUnlocked && view === "overlay" && <OverlayView key="overlay" />}
        {isUnlocked && view === "search" && <SearchView key="search" />}
        {isUnlocked && view === "add-item" && <AddItemView key="add-item" />}
        {isUnlocked && view === "item-detail" && <ItemDetailView key="item-detail" />}
        {isUnlocked && view === "settings" && <SettingsView key="settings" />}
      </AnimatePresence>
    </div>
  );
}
