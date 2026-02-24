import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { deriveMasterKey, deriveSubkeys, generateSalt, estimateEntropy } from "@keynest/crypto";
import { useKeynestStore } from "../store.ts";
import { saveLocalAccount } from "../lib/local-vault.ts";

type Step = "credentials" | "confirm" | "deriving";

export function RegisterView() {
  const { unlock, setView } = useKeynestStore();
  const [step, setStep] = useState<Step>("credentials");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const confirmRef = useRef<HTMLInputElement>(null);

  const entropy = estimateEntropy(password);
  const strength = entropy < 40 ? "weak" : entropy < 60 ? "fair" : entropy < 80 ? "good" : "strong";
  const strengthColor = { weak: "bg-red-500", fair: "bg-yellow-500", good: "bg-blue-500", strong: "bg-emerald-500" }[strength];
  const strengthWidth = { weak: "25%", fair: "50%", good: "75%", strong: "100%" }[strength];

  function handleCredentials(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!email.includes("@")) {
      setError("Enter a valid email address.");
      return;
    }
    if (password.length < 12) {
      setError("Master password must be at least 12 characters.");
      return;
    }
    if (strength === "weak") {
      setError("Password is too weak — add more variety.");
      return;
    }
    setStep("confirm");
    setTimeout(() => confirmRef.current?.focus(), 50);
  }

  async function handleConfirm(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (confirm !== password) {
      setError("Passwords don't match.");
      setConfirm("");
      confirmRef.current?.focus();
      return;
    }

    setStep("deriving");

    try {
      const salt = generateSalt();
      const { keyMaterial } = await deriveMasterKey(password, salt);
      const { encryptionKey } = await deriveSubkeys(keyMaterial);

      await saveLocalAccount(email, salt, encryptionKey);
      unlock(encryptionKey, []);
      // Fresh account — no items yet
    } catch (err) {
      setError("Something went wrong. Please try again.");
      setStep("confirm");
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96, y: -8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96, y: -8 }}
      transition={{ type: "spring", stiffness: 400, damping: 30 }}
      className="flex flex-col px-6 py-8"
    >
      <div className="w-full bg-white/8 backdrop-blur-2xl rounded-2xl border border-white/12 shadow-2xl p-6">
        {/* Logo + header */}
        <div className="flex items-center gap-2.5 mb-1">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
            </svg>
          </div>
          <span className="text-white font-semibold text-lg tracking-tight">Keynest</span>
        </div>

        <p className="text-white/40 text-xs mb-5">
          {step === "credentials" ? "Create your vault — your master password never leaves this device." : step === "confirm" ? "Confirm your master password." : "Securing your vault…"}
        </p>

        {/* Step: credentials */}
        <AnimatePresence mode="wait">
          {step === "credentials" && (
            <motion.form
              key="credentials"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              onSubmit={handleCredentials}
              className="flex flex-col gap-3"
            >
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email address"
                autoFocus
                className="w-full bg-white/8 border border-white/12 rounded-xl px-4 py-2.5 text-white placeholder-white/25 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
              />

              <div className="flex flex-col gap-1.5">
                <input
                  ref={passwordRef}
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Master password"
                  className="w-full bg-white/8 border border-white/12 rounded-xl px-4 py-2.5 text-white placeholder-white/25 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
                />

                {/* Strength bar */}
                {password.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex items-center gap-2"
                  >
                    <div className="flex-1 h-1 bg-white/10 rounded-full overflow-hidden">
                      <motion.div
                        className={`h-full rounded-full ${strengthColor}`}
                        initial={{ width: 0 }}
                        animate={{ width: strengthWidth }}
                        transition={{ type: "spring", stiffness: 300, damping: 25 }}
                      />
                    </div>
                    <span className={`text-xs capitalize ${
                      strength === "weak" ? "text-red-400" :
                      strength === "fair" ? "text-yellow-400" :
                      strength === "good" ? "text-blue-400" :
                      "text-emerald-400"
                    }`}>
                      {strength}
                    </span>
                  </motion.div>
                )}
              </div>

              {error && (
                <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="text-red-400 text-xs">
                  {error}
                </motion.p>
              )}

              <button
                type="submit"
                disabled={!email || !password}
                className="w-full bg-indigo-500 hover:bg-indigo-400 disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium py-2.5 rounded-xl text-sm transition-all active:scale-[0.98]"
              >
                Continue
              </button>
            </motion.form>
          )}

          {/* Step: confirm password */}
          {step === "confirm" && (
            <motion.form
              key="confirm"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              onSubmit={handleConfirm}
              className="flex flex-col gap-3"
            >
              <div className="flex items-center gap-2 px-3 py-2 bg-white/5 rounded-xl">
                <svg className="w-3.5 h-3.5 text-amber-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <p className="text-white/50 text-xs leading-snug">
                  If you forget your master password, your vault cannot be recovered. Write it down somewhere safe.
                </p>
              </div>

              <input
                ref={confirmRef}
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Confirm master password"
                autoFocus
                className="w-full bg-white/8 border border-white/12 rounded-xl px-4 py-2.5 text-white placeholder-white/25 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
              />

              {error && (
                <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="text-red-400 text-xs">
                  {error}
                </motion.p>
              )}

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => { setStep("credentials"); setError(null); setConfirm(""); }}
                  className="flex-1 bg-white/8 hover:bg-white/12 text-white/60 font-medium py-2.5 rounded-xl text-sm transition-all"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={!confirm}
                  className="flex-1 bg-indigo-500 hover:bg-indigo-400 disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium py-2.5 rounded-xl text-sm transition-all active:scale-[0.98]"
                >
                  Create vault
                </button>
              </div>
            </motion.form>
          )}

          {/* Step: deriving key (Argon2id takes ~500ms) */}
          {step === "deriving" && (
            <motion.div
              key="deriving"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center py-6 gap-3"
            >
              <div className="w-10 h-10 rounded-full border-2 border-indigo-500/30 border-t-indigo-500 animate-spin" />
              <p className="text-white/50 text-sm">Securing your vault…</p>
              <p className="text-white/25 text-xs text-center">
                Running Argon2id key derivation.<br />This takes a moment by design.
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {step === "credentials" && (
          <button
            onClick={() => setView("unlock")}
            className="mt-3 w-full text-white/25 hover:text-white/50 text-xs transition-colors text-center"
          >
            Already have an account? Sign in
          </button>
        )}
      </div>
    </motion.div>
  );
}
