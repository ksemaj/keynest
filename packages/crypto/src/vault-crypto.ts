/**
 * Vault Item Encryption / Decryption
 *
 * All vault items are encrypted with AES-256-GCM before leaving the device.
 * Each item gets a unique random IV — never reuse an IV with the same key.
 *
 * Wire format (base64url-encoded):
 *   [2 bytes version][12 bytes IV][N bytes ciphertext+tag]
 */

const VERSION = 1;
const IV_LENGTH = 12; // 96-bit IV for AES-GCM
const TAG_LENGTH = 128; // 128-bit authentication tag

export interface EncryptedBlob {
  /** Base64url-encoded ciphertext, ready to send to the server */
  ciphertext: string;
  /** Schema version — allows future cipher migrations */
  version: number;
}

/**
 * Encrypts a vault item's plaintext JSON with AES-256-GCM.
 * The result is safe to store on the server.
 */
export async function encryptItem(
  plaintext: string,
  encryptionKey: CryptoKey,
): Promise<EncryptedBlob> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const encoder = new TextEncoder();

  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, tagLength: TAG_LENGTH },
    encryptionKey,
    encoder.encode(plaintext),
  );

  // Pack: version (2 bytes, big-endian) + iv (12 bytes) + ciphertext
  const packed = new Uint8Array(2 + IV_LENGTH + ciphertext.byteLength);
  const view = new DataView(packed.buffer);
  view.setUint16(0, VERSION, false);
  packed.set(iv, 2);
  packed.set(new Uint8Array(ciphertext), 2 + IV_LENGTH);

  return {
    ciphertext: toBase64Url(packed),
    version: VERSION,
  };
}

/**
 * Decrypts an encrypted blob back to plaintext JSON.
 * Throws if authentication fails (tampered data).
 */
export async function decryptItem(
  blob: EncryptedBlob,
  encryptionKey: CryptoKey,
): Promise<string> {
  const packed = fromBase64Url(blob.ciphertext);
  const view = new DataView(packed.buffer, packed.byteOffset, packed.byteLength);

  const version = view.getUint16(0, false);
  if (version !== VERSION) {
    throw new Error(`Unsupported ciphertext version: ${version}`);
  }

  const iv = packed.slice(2, 2 + IV_LENGTH);
  const ciphertext = packed.slice(2 + IV_LENGTH);

  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv, tagLength: TAG_LENGTH },
    encryptionKey,
    ciphertext,
  );

  return new TextDecoder().decode(plaintext);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

export function fromBase64Url(str: string): Uint8Array {
  const base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
