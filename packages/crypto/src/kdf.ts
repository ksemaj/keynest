/**
 * Key Derivation Function
 *
 * Derives a master key from a user's master password using Argon2id.
 * The derived key is NEVER sent to the server — it exists only in memory
 * on the client and is used to encrypt/decrypt vault data locally.
 *
 * Parameters are chosen to be strong against GPU-based attacks while
 * remaining usable on mid-range hardware (~500ms on modern hardware).
 */

import { argon2id } from "hash-wasm";

// These must NEVER be reduced after launch without a full vault migration.
export const KDF_PARAMS = {
  memory: 65536,    // 64 MiB
  iterations: 3,
  parallelism: 4,
  hashLen: 32,      // 256-bit output
} as const;

export interface DerivedKey {
  /** The raw 32-byte master key (never leaves device) */
  keyMaterial: ArrayBuffer;
  /** The salt used — must be stored alongside the user's account */
  salt: Uint8Array;
}

/**
 * Derives a 256-bit master key from a master password.
 */
export async function deriveMasterKey(
  masterPassword: string,
  salt: Uint8Array,
): Promise<DerivedKey> {
  const hash = await argon2id({
    password: masterPassword,
    salt,
    parallelism: KDF_PARAMS.parallelism,
    iterations: KDF_PARAMS.iterations,
    memorySize: KDF_PARAMS.memory,
    hashLength: KDF_PARAMS.hashLen,
    outputType: "binary",
  });

  return { keyMaterial: hash.buffer.slice(hash.byteOffset, hash.byteOffset + hash.byteLength) as ArrayBuffer, salt };
}

/**
 * Generates a cryptographically random 16-byte salt.
 * Each user gets a unique salt — never reuse salts.
 */
export function generateSalt(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(16));
}

/**
 * Splits the master key into an encryption key and a MAC key using HKDF.
 * This ensures the key used for encryption is never directly the master key.
 */
export async function deriveSubkeys(keyMaterial: ArrayBuffer): Promise<{
  encryptionKey: CryptoKey;
  macKey: CryptoKey;
}> {
  const baseKey = await crypto.subtle.importKey(
    "raw",
    keyMaterial,
    { name: "HKDF" },
    false,
    ["deriveKey"],
  );

  const encoder = new TextEncoder();

  const [encryptionKey, macKey] = await Promise.all([
    crypto.subtle.deriveKey(
      {
        name: "HKDF",
        hash: "SHA-256",
        salt: encoder.encode("keynest-encryption-key-v1"),
        info: encoder.encode("encryption"),
      },
      baseKey,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"],
    ),
    crypto.subtle.deriveKey(
      {
        name: "HKDF",
        hash: "SHA-256",
        salt: encoder.encode("keynest-mac-key-v1"),
        info: encoder.encode("mac"),
      },
      baseKey,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign", "verify"],
    ),
  ]);

  return { encryptionKey, macKey };
}
