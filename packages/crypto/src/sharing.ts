/**
 * End-to-End Encrypted Sharing
 *
 * Each Keynest user has an X25519 (ECDH) keypair. To share a vault item:
 *  1. Sender derives a shared secret using their private key + recipient's public key
 *  2. Shared secret is used as an AES-256-GCM key to re-encrypt the item
 *  3. Recipient decrypts using their private key + sender's public key
 *
 * The server never sees private keys or plaintext items.
 */

import { encryptItem, decryptItem, toBase64Url, fromBase64Url } from "./vault-crypto.js";

export interface UserKeyPair {
  /** Public key — safe to share with the server and other users */
  publicKey: CryptoKey;
  /** Private key — never leaves the device */
  privateKey: CryptoKey;
}

export interface ExportedPublicKey {
  key: string; // base64url SPKI-encoded public key
}

export interface ExportedKeyPair {
  publicKey: ExportedPublicKey;
  /** Private key encrypted with the user's vault encryption key */
  encryptedPrivateKey: string;
}

/**
 * Generates a new X25519 (ECDH) keypair for a user.
 * Called once at account creation.
 */
export async function generateUserKeyPair(): Promise<UserKeyPair> {
  const keyPair = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveKey"],
  );
  return { publicKey: keyPair.publicKey, privateKey: keyPair.privateKey };
}

/**
 * Exports a public key to base64url SPKI format for server storage.
 */
export async function exportPublicKey(publicKey: CryptoKey): Promise<ExportedPublicKey> {
  const spki = await crypto.subtle.exportKey("spki", publicKey);
  return { key: toBase64Url(new Uint8Array(spki)) };
}

/**
 * Imports a base64url SPKI public key (e.g. from the server).
 */
export async function importPublicKey(exported: ExportedPublicKey): Promise<CryptoKey> {
  const spki = fromBase64Url(exported.key);
  return crypto.subtle.importKey("spki", spki.buffer as ArrayBuffer, { name: "ECDH", namedCurve: "P-256" }, true, []);
}

/**
 * Encrypts the user's private key with their vault encryption key.
 * The encrypted private key is stored on the server — the server cannot
 * decrypt it without the user's master key.
 */
export async function encryptPrivateKey(
  privateKey: CryptoKey,
  encryptionKey: CryptoKey,
): Promise<string> {
  const pkcs8 = await crypto.subtle.exportKey("pkcs8", privateKey);
  const blob = await encryptItem(toBase64Url(new Uint8Array(pkcs8)), encryptionKey);
  return blob.ciphertext;
}

/**
 * Decrypts and imports the user's private key.
 */
export async function decryptPrivateKey(
  encryptedPrivateKey: string,
  encryptionKey: CryptoKey,
): Promise<CryptoKey> {
  const pkcs8B64 = await decryptItem({ ciphertext: encryptedPrivateKey, version: 1 }, encryptionKey);
  const pkcs8 = fromBase64Url(pkcs8B64);
  return crypto.subtle.importKey(
    "pkcs8",
    pkcs8.buffer as ArrayBuffer,
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveKey"],
  );
}

/**
 * Derives a shared AES-256-GCM key from two ECDH keys.
 * Both sender and recipient can independently derive the same key.
 */
export async function deriveSharedKey(
  ownPrivateKey: CryptoKey,
  theirPublicKey: CryptoKey,
): Promise<CryptoKey> {
  return crypto.subtle.deriveKey(
    { name: "ECDH", public: theirPublicKey },
    ownPrivateKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

/**
 * Encrypts a vault item for sharing with a specific recipient.
 */
export async function encryptItemForRecipient(
  plaintext: string,
  senderPrivateKey: CryptoKey,
  recipientPublicKey: CryptoKey,
): Promise<string> {
  const sharedKey = await deriveSharedKey(senderPrivateKey, recipientPublicKey);
  const blob = await encryptItem(plaintext, sharedKey);
  return blob.ciphertext;
}

/**
 * Decrypts a vault item shared with the current user.
 */
export async function decryptSharedItem(
  ciphertext: string,
  recipientPrivateKey: CryptoKey,
  senderPublicKey: CryptoKey,
): Promise<string> {
  const sharedKey = await deriveSharedKey(recipientPrivateKey, senderPublicKey);
  return decryptItem({ ciphertext, version: 1 }, sharedKey);
}
