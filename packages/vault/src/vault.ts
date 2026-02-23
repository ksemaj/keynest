/**
 * VaultStore — in-memory vault with encrypt/decrypt lifecycle.
 *
 * Manages the decrypted state of the vault in memory. When the user
 * locks the vault, all decrypted data is cleared from memory.
 */

import { encryptItem, decryptItem } from "@keynest/crypto";
import type { VaultItem, LoginItem, LoginFields } from "./types.js";

export interface VaultStore {
  items: Map<string, VaultItem>;
  isLocked: boolean;
}

/**
 * Decrypts an encrypted vault item payload and merges it into the item.
 */
export async function decryptVaultItem(
  item: VaultItem,
  encryptionKey: CryptoKey,
): Promise<VaultItem> {
  const plaintext = await decryptItem(
    { ciphertext: item.encryptedData, version: 1 },
    encryptionKey,
  );
  const fields = JSON.parse(plaintext) as Record<string, unknown>;
  return { ...item, _decryptedFields: fields } as VaultItem & { _decryptedFields: unknown };
}

/**
 * Encrypts a vault item's sensitive fields and returns a safe-to-store item.
 */
export async function encryptVaultItem<T extends VaultItem>(
  item: Omit<T, "encryptedData"> & { fields: object },
  encryptionKey: CryptoKey,
): Promise<T> {
  const blob = await encryptItem(JSON.stringify(item.fields), encryptionKey);
  const { fields: _fields, ...rest } = item;
  return { ...rest, encryptedData: blob.ciphertext } as unknown as T;
}

/**
 * Finds login items that match a given hostname for autofill.
 */
export function findMatchingLogins(
  items: VaultItem[],
  hostname: string,
): LoginItem[] {
  return items
    .filter((item): item is LoginItem => item.type === "login")
    .filter((item) => {
      if (!item.hostname) return false;
      // Normalize both to compare root domain
      const itemHost = item.hostname.replace(/^www\./, "");
      const queryHost = hostname.replace(/^www\./, "");
      return itemHost === queryHost || queryHost.endsWith(`.${itemHost}`);
    });
}

/**
 * Generates a new vault item ID.
 */
export function generateId(): string {
  return crypto.randomUUID();
}

/**
 * Extracts the hostname from a URL for storage and matching.
 */
export function extractHostname(url: string): string | undefined {
  try {
    return new URL(url).hostname;
  } catch {
    return undefined;
  }
}

/**
 * Gets the decrypted login fields from a vault item.
 * The item must have been decrypted first via decryptVaultItem.
 */
export function getLoginFields(item: VaultItem): LoginFields | undefined {
  if (item.type !== "login") return undefined;
  const extended = item as LoginItem & { _decryptedFields?: LoginFields };
  return extended._decryptedFields;
}
