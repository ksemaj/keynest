import { useState } from "react";
import { motion } from "framer-motion";
import { encryptItem, generatePassword } from "@keynest/crypto";
import { useKeynestStore } from "../store.ts";
import { saveStoredItem } from "../lib/local-vault.ts";
import type { LoginItem } from "@keynest/vault";
import { extractHostname } from "@keynest/vault";

export function AddItemView() {
  const { encryptionKey, setView, setItems, items } = useKeynestStore();
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleGenerate() {
    setPassword(generatePassword({ length: 20, symbols: true }));
    setShowPassword(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!name || !encryptionKey) return;
    setSaving(true);
    setError(null);

    try {
      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      const hostname = url ? extractHostname(url) : undefined;

      // Encrypt the sensitive fields
      const fields = { username, password, uris: url ? [{ uri: url, match: "domain" as const }] : [], notes: "", customFields: [] };
      const blob = await encryptItem(JSON.stringify(fields), encryptionKey);

      const item = Object.assign(
        {
          id,
          type: "login",
          name,
          hostname,
          encryptedData: blob.ciphertext,
          favorite: false,
          tags: [],
          createdAt: now,
          updatedAt: now,
        } as LoginItem,
        { _decryptedFields: fields },
      );

      // Persist to local storage
      saveStoredItem({
        id,
        type: "login",
        name,
        ...(hostname !== undefined ? { hostname } : {}),
        encryptedData: blob.ciphertext,
        favorite: false,
        tags: "",
        createdAt: now,
        updatedAt: now,
      });

      // Update in-memory store
      setItems([...items, item]);
      setView("overlay");
    } catch {
      setError("Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 8, scale: 0.97 }}
      transition={{ type: "spring", stiffness: 500, damping: 35 }}
      className="flex flex-col bg-[#1c1c1e]/95 backdrop-blur-2xl rounded-2xl border border-white/10 shadow-2xl overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-white/8">
        <button
          onClick={() => setView("overlay")}
          className="text-white/30 hover:text-white/60 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <span className="text-white/80 text-sm font-medium">New login</span>
      </div>

      {/* Form */}
      <form onSubmit={handleSave} className="flex flex-col gap-2.5 p-4">
        <Field
          label="Name"
          value={name}
          onChange={setName}
          placeholder="e.g. GitHub"
          autoFocus
        />
        <Field
          label="URL"
          value={url}
          onChange={setUrl}
          placeholder="https://github.com"
          type="url"
        />
        <Field
          label="Username / Email"
          value={username}
          onChange={setUsername}
          placeholder="you@example.com"
        />

        {/* Password field with generate + show/hide */}
        <div className="flex flex-col gap-1">
          <label className="text-white/35 text-xs px-1">Password</label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                className="w-full bg-white/8 border border-white/12 rounded-xl px-3 py-2.5 text-white placeholder-white/20 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 pr-9 font-mono tracking-wider"
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/25 hover:text-white/50 transition-colors"
              >
                {showPassword ? (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                )}
              </button>
            </div>
            <button
              type="button"
              onClick={handleGenerate}
              title="Generate password"
              className="px-3 bg-white/8 hover:bg-white/14 text-white/50 hover:text-white/80 rounded-xl text-xs transition-colors border border-white/12 shrink-0"
            >
              Generate
            </button>
          </div>
        </div>

        {error && (
          <p className="text-red-400 text-xs px-1">{error}</p>
        )}

        <button
          type="submit"
          disabled={!name || saving}
          className="mt-1 w-full bg-indigo-500 hover:bg-indigo-400 disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium py-2.5 rounded-xl text-sm transition-all active:scale-[0.98]"
        >
          {saving ? "Saving…" : "Save login"}
        </button>
      </form>
    </motion.div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  autoFocus,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  autoFocus?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-white/35 text-xs px-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className="w-full bg-white/8 border border-white/12 rounded-xl px-3 py-2.5 text-white placeholder-white/20 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
      />
    </div>
  );
}
