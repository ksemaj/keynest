/**
 * SearchView — full vault search, triggered by Cmd+Shift+K or tray icon.
 * Same floating overlay, but shows all vault items with richer controls.
 */

import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { useKeynestStore } from "../store.ts";
import type { VaultItem } from "@keynest/vault";

const TYPE_ICONS: Record<VaultItem["type"], string> = {
  login: "🔑",
  "secure-note": "📝",
  card: "💳",
  identity: "👤",
};

export function SearchView() {
  const { items, setView } = useKeynestStore();
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = query
    ? items.filter((item) =>
        item.name.toLowerCase().includes(query.toLowerCase()),
      )
    : items.slice(0, 8); // Show recent 8 by default

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -12, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -12, scale: 0.97 }}
      transition={{ type: "spring", stiffness: 500, damping: 35 }}
      className="flex flex-col bg-[#1c1c1e]/95 backdrop-blur-2xl rounded-2xl border border-white/10 shadow-2xl overflow-hidden"
      onKeyDown={handleKeyDown}
    >
      {/* Search input */}
      <div className="flex items-center gap-3 px-4 py-3.5">
        <svg className="w-4 h-4 text-white/30 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setSelectedIndex(0); }}
          placeholder="Search vault…"
          className="flex-1 bg-transparent text-white placeholder-white/25 text-[15px] focus:outline-none"
        />
      </div>

      {filtered.length > 0 && (
        <>
          <div className="h-px bg-white/8 mx-4" />
          <div className="py-1.5 max-h-80 overflow-y-auto">
            {filtered.map((item, index) => (
              <button
                key={item.id}
                onMouseEnter={() => setSelectedIndex(index)}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                  index === selectedIndex ? "bg-indigo-500/20" : "hover:bg-white/5"
                }`}
              >
                <span className="text-base shrink-0">{TYPE_ICONS[item.type]}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-white/90 text-sm font-medium truncate">{item.name}</p>
                  {item.hostname && (
                    <p className="text-white/30 text-xs truncate">{item.hostname}</p>
                  )}
                </div>
                <span className="text-white/15 text-xs shrink-0 capitalize">
                  {item.type.replace("-", " ")}
                </span>
              </button>
            ))}
          </div>
        </>
      )}

      {/* Footer actions */}
      <div className="h-px bg-white/8" />
      <div className="flex items-center justify-between px-4 py-2.5">
        <div className="flex gap-2">
          <ActionChip icon="+" label="New item" onClick={() => setView("add-item")} />
          <ActionChip icon="⚙" label="Settings" onClick={() => setView("settings")} />
        </div>
        <span className="text-white/20 text-xs">{items.length} items</span>
      </div>
    </motion.div>
  );
}

function ActionChip({ icon, label, onClick }: { icon: string; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 bg-white/8 hover:bg-white/12 text-white/50 hover:text-white/70 text-xs px-3 py-1.5 rounded-lg transition-colors"
    >
      <span>{icon}</span>
      <span>{label}</span>
    </button>
  );
}
