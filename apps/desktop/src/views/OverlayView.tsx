/**
 * OverlayView — the main autofill overlay.
 *
 * Shown when a password field is detected. Displays matching credentials
 * for the current hostname. The user can select one with keyboard or mouse
 * to autofill the field.
 */

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { invoke } from "@tauri-apps/api/core";
import { useKeynestStore } from "../store.ts";
import { findMatchingLogins, getLoginFields } from "@keynest/vault";
import type { LoginItem } from "@keynest/vault";

export function OverlayView() {
  const { items, autofillHostname, encryptionKey, setView } = useKeynestStore();
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Find matching logins for the current hostname
  const hostname = autofillHostname ?? "";
  const matchingLogins = hostname
    ? findMatchingLogins(items, hostname)
    : (items.filter((i) => i.type === "login") as LoginItem[]);

  const filtered = query
    ? matchingLogins.filter((item) =>
        item.name.toLowerCase().includes(query.toLowerCase()),
      )
    : matchingLogins;

  useEffect(() => {
    setSelectedIndex(0);
    inputRef.current?.focus();
  }, [hostname]);

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
      if (item) handleSelect(item);
    }
  }

  function handleSelect(item: LoginItem) {
    const fields = getLoginFields(item);
    if (!fields) return;

    // Emit autofill event — extension content script listens for this
    // and fills the focused field
    invoke("hide_overlay");
    window.dispatchEvent(
      new CustomEvent("keynest:autofill", {
        detail: { username: fields.username, password: fields.password },
      }),
    );
  }

  if (filtered.length === 0 && !query) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 8 }}
        className="p-4"
      >
        <EmptyState hostname={hostname} onAddNew={() => setView("add-item")} />
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 8, scale: 0.97 }}
      transition={{ type: "spring", stiffness: 500, damping: 35 }}
      className="flex flex-col bg-[#1c1c1e]/95 backdrop-blur-2xl rounded-2xl border border-white/10 shadow-2xl overflow-hidden"
      onKeyDown={handleKeyDown}
    >
      {/* Search bar */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-white/8">
        <svg className="w-4 h-4 text-white/30 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setSelectedIndex(0); }}
          placeholder={hostname ? `Logins for ${hostname}` : "Search vault…"}
          className="flex-1 bg-transparent text-white/90 placeholder-white/25 text-sm focus:outline-none"
        />
        {hostname && (
          <span className="text-white/20 text-xs font-mono shrink-0">{filtered.length}</span>
        )}
      </div>

      {/* Credential list */}
      <div className="max-h-72 overflow-y-auto py-1.5">
        <AnimatePresence>
          {filtered.map((item, index) => (
            <CredentialRow
              key={item.id}
              item={item}
              isSelected={index === selectedIndex}
              onHover={() => setSelectedIndex(index)}
              onSelect={() => handleSelect(item)}
            />
          ))}
        </AnimatePresence>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-4 py-2.5 border-t border-white/8">
        <div className="flex items-center gap-3 text-white/20 text-xs">
          <span>↑↓ navigate</span>
          <span>↵ autofill</span>
          <span>esc dismiss</span>
        </div>
        <button
          onClick={() => setView("add-item")}
          className="text-indigo-400 text-xs hover:text-indigo-300 transition-colors"
        >
          + Add new
        </button>
      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function CredentialRow({
  item,
  isSelected,
  onHover,
  onSelect,
}: {
  item: LoginItem;
  isSelected: boolean;
  onHover: () => void;
  onSelect: () => void;
}) {
  const fields = getLoginFields(item);
  const initial = item.name.charAt(0).toUpperCase();

  return (
    <motion.button
      layout
      onClick={onSelect}
      onMouseEnter={onHover}
      className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
        isSelected ? "bg-indigo-500/20" : "hover:bg-white/5"
      }`}
    >
      {/* Avatar */}
      <div
        className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${
          isSelected
            ? "bg-indigo-500 text-white"
            : "bg-white/10 text-white/60"
        }`}
      >
        {initial}
      </div>

      {/* Name + username */}
      <div className="flex-1 min-w-0">
        <p className="text-white/90 text-sm font-medium truncate leading-tight">
          {item.name}
        </p>
        {fields?.username && (
          <p className="text-white/35 text-xs truncate leading-tight">
            {fields.username}
          </p>
        )}
      </div>

      {/* Fill indicator */}
      {isSelected && (
        <motion.div
          initial={{ opacity: 0, x: 4 }}
          animate={{ opacity: 1, x: 0 }}
          className="shrink-0"
        >
          <svg className="w-4 h-4 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 9l3 3m0 0l-3 3m3-3H8m13 0a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </motion.div>
      )}
    </motion.button>
  );
}

function EmptyState({
  hostname,
  onAddNew,
}: {
  hostname: string;
  onAddNew: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-8 px-4 bg-[#1c1c1e]/95 backdrop-blur-2xl rounded-2xl border border-white/10 shadow-2xl">
      <div className="w-10 h-10 rounded-xl bg-white/8 flex items-center justify-center mb-3">
        <svg className="w-5 h-5 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
        </svg>
      </div>
      <p className="text-white/50 text-sm text-center">
        No saved logins{hostname ? ` for ${hostname}` : ""}
      </p>
      <button
        onClick={onAddNew}
        className="mt-3 text-indigo-400 text-sm hover:text-indigo-300 transition-colors"
      >
        Save a new login
      </button>
    </div>
  );
}
