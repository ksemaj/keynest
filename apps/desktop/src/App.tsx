import { useEffect } from "react";
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

const IDLE_TIMEOUT_MS = 10_000;

export default function App() {
  const { view, lock, setAutofillContext, isUnlocked } = useKeynestStore();

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

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") invoke("hide_overlay");
    };
    document.addEventListener("keydown", handleKeyDown);

    // Auto-dismiss: hide when window loses focus (user switches app)
    const handleBlur = () => invoke("hide_overlay");
    window.addEventListener("blur", handleBlur);

    // Auto-dismiss: hide after IDLE_TIMEOUT_MS of no interaction
    let idleTimer: ReturnType<typeof setTimeout> | null = null;
    const resetIdle = () => {
      if (idleTimer) clearTimeout(idleTimer);
      idleTimer = setTimeout(() => invoke("hide_overlay"), IDLE_TIMEOUT_MS);
    };
    const cancelIdle = () => {
      if (idleTimer) { clearTimeout(idleTimer); idleTimer = null; }
    };
    window.addEventListener("pointermove", resetIdle);
    window.addEventListener("pointerdown", resetIdle);
    window.addEventListener("keydown", resetIdle, true);
    // Start the idle timer immediately once the overlay is shown
    resetIdle();

    return () => {
      unlisten1.then((f) => f());
      unlisten2.then((f) => f());
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("blur", handleBlur);
      window.removeEventListener("pointermove", resetIdle);
      window.removeEventListener("pointerdown", resetIdle);
      window.removeEventListener("keydown", resetIdle, true);
      cancelIdle();
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
