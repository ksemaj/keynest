/**
 * Vault item types — the core data model for Keynest.
 *
 * All sensitive fields (passwords, card numbers, notes) are stored as
 * encrypted strings on the server. Only metadata needed for search/display
 * (name, URL, item type) is allowed in plaintext fields.
 */

export type ItemType = "login" | "secure-note" | "card" | "identity";

// ---------------------------------------------------------------------------
// Base
// ---------------------------------------------------------------------------

interface VaultItemBase {
  id: string;
  type: ItemType;
  /** Display name — stored in plaintext for search */
  name: string;
  /** ISO 8601 timestamp */
  createdAt: string;
  updatedAt: string;
  /** Collection/folder ID this item belongs to, if any */
  collectionId?: string;
  /** Tags for organization */
  tags: string[];
  /** Whether this item is in the user's favorites */
  favorite: boolean;
}

// ---------------------------------------------------------------------------
// Login
// ---------------------------------------------------------------------------

export interface LoginFields {
  username: string;
  password: string;
  totp?: string;
  uris: LoginUri[];
  notes?: string;
  customFields: CustomField[];
}

export interface LoginUri {
  uri: string;
  /** How to match this URI against the current page */
  match: "domain" | "host" | "startsWith" | "exact" | "regex" | "never";
}

export interface LoginItem extends VaultItemBase {
  type: "login";
  /** Hostname extracted from the primary URI — stored plaintext for autofill matching */
  hostname?: string;
  /** Encrypted JSON of LoginFields */
  encryptedData: string;
}

// ---------------------------------------------------------------------------
// Secure Note
// ---------------------------------------------------------------------------

export interface SecureNoteFields {
  content: string;
}

export interface SecureNoteItem extends VaultItemBase {
  type: "secure-note";
  encryptedData: string;
}

// ---------------------------------------------------------------------------
// Credit/Debit Card
// ---------------------------------------------------------------------------

export interface CardFields {
  cardholderName: string;
  brand?: string;
  number: string;
  expMonth?: string;
  expYear?: string;
  cvv?: string;
  notes?: string;
}

export interface CardItem extends VaultItemBase {
  type: "card";
  encryptedData: string;
}

// ---------------------------------------------------------------------------
// Identity
// ---------------------------------------------------------------------------

export interface IdentityFields {
  title?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  address1?: string;
  address2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  notes?: string;
}

export interface IdentityItem extends VaultItemBase {
  type: "identity";
  encryptedData: string;
}

// ---------------------------------------------------------------------------
// Union
// ---------------------------------------------------------------------------

export type VaultItem = LoginItem | SecureNoteItem | CardItem | IdentityItem;

// ---------------------------------------------------------------------------
// Custom Fields
// ---------------------------------------------------------------------------

export interface CustomField {
  name: string;
  value: string;
  type: "text" | "hidden" | "boolean";
}

// ---------------------------------------------------------------------------
// Collections (folders/groups)
// ---------------------------------------------------------------------------

export interface Collection {
  id: string;
  name: string;
  /** If this belongs to an organization, set here */
  organizationId?: string;
  /** Encrypted name for org collections */
  encryptedName?: string;
}

// ---------------------------------------------------------------------------
// Organization / Team
// ---------------------------------------------------------------------------

export interface Organization {
  id: string;
  name: string;
  plan: "free" | "teams" | "enterprise";
}

export type OrgRole = "owner" | "admin" | "manager" | "member" | "readonly";

export interface OrgMember {
  userId: string;
  email: string;
  role: OrgRole;
  status: "invited" | "accepted" | "confirmed";
  /** User's public key — for encrypting shared items */
  publicKey: string;
}
