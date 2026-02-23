import { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { AnimatePresence } from "framer-motion";
import { useKeynestStore } from "./store.ts";
import { UnlockView } from "./views/UnlockView.tsx";
import { OverlayView } from "./views/OverlayView.tsx";
import { SearchView } from "./views/SearchView.tsx";

export default function App() {
  const { view, lock, setAutofillContext, setView, isUnlocked } = useKeynestStore();

  useEffect(() => {
    // Listen for vault lock event from tray menu or system
    const unlisten1 = listen("vault:lock", () => lock());

    // Listen for password field focus from Accessibility observer
    const unlisten2 = listen<{ x: number; y: number; width: number; height: number }>(
      "autofill:field-focused",
      (event) => {
        if (!isUnlocked) return;
        const { x, y, height } = event.payload;
        // Position overlay below the field
        setAutofillContext(null, { x, y: y + height + 8 });
        invoke("show_overlay", { x, y: y + height + 8 });
      },
    );

    // Dismiss overlay when clicking outside (blur)
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest("#keynest-overlay")) {
        invoke("hide_overlay");
      }
    };
    document.addEventListener("click", handleClickOutside);

    // Keyboard shortcut: Escape to dismiss
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        invoke("hide_overlay");
      }
    };
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      unlisten1.then((f) => f());
      unlisten2.then((f) => f());
      document.removeEventListener("click", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [lock, setAutofillContext, isUnlocked, setView]);

  return (
    <div id="keynest-overlay" className="w-full h-full">
      <AnimatePresence mode="wait">
        {!isUnlocked && <UnlockView key="unlock" />}
        {isUnlocked && view === "search" && <SearchView key="search" />}
        {isUnlocked && view === "overlay" && <OverlayView key="overlay" />}
      </AnimatePresence>
    </div>
  );
}
