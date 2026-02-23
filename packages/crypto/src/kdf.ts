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

// Argon2id parameters
// These must NEVER be reduced after launch without a migration path.
export const KDF_PARAMS = {
  type: 2,          // Argon2id
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
 * Uses the Web Crypto API's SubtleCrypto where possible, with
 * Argon2id via WebAssembly for the memory-hard KDF step.
 */
export async function deriveMasterKey(
  masterPassword: string,
  salt: Uint8Array,
): Promise<DerivedKey> {
  // Dynamic import so this works in both browser and Node (via wasm)
  const argon2 = await getArgon2();

  const result = await argon2.hash({
    pass: masterPassword,
    salt,
    type: KDF_PARAMS.type,
    mem: KDF_PARAMS.memory,
    time: KDF_PARAMS.iterations,
    parallelism: KDF_PARAMS.parallelism,
    hashLen: KDF_PARAMS.hashLen,
  });

  // Copy into a plain ArrayBuffer to avoid SharedArrayBuffer issues
  const raw = result.hash;
  const keyMaterial = raw.buffer.slice(
    raw.byteOffset,
    raw.byteOffset + raw.byteLength,
  ) as ArrayBuffer;

  return { keyMaterial, salt };
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

// ---------------------------------------------------------------------------
// Argon2 runtime loader
// ---------------------------------------------------------------------------

let argon2Instance: Awaited<ReturnType<typeof loadArgon2>> | null = null;

async function loadArgon2() {
  // In browser/extension environments, use argon2-browser (WASM)
  // In Node.js (server-side testing), fall back to a pure-JS shim
  if (typeof window !== "undefined" || typeof self !== "undefined") {
    const mod = await import("argon2-browser");
    return mod.default ?? mod;
  }
  // Node.js: use the hash function directly
  const mod = await import("argon2-browser/dist/argon2.js");
  return mod.default ?? mod;
}

async function getArgon2() {
  if (!argon2Instance) {
    argon2Instance = await loadArgon2();
  }
  return argon2Instance;
}
