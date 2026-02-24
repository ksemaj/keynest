import { useState } from "react";
import { motion } from "framer-motion";
import { invoke } from "@tauri-apps/api/core";
import { useKeynestStore } from "../store.ts";
import { clearLocalAccount, loadStoredItems, saveSettings } from "../lib/local-vault.ts";

const AUTO_LOCK_OPTIONS: { label: string; value: number | null }[] = [
  { label: "1 min", value: 1 },
  { label: "5 min", value: 5 },
  { label: "15 min", value: 15 },
  { label: "30 min", value: 30 },
  { label: "Never", value: null },
];

export function SettingsView() {
  const { setView, lock, settings, saveSettings: saveStoreSettings } = useKeynestStore();
  const [confirmClear, setConfirmClear] = useState(false);

  function handleLock() {
    lock();
    invoke("hide_overlay");
  }

  function handleAutoLockChange(value: number | null) {
    const updated = { ...settings, autoLockMinutes: value };
    saveStoreSettings(updated);
    saveSettings(updated);
  }

  function handleExport() {
    const items = loadStoredItems();
    const blob = new Blob(
      [JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), items }, null, 2)],
      { type: "application/json" },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `keynest-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleClearData() {
    if (!confirmClear) {
      setConfirmClear(true);
      return;
    }
    clearLocalAccount();
    lock();
    invoke("hide_overlay");
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: 16, scale: 0.97 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 16, scale: 0.97 }}
      transition={{ type: "spring", stiffness: 500, damping: 35 }}
      className="flex flex-col bg-[#1c1c1e]/95 backdrop-blur-2xl rounded-2xl border border-white/10 shadow-2xl overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-white/8">
        <button onClick={() => setView("search")} className="text-white/30 hover:text-white/60 transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <span className="text-white/80 text-sm font-medium">Settings</span>
      </div>

      <div className="p-4 flex flex-col gap-4">
        {/* Auto-lock */}
        <div>
          <p className="text-white/50 text-xs font-medium mb-2">Auto-lock after inactivity</p>
          <div className="flex gap-1.5 flex-wrap">
            {AUTO_LOCK_OPTIONS.map((opt) => (
              <button
                key={String(opt.value)}
                onClick={() => handleAutoLockChange(opt.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  settings.autoLockMinutes === opt.value
                    ? "bg-indigo-500 text-white"
                    : "bg-white/8 text-white/40 hover:text-white/60 hover:bg-white/12"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Divider */}
        <div className="h-px bg-white/8" />

        {/* Actions */}
        <div className="flex flex-col gap-1.5">
          <SettingsRow
            label="Lock vault"
            description="Require master password to unlock"
            icon={
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            }
            onClick={handleLock}
          />
          <SettingsRow
            label="Export encrypted backup"
            description="Download vault as encrypted JSON"
            icon={
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
            }
            onClick={handleExport}
          />
          <SettingsRow
            label={confirmClear ? "Tap again to confirm" : "Clear local data"}
            description="Remove all vault data from this device"
            icon={
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            }
            onClick={handleClearData}
            destructive
          />
        </div>
      </div>

      {/* Footer */}
      <div className="px-4 pb-4 pt-1">
        <p className="text-white/12 text-xs text-center">Keynest v0.1.0 — open source password manager</p>
      </div>
    </motion.div>
  );
}

function SettingsRow({
  label, description, icon, onClick, destructive = false,
}: {
  label: string; description: string; icon: React.ReactNode; onClick: () => void; destructive?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors text-left w-full ${
        destructive ? "hover:bg-red-500/10 text-red-400" : "hover:bg-white/8 text-white/70"
      }`}
    >
      <span className={`shrink-0 ${destructive ? "text-red-400/70" : "text-white/30"}`}>{icon}</span>
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className={`text-xs ${destructive ? "text-red-400/50" : "text-white/30"}`}>{description}</p>
      </div>
    </button>
  );
}
