# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project: Keynest

A privacy-first, open-source password manager. macOS desktop (Tauri floating overlay) + browser extension (Chrome/Firefox/Safari) + cloud-synced zero-knowledge backend.

## Commands

```bash
# Install all workspace dependencies
pnpm install

# Build all packages (in dependency order)
pnpm build

# Run dev servers (all apps in parallel)
pnpm dev

# Typecheck everything
pnpm typecheck

# Lint everything
pnpm lint

# Build a single package
pnpm --filter @keynest/crypto build
pnpm --filter @keynest/server build

# Run the server in dev mode
pnpm --filter @keynest/server dev

# Run Tauri desktop app in dev mode (requires Rust toolchain)
source "$HOME/.cargo/env"
pnpm --filter @keynest/desktop tauri:dev

# Build browser extension (outputs to apps/extension/dist/)
pnpm --filter @keynest/extension build

# Database migrations
pnpm --filter @keynest/server db:generate   # generate migration files
pnpm --filter @keynest/server db:migrate    # apply migrations
pnpm --filter @keynest/server db:studio     # open Drizzle Studio
```

## Monorepo Structure

```
keynest/
  packages/
    crypto/     # @keynest/crypto — shared crypto primitives (no app deps)
    vault/      # @keynest/vault  — data model + vault operations (depends on crypto)
  apps/
    server/     # @keynest/server  — Hono API backend (Node.js)
    desktop/    # @keynest/desktop — Tauri macOS app (Rust shell + React/TS)
    extension/  # @keynest/extension — WebExtension MV3 (Chrome/Firefox/Safari)
```

Build order is enforced by Turborepo: `crypto` → `vault` → `server/desktop/extension`.

## Architecture

### Zero-knowledge encryption model
All encryption happens **client-side only**. The server never sees plaintext.

```
Master password
    ↓ Argon2id (packages/crypto/src/kdf.ts — KDF_PARAMS: 64MiB, 3 iter, 4 threads)
Master key (never leaves device)
    ↓ HKDF split
Encryption key + MAC key
    ↓ AES-256-GCM (packages/crypto/src/vault-crypto.ts)
Encrypted vault items → stored on server as opaque blobs
```

For sharing between users: ECDH (P-256) keypairs per user. Shared items re-encrypted with recipient's public key (`packages/crypto/src/sharing.ts`).

**Do not change KDF parameters after any users exist** — this breaks decryption for all existing vaults.

### Vault item model
`packages/vault/src/types.ts` defines the item union: `LoginItem | SecureNoteItem | CardItem | IdentityItem`. Each has:
- Plaintext metadata: `name`, `hostname` (for autofill matching), `type`, `tags`
- `encryptedData`: AES-256-GCM ciphertext of all sensitive fields (password, username, notes, etc.)

### Autofill flow
1. **In browser**: Extension content script (`apps/extension/src/content/index.ts`) detects `<input type="password">` focus, sends field coordinates + hostname to background service worker
2. **Background** (`apps/extension/src/background/index.ts`) forwards to desktop app via Native Messaging (`com.keynest.app`)
3. **In native apps**: Rust accessibility observer (`apps/desktop/src-tauri/src/accessibility.rs`) polls for `AXSecureTextField` focus via macOS Accessibility API
4. Desktop app (Tauri) positions the transparent overlay window near the field and shows it
5. User selects a credential → desktop emits autofill event → content script fills the fields

### Desktop overlay UI
- Tauri window: transparent, always-on-top, no decorations, hidden by default
- Shown/hidden via `invoke("show_overlay", {x, y})` / `invoke("hide_overlay")` from the React frontend
- Three views: `UnlockView` → `OverlayView` (autofill) / `SearchView` (manual, triggered by `Cmd+Shift+K`)
- Animation: Framer Motion spring transitions

### Server (Hono + Drizzle + PostgreSQL)
- Auth: JWT access tokens (15min) + refresh tokens (30 days, stored hashed, rotated on use)
- All routes under `/auth/*` and `/vault/*`
- Vault sync: `GET /vault/sync?since=<timestamp>` returns delta
- Vault items table stores only encrypted blobs + plaintext metadata needed for matching

## Environment Setup

**Server** — copy `apps/server/.env.example` to `apps/server/.env`:
```
DATABASE_URL=postgresql://keynest:password@localhost:5432/keynest
JWT_SECRET=<random 32+ byte hex string>
PORT=3000
```

**Rust** (required for Tauri desktop):
```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source "$HOME/.cargo/env"
cargo install tauri-cli --version "^2"
```

**macOS Accessibility permission** required for native app autofill: System Settings → Privacy & Security → Accessibility → add Keynest.

## Key Constraints

- The `packages/crypto` package must remain **framework-agnostic** — it uses only Web Crypto API (available in browsers, Tauri webview, and Node.js 18+). No Node-specific crypto imports.
- `packages/vault` has no UI dependencies. Keep it that way.
- The server must **never log or store** plaintext vault data. Only `encryptedData` blobs.
- Password checks use HIBP k-anonymity (`packages/crypto/src/breach.ts`) — only the first 5 chars of SHA-1 hash leave the device.
