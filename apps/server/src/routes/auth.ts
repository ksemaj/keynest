import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { users, sessions } from "../db/schema.js";
import {
  signAccessToken,
  generateRefreshToken,
  hashRefreshToken,
  refreshTokenExpiresAt,
} from "../lib/auth.js";
import { createHash, timingSafeEqual } from "node:crypto";

const app = new Hono();

// ---------------------------------------------------------------------------
// Register
// ---------------------------------------------------------------------------

const registerSchema = z.object({
  email: z.string().email(),
  /** Argon2id hash of master password (computed client-side) */
  passwordHash: z.string().min(1),
  /** Base64url salt used for client-side key derivation */
  kdfSalt: z.string().min(1),
  /** KDF parameters JSON string */
  kdfParams: z.string().min(1),
  /** User's public key for E2E sharing */
  publicKey: z.string().optional(),
  /** Encrypted private key */
  encryptedPrivateKey: z.string().optional(),
});

app.post("/register", zValidator("json", registerSchema), async (c) => {
  const body = c.req.valid("json");

  // Check existing user
  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, body.email.toLowerCase()))
    .limit(1);

  if (existing.length > 0) {
    return c.json({ error: "Email already registered" }, 409);
  }

  // Store the server-side password hash (separate from the KDF used for encryption)
  // This hash is used ONLY for authentication, not for deriving the encryption key
  const serverPasswordHash = createHash("sha256")
    .update(body.passwordHash)
    .digest("hex");

  const [user] = await db
    .insert(users)
    .values({
      email: body.email.toLowerCase(),
      passwordHash: serverPasswordHash,
      kdfSalt: body.kdfSalt,
      kdfParams: body.kdfParams,
      publicKey: body.publicKey,
      encryptedPrivateKey: body.encryptedPrivateKey,
    })
    .returning({ id: users.id, email: users.email });

  if (!user) {
    return c.json({ error: "Failed to create user" }, 500);
  }

  const accessToken = await signAccessToken({ sub: user.id, email: user.email });
  const { raw: refreshToken, hash: refreshHash } = generateRefreshToken();

  await db.insert(sessions).values({
    userId: user.id,
    tokenHash: refreshHash,
    userAgent: c.req.header("User-Agent"),
    ipAddress: c.req.header("X-Forwarded-For") ?? "unknown",
    expiresAt: refreshTokenExpiresAt(),
  });

  return c.json({ accessToken, refreshToken, userId: user.id }, 201);
});

// ---------------------------------------------------------------------------
// Login
// ---------------------------------------------------------------------------

const loginSchema = z.object({
  email: z.string().email(),
  passwordHash: z.string().min(1),
});

app.post("/login", zValidator("json", loginSchema), async (c) => {
  const body = c.req.valid("json");

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, body.email.toLowerCase()))
    .limit(1);

  if (!user) {
    // Always return the same error to prevent user enumeration
    return c.json({ error: "Invalid credentials" }, 401);
  }

  const serverPasswordHash = createHash("sha256")
    .update(body.passwordHash)
    .digest("hex");

  // Timing-safe comparison to prevent timing attacks
  const storedHash = Buffer.from(user.passwordHash, "hex");
  const givenHash = Buffer.from(serverPasswordHash, "hex");

  if (
    storedHash.length !== givenHash.length ||
    !timingSafeEqual(storedHash, givenHash)
  ) {
    return c.json({ error: "Invalid credentials" }, 401);
  }

  const accessToken = await signAccessToken({ sub: user.id, email: user.email });
  const { raw: refreshToken, hash: refreshHash } = generateRefreshToken();

  await db.insert(sessions).values({
    userId: user.id,
    tokenHash: refreshHash,
    userAgent: c.req.header("User-Agent"),
    ipAddress: c.req.header("X-Forwarded-For") ?? "unknown",
    expiresAt: refreshTokenExpiresAt(),
  });

  return c.json({
    accessToken,
    refreshToken,
    userId: user.id,
    kdfSalt: user.kdfSalt,
    kdfParams: user.kdfParams,
    publicKey: user.publicKey,
    encryptedPrivateKey: user.encryptedPrivateKey,
  });
});

// ---------------------------------------------------------------------------
// Refresh
// ---------------------------------------------------------------------------

app.post(
  "/refresh",
  zValidator("json", z.object({ refreshToken: z.string() })),
  async (c) => {
    const { refreshToken } = c.req.valid("json");
    const tokenHash = hashRefreshToken(refreshToken);

    const [session] = await db
      .select({ id: sessions.id, userId: sessions.userId, expiresAt: sessions.expiresAt })
      .from(sessions)
      .where(eq(sessions.tokenHash, tokenHash))
      .limit(1);

    if (!session || session.expiresAt < new Date()) {
      return c.json({ error: "Invalid or expired refresh token" }, 401);
    }

    const [user] = await db
      .select({ id: users.id, email: users.email })
      .from(users)
      .where(eq(users.id, session.userId))
      .limit(1);

    if (!user) {
      return c.json({ error: "User not found" }, 401);
    }

    // Rotate refresh token
    const { raw: newRefreshToken, hash: newHash } = generateRefreshToken();
    await db
      .update(sessions)
      .set({ tokenHash: newHash, expiresAt: refreshTokenExpiresAt() })
      .where(eq(sessions.id, session.id));

    const accessToken = await signAccessToken({ sub: user.id, email: user.email });
    return c.json({ accessToken, refreshToken: newRefreshToken });
  },
);

// ---------------------------------------------------------------------------
// Logout
// ---------------------------------------------------------------------------

app.post(
  "/logout",
  zValidator("json", z.object({ refreshToken: z.string() })),
  async (c) => {
    const { refreshToken } = c.req.valid("json");
    const tokenHash = hashRefreshToken(refreshToken);
    await db.delete(sessions).where(eq(sessions.tokenHash, tokenHash));
    return c.json({ ok: true });
  },
);

export default app;
