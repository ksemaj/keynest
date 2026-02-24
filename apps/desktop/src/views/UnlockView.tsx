import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { deriveMasterKey, deriveSubkeys } from "@keynest/crypto";
import { useKeynestStore } from "../store.ts";
import { getLocalAccount, verifyLocalPassword, loadStoredItems } from "../lib/local-vault.ts";
import type { VaultItem } from "@keynest/vault";
import { decryptVaultItem } from "@keynest/vault";

export function UnlockView() {
  const { unlock, setView } = useKeynestStore();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const account = getLocalAccount();
    if (!account) {
      setView("register");
      return;
    }
    setEmail(account.email);
    inputRef.current?.focus();
  }, [setView]);

  async function handleUnlock(e: React.FormEvent) {
    e.preventDefault();
    if (!password || loading) return;

    setLoading(true);
    setError(null);

    try {
      const account = getLocalAccount();
      if (!account) { setView("register"); return; }

      const { keyMaterial } = await deriveMasterKey(password, account.kdfSalt);
      const { encryptionKey } = await deriveSubkeys(keyMaterial);

      await verifyLocalPassword(encryptionKey);

      // Load stored items and decrypt them all into memory
      const storedItems = loadStoredItems();
      const rawItems = storedItems.map((s) => ({
        ...s,
        type: s.type as VaultItem["type"],
        tags: [] as string[],
      })) as unknown as VaultItem[];

      const items = await Promise.all(
        rawItems.map((item) => decryptVaultItem(item, encryptionKey)),
      );

      unlock(encryptionKey, items);
    } catch {
      setError("Incorrect master password.");
      setPassword("");
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
      <div className="w-full bg-white/8 backdrop-blur-2xl rounded-2xl border border-white/12 shadow-2xl p-6">
        {/* Logo */}
        <div className="flex items-center gap-2.5 mb-6">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
            </svg>
          </div>
          <span className="text-white font-semibold text-lg tracking-tight">Keynest</span>
        </div>

        {email && (
          <p className="text-white/40 text-xs mb-4 truncate">
            Signed in as <span className="text-white/60">{email}</span>
          </p>
        )}

        <form onSubmit={handleUnlock} className="flex flex-col gap-3">
          <div className="relative">
            <input
              ref={inputRef}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Master password"
              autoFocus
              className="w-full bg-white/8 border border-white/12 rounded-xl px-4 py-3 text-white placeholder-white/25 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-transparent transition-all"
            />
          </div>

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
            className="w-full bg-indigo-500 hover:bg-indigo-400 disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium py-2.5 rounded-xl text-sm transition-all active:scale-[0.98]"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
                Unlocking…
              </span>
            ) : "Unlock vault"}
          </button>
        </form>

        <button
          onClick={() => setView("register")}
          className="mt-3 w-full text-white/25 hover:text-white/50 text-xs transition-colors text-center"
        >
          Use a different account
        </button>
      </div>
    </motion.div>
  );
}
