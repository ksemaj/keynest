import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { encryptItem, generatePassword, checkPasswordBreach } from "@keynest/crypto";
import { useKeynestStore } from "../store.ts";
import { saveStoredItem, updateStoredItem } from "../lib/local-vault.ts";
import { extractHostname, getLoginFields, decryptVaultItem } from "@keynest/vault";
import type { LoginItem, SecureNoteItem, CardItem, IdentityItem, ItemType } from "@keynest/vault";

type Tab = ItemType;
const TABS: { id: Tab; label: string }[] = [
  { id: "login", label: "Login" },
  { id: "secure-note", label: "Note" },
  { id: "card", label: "Card" },
  { id: "identity", label: "Identity" },
];

export function AddItemView() {
  const { encryptionKey, setView, setItems, items, editingItemId, setEditingItem } = useKeynestStore();
  const isEditing = editingItemId !== null;
  const editingItem = isEditing ? items.find((i) => i.id === editingItemId) : undefined;

  const [tab, setTab] = useState<Tab>(editingItem?.type ?? "login");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Login fields
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loginNotes, setLoginNotes] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [breachWarning, setBreachWarning] = useState<string | null>(null);
  const [checkingBreach, setCheckingBreach] = useState(false);
  const breachTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Secure Note fields
  const [noteTitle, setNoteTitle] = useState("");
  const [noteContent, setNoteContent] = useState("");

  // Card fields
  const [cardName, setCardName] = useState("");
  const [cardHolder, setCardHolder] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [cardExpMonth, setCardExpMonth] = useState("");
  const [cardExpYear, setCardExpYear] = useState("");
  const [cardCvv, setCardCvv] = useState("");
  const [cardBrand, setCardBrand] = useState("");

  // Identity fields
  const [idName, setIdName] = useState("");
  const [idFirst, setIdFirst] = useState("");
  const [idLast, setIdLast] = useState("");
  const [idEmail, setIdEmail] = useState("");
  const [idPhone, setIdPhone] = useState("");
  const [idAddress1, setIdAddress1] = useState("");
  const [idAddress2, setIdAddress2] = useState("");
  const [idCity, setIdCity] = useState("");
  const [idState, setIdState] = useState("");
  const [idPostal, setIdPostal] = useState("");
  const [idCountry, setIdCountry] = useState("");

  // Pre-fill form fields when editing
  useEffect(() => {
    if (!editingItem || !encryptionKey) return;

    if (editingItem.type === "login") {
      const fields = getLoginFields(editingItem);
      setName(editingItem.name);
      setUrl(fields?.uris?.[0]?.uri ?? "");
      setUsername(fields?.username ?? "");
      setPassword(fields?.password ?? "");
      setLoginNotes(fields?.notes ?? "");
    } else if (editingItem.type === "secure-note") {
      setNoteTitle(editingItem.name);
      // Decrypt note content
      decryptVaultItem(editingItem, encryptionKey).then((decrypted) => {
        const f = (decrypted as SecureNoteItem & { _decryptedFields?: { content: string } })._decryptedFields;
        setNoteContent(f?.content ?? "");
      });
    } else if (editingItem.type === "card") {
      setCardName(editingItem.name);
      decryptVaultItem(editingItem, encryptionKey).then((decrypted) => {
        type CardF = { cardholderName: string; brand?: string; number: string; expMonth?: string; expYear?: string; cvv?: string };
        const f = (decrypted as CardItem & { _decryptedFields?: CardF })._decryptedFields;
        setCardHolder(f?.cardholderName ?? "");
        setCardNumber(f?.number ?? "");
        setCardExpMonth(f?.expMonth ?? "");
        setCardExpYear(f?.expYear ?? "");
        setCardCvv(f?.cvv ?? "");
        setCardBrand(f?.brand ?? "");
      });
    } else if (editingItem.type === "identity") {
      setIdName(editingItem.name);
      decryptVaultItem(editingItem, encryptionKey).then((decrypted) => {
        type IdF = { firstName?: string; lastName?: string; email?: string; phone?: string; address1?: string; address2?: string; city?: string; state?: string; postalCode?: string; country?: string };
        const f = (decrypted as IdentityItem & { _decryptedFields?: IdF })._decryptedFields;
        setIdFirst(f?.firstName ?? "");
        setIdLast(f?.lastName ?? "");
        setIdEmail(f?.email ?? "");
        setIdPhone(f?.phone ?? "");
        setIdAddress1(f?.address1 ?? "");
        setIdAddress2(f?.address2 ?? "");
        setIdCity(f?.city ?? "");
        setIdState(f?.state ?? "");
        setIdPostal(f?.postalCode ?? "");
        setIdCountry(f?.country ?? "");
      });
    }
  }, [editingItem, encryptionKey]);

  // HIBP breach check (debounced)
  useEffect(() => {
    if (tab !== "login" || !password) {
      setBreachWarning(null);
      return;
    }
    if (breachTimer.current) clearTimeout(breachTimer.current);
    breachTimer.current = setTimeout(async () => {
      setCheckingBreach(true);
      try {
        const result = await checkPasswordBreach(password);
        setBreachWarning(
          result.breached
            ? `This password has been found in ${result.count.toLocaleString()} data breaches. Consider using a different password.`
            : null,
        );
      } catch {
        // Network error — don't block the user
        setBreachWarning(null);
      } finally {
        setCheckingBreach(false);
      }
    }, 800);
    return () => { if (breachTimer.current) clearTimeout(breachTimer.current); };
  }, [password, tab]);

  function handleCancel() {
    setEditingItem(null);
    setView(isEditing ? "item-detail" : "overlay");
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!encryptionKey) return;
    setSaving(true);
    setError(null);

    try {
      const id = editingItemId ?? crypto.randomUUID();
      const now = new Date().toISOString();
      const createdAt = isEditing ? (editingItem?.createdAt ?? now) : now;

      if (tab === "login") {
        const hostname = url ? extractHostname(url) : undefined;
        const fields = { username, password, uris: url ? [{ uri: url, match: "domain" as const }] : [], notes: loginNotes, customFields: [] };
        const blob = await encryptItem(JSON.stringify(fields), encryptionKey);

        const item = Object.assign(
          { id, type: "login" as const, name, favorite: editingItem?.favorite ?? false, tags: [], createdAt, updatedAt: now, encryptedData: blob.ciphertext, ...(hostname !== undefined ? { hostname } : {}) } as LoginItem,
          { _decryptedFields: fields },
        );

        const stored = { id, type: "login", name, ...(hostname !== undefined ? { hostname } : {}), encryptedData: blob.ciphertext, favorite: item.favorite, tags: "", createdAt, updatedAt: now };
        isEditing ? updateStoredItem(stored) : saveStoredItem(stored);
        setItems(isEditing ? items.map((i) => (i.id === id ? item : i)) : [...items, item]);

      } else if (tab === "secure-note") {
        const fields = { content: noteContent };
        const blob = await encryptItem(JSON.stringify(fields), encryptionKey);

        const item = Object.assign(
          { id, type: "secure-note" as const, name: noteTitle, favorite: editingItem?.favorite ?? false, tags: [], createdAt, updatedAt: now, encryptedData: blob.ciphertext } as SecureNoteItem,
          { _decryptedFields: fields },
        );

        const stored = { id, type: "secure-note", name: noteTitle, encryptedData: blob.ciphertext, favorite: item.favorite, tags: "", createdAt, updatedAt: now };
        isEditing ? updateStoredItem(stored) : saveStoredItem(stored);
        setItems(isEditing ? items.map((i) => (i.id === id ? item : i)) : [...items, item]);

      } else if (tab === "card") {
        const fields = { cardholderName: cardHolder, brand: cardBrand, number: cardNumber, expMonth: cardExpMonth, expYear: cardExpYear, cvv: cardCvv };
        const blob = await encryptItem(JSON.stringify(fields), encryptionKey);

        const item = Object.assign(
          { id, type: "card" as const, name: cardName, favorite: editingItem?.favorite ?? false, tags: [], createdAt, updatedAt: now, encryptedData: blob.ciphertext } as CardItem,
          { _decryptedFields: fields },
        );

        const stored = { id, type: "card", name: cardName, encryptedData: blob.ciphertext, favorite: item.favorite, tags: "", createdAt, updatedAt: now };
        isEditing ? updateStoredItem(stored) : saveStoredItem(stored);
        setItems(isEditing ? items.map((i) => (i.id === id ? item : i)) : [...items, item]);

      } else {
        const fields = { firstName: idFirst, lastName: idLast, email: idEmail, phone: idPhone, address1: idAddress1, address2: idAddress2, city: idCity, state: idState, postalCode: idPostal, country: idCountry };
        const blob = await encryptItem(JSON.stringify(fields), encryptionKey);

        const item = Object.assign(
          { id, type: "identity" as const, name: idName, favorite: editingItem?.favorite ?? false, tags: [], createdAt, updatedAt: now, encryptedData: blob.ciphertext } as IdentityItem,
          { _decryptedFields: fields },
        );

        const stored = { id, type: "identity", name: idName, encryptedData: blob.ciphertext, favorite: item.favorite, tags: "", createdAt, updatedAt: now };
        isEditing ? updateStoredItem(stored) : saveStoredItem(stored);
        setItems(isEditing ? items.map((i) => (i.id === id ? item : i)) : [...items, item]);
      }

      setEditingItem(null);
      setView(isEditing ? "item-detail" : "overlay");
    } catch {
      setError("Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  const primaryName = tab === "login" ? name : tab === "secure-note" ? noteTitle : tab === "card" ? cardName : idName;

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
        <button onClick={handleCancel} className="text-white/30 hover:text-white/60 transition-colors shrink-0">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <span className="text-white/80 text-sm font-medium flex-1">
          {isEditing ? "Edit item" : "New item"}
        </span>
      </div>

      {/* Type tabs (only show in create mode) */}
      {!isEditing && (
        <div className="flex gap-1 px-4 pt-3">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                tab === t.id
                  ? "bg-indigo-500 text-white"
                  : "bg-white/6 text-white/40 hover:text-white/60 hover:bg-white/10"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSave} className="flex flex-col gap-2.5 p-4">
        <AnimatePresence mode="wait">
          {tab === "login" && (
            <motion.div key="login" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col gap-2.5">
              <Field label="Name" value={name} onChange={setName} placeholder="e.g. GitHub" autoFocus={!isEditing} />
              <Field label="URL" value={url} onChange={setUrl} placeholder="https://github.com" type="url" />
              <Field label="Username / Email" value={username} onChange={setUsername} placeholder="you@example.com" />
              <PasswordField
                value={password}
                onChange={(v) => { setPassword(v); setBreachWarning(null); }}
                show={showPassword}
                onToggleShow={() => setShowPassword((s) => !s)}
                onGenerate={() => { setPassword(generatePassword({ length: 20, symbols: true })); setShowPassword(true); }}
              />
              <AnimatePresence>
                {checkingBreach && (
                  <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-white/30 text-xs px-1">
                    Checking password security…
                  </motion.p>
                )}
                {breachWarning && !checkingBreach && (
                  <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex items-start gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2.5">
                    <svg className="w-3.5 h-3.5 text-red-400 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <p className="text-red-400 text-xs">{breachWarning}</p>
                  </motion.div>
                )}
              </AnimatePresence>
              <Field label="Notes" value={loginNotes} onChange={setLoginNotes} placeholder="Optional notes" />
            </motion.div>
          )}

          {tab === "secure-note" && (
            <motion.div key="note" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col gap-2.5">
              <Field label="Title" value={noteTitle} onChange={setNoteTitle} placeholder="e.g. WiFi password" autoFocus />
              <div className="flex flex-col gap-1">
                <label className="text-white/35 text-xs px-1">Note</label>
                <textarea
                  value={noteContent}
                  onChange={(e) => setNoteContent(e.target.value)}
                  placeholder="Your secure note…"
                  rows={5}
                  className="w-full bg-white/8 border border-white/12 rounded-xl px-3 py-2.5 text-white placeholder-white/20 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all resize-none"
                />
              </div>
            </motion.div>
          )}

          {tab === "card" && (
            <motion.div key="card" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col gap-2.5">
              <Field label="Card name" value={cardName} onChange={setCardName} placeholder="e.g. Visa Rewards" autoFocus />
              <Field label="Cardholder name" value={cardHolder} onChange={setCardHolder} placeholder="Jane Smith" />
              <Field label="Card number" value={cardNumber} onChange={setCardNumber} placeholder="•••• •••• •••• ••••" type="text" inputMode="numeric" />
              <div className="flex gap-2">
                <Field label="Exp. month" value={cardExpMonth} onChange={setCardExpMonth} placeholder="MM" />
                <Field label="Exp. year" value={cardExpYear} onChange={setCardExpYear} placeholder="YYYY" />
                <Field label="CVV" value={cardCvv} onChange={setCardCvv} placeholder="•••" type="password" />
              </div>
              <Field label="Brand (optional)" value={cardBrand} onChange={setCardBrand} placeholder="Visa / Mastercard / Amex…" />
            </motion.div>
          )}

          {tab === "identity" && (
            <motion.div key="identity" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col gap-2.5">
              <Field label="Label" value={idName} onChange={setIdName} placeholder="e.g. Personal" autoFocus />
              <div className="flex gap-2">
                <Field label="First name" value={idFirst} onChange={setIdFirst} placeholder="Jane" />
                <Field label="Last name" value={idLast} onChange={setIdLast} placeholder="Smith" />
              </div>
              <Field label="Email" value={idEmail} onChange={setIdEmail} placeholder="jane@example.com" type="email" />
              <Field label="Phone" value={idPhone} onChange={setIdPhone} placeholder="+1 555 000 0000" type="tel" />
              <Field label="Address line 1" value={idAddress1} onChange={setIdAddress1} placeholder="123 Main St" />
              <Field label="Address line 2" value={idAddress2} onChange={setIdAddress2} placeholder="Apt 4B" />
              <div className="flex gap-2">
                <Field label="City" value={idCity} onChange={setIdCity} placeholder="San Francisco" />
                <Field label="State" value={idState} onChange={setIdState} placeholder="CA" />
              </div>
              <div className="flex gap-2">
                <Field label="Postal" value={idPostal} onChange={setIdPostal} placeholder="94103" />
                <Field label="Country" value={idCountry} onChange={setIdCountry} placeholder="US" />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {error && <p className="text-red-400 text-xs px-1">{error}</p>}

        <button
          type="submit"
          disabled={!primaryName || saving}
          className="mt-1 w-full bg-indigo-500 hover:bg-indigo-400 disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium py-2.5 rounded-xl text-sm transition-all active:scale-[0.98]"
        >
          {saving ? "Saving…" : isEditing ? "Save changes" : "Save"}
        </button>
      </form>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function Field({
  label, value, onChange, placeholder, type = "text", autoFocus, inputMode,
}: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; type?: string; autoFocus?: boolean;
  inputMode?: "numeric" | "tel" | "email";
}) {
  return (
    <div className="flex flex-col gap-1 flex-1">
      <label className="text-white/35 text-xs px-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        inputMode={inputMode}
        className="w-full bg-white/8 border border-white/12 rounded-xl px-3 py-2.5 text-white placeholder-white/20 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
      />
    </div>
  );
}

function PasswordField({
  value, onChange, show, onToggleShow, onGenerate,
}: {
  value: string; onChange: (v: string) => void;
  show: boolean; onToggleShow: () => void; onGenerate: () => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-white/35 text-xs px-1">Password</label>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <input
            type={show ? "text" : "password"}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Password"
            className="w-full bg-white/8 border border-white/12 rounded-xl px-3 py-2.5 text-white placeholder-white/20 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 pr-9 font-mono tracking-wider"
          />
          <button type="button" onClick={onToggleShow} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/25 hover:text-white/50 transition-colors">
            {show ? (
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
          onClick={onGenerate}
          className="px-3 bg-white/8 hover:bg-white/14 text-white/50 hover:text-white/80 rounded-xl text-xs transition-colors border border-white/12 shrink-0"
        >
          Generate
        </button>
      </div>
    </div>
  );
}
