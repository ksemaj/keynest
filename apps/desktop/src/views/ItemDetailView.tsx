import { useState } from "react";
import { motion } from "framer-motion";
import { useKeynestStore } from "../store.ts";
import { getLoginFields } from "@keynest/vault";
import type { VaultItem, LoginFields, CardFields, IdentityFields, SecureNoteFields } from "@keynest/vault";
import { FaviconImage } from "../components/FaviconImage.tsx";
import { updateStoredItem, deleteStoredItem } from "../lib/local-vault.ts";

const TYPE_LABEL: Record<VaultItem["type"], string> = {
  login: "Login",
  "secure-note": "Note",
  card: "Card",
  identity: "Identity",
};

export function ItemDetailView() {
  const { items, selectedItemId, setView, setSelectedItem, setEditingItem, setItems } = useKeynestStore();
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const maybeItem = items.find((i) => i.id === selectedItemId);

  if (!maybeItem) {
    setView("search");
    return null;
  }

  // Reassign with narrowed type so closures see VaultItem (not VaultItem | undefined)
  const item: VaultItem = maybeItem;
  const hostname = "hostname" in item ? (item as { hostname?: string }).hostname : undefined;
  const type = item.type;

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

  function handleEdit() {
    setEditingItem(item.id);
    setView("add-item");
  }

  function handleToggleFavorite() {
    const updated = { ...item, favorite: !item.favorite, updatedAt: new Date().toISOString() };
    // Update in-memory store
    setItems(items.map((i) => (i.id === item.id ? updated as VaultItem : i)));
    // Persist metadata change (encryptedData stays the same)
    updateStoredItem({
      id: item.id,
      type: item.type,
      name: item.name,
      ...(hostname !== undefined ? { hostname } : {}),
      encryptedData: item.encryptedData,
      favorite: !item.favorite,
      tags: (item.tags ?? []).join(","),
      createdAt: item.createdAt,
      updatedAt: updated.updatedAt,
    });
  }

  function handleDelete() {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    deleteStoredItem(item.id);
    setItems(items.filter((i) => i.id !== item.id));
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
      <div className="flex items-center gap-2 px-4 py-3 border-b border-white/8">
        <button onClick={handleBack} className="text-white/30 hover:text-white/60 transition-colors shrink-0">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <FaviconImage hostname={hostname} name={item.name} />

        <div className="flex-1 min-w-0">
          <p className="text-white/90 text-sm font-medium truncate">{item.name}</p>
          <p className="text-white/30 text-xs">{TYPE_LABEL[type]}{hostname ? ` · ${hostname}` : ""}</p>
        </div>

        {/* Favorite */}
        <button
          onClick={handleToggleFavorite}
          className={`shrink-0 transition-colors ${item.favorite ? "text-amber-400" : "text-white/20 hover:text-white/40"}`}
          title={item.favorite ? "Remove from favorites" : "Add to favorites"}
        >
          <svg className="w-4 h-4" fill={item.favorite ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
          </svg>
        </button>

        {/* Edit */}
        <button
          onClick={handleEdit}
          className="shrink-0 text-white/20 hover:text-white/50 transition-colors"
          title="Edit item"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
          </svg>
        </button>
      </div>

      {/* Fields */}
      <div className="flex flex-col gap-2.5 p-4">
        {type === "login" && <LoginFields item={item} copiedField={copiedField} onCopy={copyToClipboard} />}
        {type === "secure-note" && <NoteFields item={item} copiedField={copiedField} onCopy={copyToClipboard} />}
        {type === "card" && <CardFields item={item} copiedField={copiedField} onCopy={copyToClipboard} />}
        {type === "identity" && <IdentityFieldsView item={item} copiedField={copiedField} onCopy={copyToClipboard} />}

        {/* Delete */}
        <button
          onClick={handleDelete}
          className={`mt-1 w-full py-2 rounded-xl text-xs font-medium transition-all ${
            confirmDelete
              ? "bg-red-500/20 text-red-400 border border-red-500/30"
              : "text-white/20 hover:text-red-400 hover:bg-red-500/10"
          }`}
        >
          {confirmDelete ? "Tap again to permanently delete" : "Delete item"}
        </button>
      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Type-specific field renderers
// ---------------------------------------------------------------------------

function LoginFields({ item, copiedField, onCopy }: { item: VaultItem; copiedField: string | null; onCopy: (v: string, k: string) => void }) {
  const fields = getLoginFields(item) as LoginFields | undefined;
  const primaryUri = fields?.uris?.[0]?.uri;

  return (
    <>
      {fields?.username && <CopyField label="Username" value={fields.username} copied={copiedField === "username"} onCopy={() => onCopy(fields.username, "username")} />}
      {fields?.password && <CopyField label="Password" value={fields.password} secret copied={copiedField === "password"} onCopy={() => onCopy(fields.password, "password")} />}
      {primaryUri && <CopyField label="URL" value={primaryUri} copied={copiedField === "url"} onCopy={() => onCopy(primaryUri, "url")} />}
      {fields?.notes && <CopyField label="Notes" value={fields.notes} copied={copiedField === "notes"} onCopy={() => onCopy(fields.notes!, "notes")} />}
      {!fields?.username && !fields?.password && <EmptyFields />}
    </>
  );
}

function NoteFields({ item, copiedField, onCopy }: { item: VaultItem; copiedField: string | null; onCopy: (v: string, k: string) => void }) {
  type NoteWithFields = VaultItem & { _decryptedFields?: SecureNoteFields };
  const fields = (item as NoteWithFields)._decryptedFields;
  return fields?.content
    ? <CopyField label="Content" value={fields.content} secret copied={copiedField === "content"} onCopy={() => onCopy(fields.content, "content")} />
    : <EmptyFields />;
}

function CardFields({ item, copiedField, onCopy }: { item: VaultItem; copiedField: string | null; onCopy: (v: string, k: string) => void }) {
  type CardWithFields = VaultItem & { _decryptedFields?: CardFields };
  const fields = (item as CardWithFields)._decryptedFields;
  if (!fields) return <EmptyFields />;
  const lastFour = fields.number ? `•••• •••• •••• ${fields.number.slice(-4)}` : null;
  return (
    <>
      {fields.cardholderName && <CopyField label="Cardholder" value={fields.cardholderName} copied={copiedField === "holder"} onCopy={() => onCopy(fields.cardholderName, "holder")} />}
      {lastFour && <CopyField label="Card number" value={lastFour} secret fullValue={fields.number} copied={copiedField === "number"} onCopy={() => onCopy(fields.number, "number")} />}
      {(fields.expMonth ?? fields.expYear) && <CopyField label="Expiry" value={`${fields.expMonth ?? ""}/${fields.expYear ?? ""}`} copied={copiedField === "expiry"} onCopy={() => onCopy(`${fields.expMonth ?? ""}/${fields.expYear ?? ""}`, "expiry")} />}
      {fields.cvv && <CopyField label="CVV" value={fields.cvv} secret copied={copiedField === "cvv"} onCopy={() => onCopy(fields.cvv!, "cvv")} />}
      {fields.brand && <CopyField label="Brand" value={fields.brand} copied={copiedField === "brand"} onCopy={() => onCopy(fields.brand!, "brand")} />}
    </>
  );
}

function IdentityFieldsView({ item, copiedField, onCopy }: { item: VaultItem; copiedField: string | null; onCopy: (v: string, k: string) => void }) {
  type IdWithFields = VaultItem & { _decryptedFields?: IdentityFields };
  const fields = (item as IdWithFields)._decryptedFields;
  if (!fields) return <EmptyFields />;
  const fullName = [fields.firstName, fields.lastName].filter(Boolean).join(" ");
  const addressLines = [fields.address1, fields.address2, fields.city && fields.state ? `${fields.city}, ${fields.state}` : (fields.city ?? fields.state), fields.postalCode, fields.country].filter(Boolean).join("\n");
  return (
    <>
      {fullName && <CopyField label="Name" value={fullName} copied={copiedField === "name"} onCopy={() => onCopy(fullName, "name")} />}
      {fields.email && <CopyField label="Email" value={fields.email} copied={copiedField === "email"} onCopy={() => onCopy(fields.email!, "email")} />}
      {fields.phone && <CopyField label="Phone" value={fields.phone} copied={copiedField === "phone"} onCopy={() => onCopy(fields.phone!, "phone")} />}
      {addressLines && <CopyField label="Address" value={addressLines} copied={copiedField === "address"} onCopy={() => onCopy(addressLines, "address")} multiline />}
    </>
  );
}

function EmptyFields() {
  return <p className="text-white/30 text-sm text-center py-4">No fields to display.</p>;
}

// ---------------------------------------------------------------------------
// CopyField
// ---------------------------------------------------------------------------

function CopyField({
  label, value, fullValue, secret = false, copied, onCopy, multiline = false,
}: {
  label: string; value: string; fullValue?: string; secret?: boolean;
  copied: boolean; onCopy: () => void; multiline?: boolean;
}) {
  const [revealed, setRevealed] = useState(false);
  const displayValue = secret && !revealed ? (label === "Card number" ? value : "••••••••••••") : value;

  return (
    <div className="flex flex-col gap-1">
      <label className="text-white/35 text-xs px-1">{label}</label>
      <div className="flex items-start gap-2 bg-white/6 border border-white/10 rounded-xl px-3 py-2.5">
        <span className={`flex-1 text-white/80 text-sm min-w-0 ${secret && !revealed ? "font-mono tracking-wider" : ""} ${multiline ? "whitespace-pre-line" : "truncate"}`}>
          {displayValue}
        </span>

        {secret && (
          <button onClick={() => setRevealed((r) => !r)} className="text-white/25 hover:text-white/50 transition-colors shrink-0 mt-0.5" title={revealed ? "Hide" : "Reveal"}>
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

        <button onClick={onCopy} className="text-white/25 hover:text-white/50 transition-colors shrink-0 mt-0.5" title="Copy">
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
