/**
 * Global app state — Zustand store.
 *
 * The vault is decrypted in memory after unlock and cleared on lock.
 * Nothing sensitive persists in this store between locks.
 */

import { create } from "zustand";
import type { VaultItem } from "@keynest/vault";
export type AppView =
  | "locked"
  | "unlock"
  | "register"
  | "overlay"
  | "search"
  | "item-detail"
  | "add-item"
  | "settings";

interface KeynestState {
  view: AppView;
  isUnlocked: boolean;

  // Vault state (only populated when unlocked)
  encryptionKey: CryptoKey | null;
  items: VaultItem[];
  searchQuery: string;

  // Autofill context (set by accessibility/extension events)
  autofillHostname: string | null;
  autofillFieldPosition: { x: number; y: number } | null;

  // Actions
  setView: (view: AppView) => void;
  unlock: (key: CryptoKey, items: VaultItem[]) => void;
  lock: () => void;
  setItems: (items: VaultItem[]) => void;
  setSearchQuery: (query: string) => void;
  setAutofillContext: (hostname: string | null, position: { x: number; y: number } | null) => void;
}

export const useKeynestStore = create<KeynestState>((set) => ({
  view: "locked",
  isUnlocked: false,
  encryptionKey: null,
  items: [],
  searchQuery: "",
  autofillHostname: null,
  autofillFieldPosition: null,

  setView: (view) => set({ view }),

  unlock: (encryptionKey: CryptoKey, items) =>
    set({ isUnlocked: true, encryptionKey, items, view: "overlay" }),

  lock: () =>
    set({
      isUnlocked: false,
      encryptionKey: null,
      items: [],
      view: "locked",
      searchQuery: "",
      autofillHostname: null,
    }),

  setItems: (items) => set({ items }),

  setSearchQuery: (searchQuery) => set({ searchQuery }),

  setAutofillContext: (autofillHostname, autofillFieldPosition) =>
    set({ autofillHostname, autofillFieldPosition }),
}));
