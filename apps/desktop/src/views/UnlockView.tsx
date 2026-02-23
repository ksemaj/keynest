import { useState, useRef } from "react";
import { motion } from "framer-motion";
import { deriveMasterKey, deriveSubkeys } from "@keynest/crypto";
import { useKeynestStore } from "../store.ts";

export function UnlockView() {
  const { unlock, setView } = useKeynestStore();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleUnlock(e: React.FormEvent) {
    e.preventDefault();
    if (!password || loading) return;

    setLoading(true);
    setError(null);

    try {
      // In real flow: fetch kdfSalt from local store or server
      // For now, derive from a stored salt (TODO: fetch from account data)
      const storedSalt = localStorage.getItem("keynest:kdf-salt");
      if (!storedSalt) {
        setView("register");
        return;
      }

      const salt = Uint8Array.from(atob(storedSalt), (c) => c.charCodeAt(0));
      const { keyMaterial } = await deriveMasterKey(password, salt);
      const { encryptionKey } = await deriveSubkeys(keyMaterial);

      // TODO: fetch and decrypt vault items from server/local cache
      unlock(encryptionKey, []);
    } catch {
      setError("Incorrect master password.");
      inputRef.current?.focus();
    } finally {
      setLoading(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96, y: -8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96, y: -8 }}
      transition={{ type: "spring", stiffness: 400, damping: 30 }}
      className="flex flex-col items-center justify-center h-full px-6 py-8"
    >
      {/* Frosted glass card */}
      <div className="w-full max-w-sm bg-white/10 backdrop-blur-2xl rounded-2xl border border-white/20 shadow-2xl p-6">
        {/* Logo */}
        <div className="flex items-center gap-2 mb-6">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
            </svg>
          </div>
          <span className="text-white font-semibold text-lg tracking-tight">Keynest</span>
        </div>

        <p className="text-white/60 text-sm mb-4">Enter your master password to unlock</p>

        <form onSubmit={handleUnlock} className="flex flex-col gap-3">
          <input
            ref={inputRef}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Master password"
            autoFocus
            className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-white/30 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-transparent transition-all"
          />

          {error && (
            <motion.p
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-red-400 text-xs"
            >
              {error}
            </motion.p>
          )}

          <button
            type="submit"
            disabled={!password || loading}
            className="w-full bg-indigo-500 hover:bg-indigo-400 disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium py-3 rounded-xl text-sm transition-all active:scale-[0.98]"
          >
            {loading ? "Unlocking…" : "Unlock"}
          </button>
        </form>
      </div>
    </motion.div>
  );
}
