/**
 * SearchView — full vault search, triggered by Cmd+Shift+K or tray icon.
 */

import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { invoke } from "@tauri-apps/api/core";
import { useKeynestStore } from "../store.ts";
import type { SortOrder } from "../store.ts";
import type { VaultItem } from "@keynest/vault";

const TYPE_ICONS: Record<VaultItem["type"], string> = {
  login: "🔑",
  "secure-note": "📝",
  card: "💳",
  identity: "👤",
};

const SORT_OPTIONS: { id: SortOrder; label: string }[] = [
  { id: "az", label: "A–Z" },
  { id: "recent", label: "Recent" },
  { id: "fav", label: "Favorites" },
];

function sortItems(items: VaultItem[], order: SortOrder): VaultItem[] {
  const sorted = [...items];
  if (order === "az") {
    sorted.sort((a, b) => a.name.localeCompare(b.name));
  } else if (order === "recent") {
    sorted.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  } else {
    sorted.sort((a, b) => {
      if (a.favorite && !b.favorite) return -1;
      if (!a.favorite && b.favorite) return 1;
      return a.name.localeCompare(b.name);
    });
  }
  return sorted;
}

export function SearchView() {
  const { items, setView, setSelectedItem, setEditingItem, lock, sortOrder, setSortOrder } = useKeynestStore();
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const sorted = sortItems(items, sortOrder);

  const filtered = query
    ? sorted.filter((item) => item.name.toLowerCase().includes(query.toLowerCase()))
    : sorted.slice(0, 10);

  const favorites = !query && sortOrder !== "fav" ? sorted.filter((i) => i.favorite) : [];
  const showFavSection = favorites.length > 0 && !query;

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  function openItem(item: VaultItem) {
    setSelectedItem(item.id);
    setView("item-detail");
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const item = filtered[selectedIndex];
      if (item) openItem(item);
    }
  }

  function handleLock() {
    lock();
    invoke("hide_overlay");
  }

  function handleNewItem() {
    setEditingItem(null);
    setView("add-item");
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

      {/* Sort bar */}
      {items.length > 0 && (
        <div className="flex gap-1.5 px-4 pb-2.5">
          {SORT_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              onClick={() => setSortOrder(opt.id)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                sortOrder === opt.id
                  ? "bg-indigo-500/25 text-indigo-300 border border-indigo-500/30"
                  : "text-white/30 hover:text-white/50 hover:bg-white/5"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}

      {/* Favorites section (when not searching and not in fav sort) */}
      {showFavSection && (
        <>
          <div className="h-px bg-white/8 mx-4" />
          <div className="pt-1">
            <p className="text-white/20 text-[10px] font-medium uppercase tracking-wider px-4 py-1.5">Favorites</p>
            {favorites.map((item, index) => (
              <ItemRow
                key={item.id}
                item={item}
                isSelected={index === selectedIndex}
                onHover={() => setSelectedIndex(index)}
                onClick={() => openItem(item)}
              />
            ))}
          </div>
        </>
      )}

      {/* Main list */}
      {filtered.length > 0 && (
        <>
          <div className="h-px bg-white/8 mx-4" />
          {showFavSection && (
            <p className="text-white/20 text-[10px] font-medium uppercase tracking-wider px-4 py-1.5">All items</p>
          )}
          <div className="py-1 max-h-72 overflow-y-auto">
            {filtered.map((item, index) => (
              <ItemRow
                key={item.id}
                item={item}
                isSelected={index === selectedIndex}
                onHover={() => setSelectedIndex(index)}
                onClick={() => openItem(item)}
              />
            ))}
          </div>
        </>
      )}

      {/* Footer */}
      <div className="h-px bg-white/8" />
      <div className="flex items-center justify-between px-4 py-2.5">
        <div className="flex gap-2">
          <ActionChip icon="+" label="New item" onClick={handleNewItem} />
          <ActionChip icon="⚙" label="Settings" onClick={() => setView("settings")} />
        </div>
        <button
          onClick={handleLock}
          className="flex items-center gap-1.5 text-white/25 hover:text-white/50 text-xs transition-colors"
          title="Lock vault"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          <span>{items.length} items</span>
        </button>
      </div>
    </motion.div>
  );
}

function ItemRow({ item, isSelected, onHover, onClick }: {
  item: VaultItem; isSelected: boolean; onHover: () => void; onClick: () => void;
}) {
  const hostname = "hostname" in item ? (item as { hostname?: string }).hostname : undefined;
  return (
    <button
      onClick={onClick}
      onMouseEnter={onHover}
      className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
        isSelected ? "bg-indigo-500/20" : "hover:bg-white/5"
      }`}
    >
      <span className="text-base shrink-0">{TYPE_ICONS[item.type]}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="text-white/90 text-sm font-medium truncate">{item.name}</p>
          {item.favorite && <span className="text-amber-400 text-xs shrink-0">★</span>}
        </div>
        {hostname && <p className="text-white/30 text-xs truncate">{hostname}</p>}
      </div>
      <span className="text-white/15 text-xs shrink-0 capitalize">{item.type.replace("-", " ")}</span>
    </button>
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
