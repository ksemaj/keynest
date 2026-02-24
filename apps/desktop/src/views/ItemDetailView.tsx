import { useState } from "react";
import { motion } from "framer-motion";
import { useKeynestStore } from "../store.ts";
import { getLoginFields } from "@keynest/vault";
import { FaviconImage } from "../components/FaviconImage.tsx";

export function ItemDetailView() {
  const { items, selectedItemId, setView, setSelectedItem } = useKeynestStore();
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const item = items.find((i) => i.id === selectedItemId);

  if (!item) {
    setView("search");
    return null;
  }

  const fields = getLoginFields(item);
  const hostname = "hostname" in item ? item.hostname : undefined;
  const primaryUri = fields?.uris?.[0]?.uri;

  function copyToClipboard(value: string, fieldKey: string) {
    navigator.clipboard.writeText(value).then(() => {
      setCopiedField(fieldKey);
      setTimeout(() => setCopiedField(null), 2000);
    });
  }

  function handleBack() {
    setSelectedItem(null);
    setView("search");
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
        <button
          onClick={handleBack}
          className="text-white/30 hover:text-white/60 transition-colors shrink-0"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <FaviconImage hostname={hostname} name={item.name} />
        <div className="flex-1 min-w-0">
          <p className="text-white/90 text-sm font-medium truncate">{item.name}</p>
          {hostname && (
            <p className="text-white/35 text-xs truncate">{hostname}</p>
          )}
        </div>
      </div>

      {/* Fields */}
      <div className="flex flex-col gap-2.5 p-4">
        {fields?.username && (
          <CopyField
            label="Username"
            value={fields.username}
            copied={copiedField === "username"}
            onCopy={() => copyToClipboard(fields.username, "username")}
          />
        )}
        {fields?.password && (
          <CopyField
            label="Password"
            value={fields.password}
            secret
            copied={copiedField === "password"}
            onCopy={() => copyToClipboard(fields.password, "password")}
          />
        )}
        {primaryUri && (
          <CopyField
            label="URL"
            value={primaryUri}
            copied={copiedField === "url"}
            onCopy={() => copyToClipboard(primaryUri, "url")}
          />
        )}
        {fields?.notes && (
          <CopyField
            label="Notes"
            value={fields.notes}
            copied={copiedField === "notes"}
            onCopy={() => copyToClipboard(fields.notes!, "notes")}
          />
        )}
        {(!fields || (!fields.username && !fields.password)) && (
          <p className="text-white/30 text-sm text-center py-4">No fields to display.</p>
        )}
      </div>
    </motion.div>
  );
}

function CopyField({
  label,
  value,
  secret = false,
  copied,
  onCopy,
}: {
  label: string;
  value: string;
  secret?: boolean;
  copied: boolean;
  onCopy: () => void;
}) {
  const [revealed, setRevealed] = useState(false);

  return (
    <div className="flex flex-col gap-1">
      <label className="text-white/35 text-xs px-1">{label}</label>
      <div className="flex items-center gap-2 bg-white/6 border border-white/10 rounded-xl px-3 py-2.5">
        <span className={`flex-1 text-white/80 text-sm min-w-0 truncate ${secret ? "font-mono tracking-wider" : ""}`}>
          {secret && !revealed ? "••••••••••••" : value}
        </span>

        {secret && (
          <button
            onClick={() => setRevealed((r) => !r)}
            className="text-white/25 hover:text-white/50 transition-colors shrink-0"
            title={revealed ? "Hide" : "Reveal"}
          >
            {revealed ? (
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
        )}

        <button
          onClick={onCopy}
          className="text-white/25 hover:text-white/50 transition-colors shrink-0"
          title="Copy"
        >
          {copied ? (
            <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          )}
        </button>
      </div>
    </div>
  );
}
