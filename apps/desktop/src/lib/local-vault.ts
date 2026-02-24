/**
 * Local vault storage helpers.
 *
 * All sensitive crypto material is either kept only in memory (encryption keys)
 * or stored encrypted (private key). The only plaintext things stored locally:
 *  - KDF salt (needed to re-derive the key on next unlock)
 *  - Email address
 *  - A "vault check" blob — an AES-GCM encrypted known string used to verify
 *    the master password without the server. If we can decrypt it, the password
 *    is correct. This is the same approach Bitwarden uses locally.
 */

import { encryptItem, decryptItem } from "@keynest/crypto";

const KEYS = {
  kdfSalt: "keynest:kdf-salt",
  email: "keynest:email",
  vaultCheck: "keynest:vault-check",
  encryptedPrivateKey: "keynest:encrypted-private-key",
  publicKey: "keynest:public-key",
} as const;

const VAULT_CHECK_PLAINTEXT = "keynest-vault-check-v1";

export interface LocalAccount {
  email: string;
  kdfSalt: Uint8Array;
}

export function getLocalAccount(): LocalAccount | null {
  const saltB64 = localStorage.getItem(KEYS.kdfSalt);
  const email = localStorage.getItem(KEYS.email);
  if (!saltB64 || !email) return null;
  return {
    email,
    kdfSalt: Uint8Array.from(atob(saltB64), (c) => c.charCodeAt(0)),
  };
}

export async function saveLocalAccount(
  email: string,
  kdfSalt: Uint8Array,
  encryptionKey: CryptoKey,
): Promise<void> {
  // Store plaintext metadata
  localStorage.setItem(KEYS.email, email);
  localStorage.setItem(KEYS.kdfSalt, btoa(String.fromCharCode(...kdfSalt)));

  // Store vault check blob for offline password verification
  const checkBlob = await encryptItem(VAULT_CHECK_PLAINTEXT, encryptionKey);
  localStorage.setItem(KEYS.vaultCheck, checkBlob.ciphertext);
}

/**
 * Verifies the master password by attempting to decrypt the vault check blob.
 * Returns the encryption key if successful, throws if the password is wrong.
 */
export async function verifyLocalPassword(
  encryptionKey: CryptoKey,
): Promise<void> {
  const checkCiphertext = localStorage.getItem(KEYS.vaultCheck);
  if (!checkCiphertext) {
    throw new Error("No vault check found — account may not be set up");
  }

  const plaintext = await decryptItem(
    { ciphertext: checkCiphertext, version: 1 },
    encryptionKey,
  );

  if (plaintext !== VAULT_CHECK_PLAINTEXT) {
    throw new Error("Vault check mismatch");
  }
}

export function clearLocalAccount(): void {
  Object.values(KEYS).forEach((k) => localStorage.removeItem(k));
}

export function hasLocalAccount(): boolean {
  return !!localStorage.getItem(KEYS.kdfSalt);
}

// ---------------------------------------------------------------------------
// Vault item persistence
// ---------------------------------------------------------------------------

const ITEMS_KEY = "keynest:items";

/** Encrypted item as stored on disk — no plaintext sensitive data */
export interface StoredItem {
  id: string;
  type: string;
  name: string;
  hostname?: string;
  encryptedData: string;
  favorite: boolean;
  tags: string;
  createdAt: string;
  updatedAt: string;
}

export function loadStoredItems(): StoredItem[] {
  try {
    const raw = localStorage.getItem(ITEMS_KEY);
    return raw ? (JSON.parse(raw) as StoredItem[]) : [];
  } catch {
    return [];
  }
}

export function saveStoredItem(item: StoredItem): void {
  const items = loadStoredItems().filter((i) => i.id !== item.id);
  items.push(item);
  localStorage.setItem(ITEMS_KEY, JSON.stringify(items));
}

export function deleteStoredItem(id: string): void {
  const items = loadStoredItems().filter((i) => i.id !== id);
  localStorage.setItem(ITEMS_KEY, JSON.stringify(items));
}
