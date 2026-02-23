/**
 * Database schema — Drizzle ORM + PostgreSQL
 *
 * Design principles:
 *  - Sensitive vault data is stored ONLY as encrypted blobs (encryptedData)
 *  - The server can read: item IDs, types, user associations, timestamps
 *  - The server CANNOT read: passwords, usernames, notes, card numbers
 */

import {
  pgTable,
  uuid,
  text,
  timestamp,
  boolean,
  pgEnum,
  integer,
} from "drizzle-orm/pg-core";

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const itemTypeEnum = pgEnum("item_type", [
  "login",
  "secure-note",
  "card",
  "identity",
]);

export const orgRoleEnum = pgEnum("org_role", [
  "owner",
  "admin",
  "manager",
  "member",
  "readonly",
]);

export const memberStatusEnum = pgEnum("member_status", [
  "invited",
  "accepted",
  "confirmed",
]);

export const planEnum = pgEnum("plan", ["free", "pro", "teams", "enterprise"]);

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  /** Argon2id hash of master password (for SRP/auth only, NOT the encryption key) */
  passwordHash: text("password_hash").notNull(),
  /** Base64url-encoded Argon2id salt for client-side key derivation */
  kdfSalt: text("kdf_salt").notNull(),
  /** KDF parameters as JSON — allows future upgrades */
  kdfParams: text("kdf_params").notNull(),
  /** User's public key (SPKI, base64url) for E2E sharing */
  publicKey: text("public_key"),
  /** User's private key encrypted with their vault key */
  encryptedPrivateKey: text("encrypted_private_key"),
  plan: planEnum("plan").notNull().default("free"),
  emailVerified: boolean("email_verified").notNull().default(false),
  twoFactorEnabled: boolean("two_factor_enabled").notNull().default(false),
  encryptedTotpSecret: text("encrypted_totp_secret"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// Vault Items
// ---------------------------------------------------------------------------

export const vaultItems = pgTable("vault_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  organizationId: uuid("organization_id").references(() => organizations.id, {
    onDelete: "cascade",
  }),
  collectionId: uuid("collection_id"),
  type: itemTypeEnum("type").notNull(),
  /** Display name — stored plaintext for search */
  name: text("name").notNull(),
  /** Extracted hostname for autofill matching — plaintext */
  hostname: text("hostname"),
  /** AES-256-GCM encrypted JSON of all sensitive fields */
  encryptedData: text("encrypted_data").notNull(),
  favorite: boolean("favorite").notNull().default(false),
  /** Comma-separated tags — stored plaintext */
  tags: text("tags").notNull().default(""),
  /** Soft delete */
  deletedAt: timestamp("deleted_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// Collections
// ---------------------------------------------------------------------------

export const collections = pgTable("collections", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
  organizationId: uuid("organization_id").references(() => organizations.id, {
    onDelete: "cascade",
  }),
  name: text("name").notNull(),
  encryptedName: text("encrypted_name"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// Organizations
// ---------------------------------------------------------------------------

export const organizations = pgTable("organizations", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  plan: planEnum("plan").notNull().default("free"),
  maxMembers: integer("max_members").notNull().default(5),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const orgMembers = pgTable("org_members", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  role: orgRoleEnum("role").notNull().default("member"),
  status: memberStatusEnum("status").notNull().default("invited"),
  inviteToken: text("invite_token"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// Sessions (JWT refresh tokens stored for revocation)
// ---------------------------------------------------------------------------

export const sessions = pgTable("sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  /** Hashed refresh token */
  tokenHash: text("token_hash").notNull().unique(),
  userAgent: text("user_agent"),
  ipAddress: text("ip_address"),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// Sync (for conflict resolution)
// ---------------------------------------------------------------------------

export const syncRevisions = pgTable("sync_revisions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  /** Monotonically increasing revision number per user */
  revision: integer("revision").notNull().default(0),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
