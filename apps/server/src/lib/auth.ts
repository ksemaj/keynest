/**
 * Authentication helpers — JWT access + refresh token flow.
 *
 * Access tokens: short-lived (15 min), signed with HS256
 * Refresh tokens: long-lived (30 days), stored hashed in DB for revocation
 */

import { SignJWT, jwtVerify } from "jose";
import { createHash, randomBytes } from "node:crypto";

const JWT_SECRET = new TextEncoder().encode(
  process.env["JWT_SECRET"] ?? (() => { throw new Error("JWT_SECRET is required"); })()
);

const ACCESS_TOKEN_TTL = "15m";
const REFRESH_TOKEN_TTL_DAYS = 30;

export interface TokenPayload {
  sub: string; // user ID
  email: string;
}

export async function signAccessToken(payload: TokenPayload): Promise<string> {
  return new SignJWT({ email: payload.email })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(ACCESS_TOKEN_TTL)
    .sign(JWT_SECRET);
}

export async function verifyAccessToken(token: string): Promise<TokenPayload> {
  const { payload } = await jwtVerify(token, JWT_SECRET);
  if (!payload.sub || typeof payload["email"] !== "string") {
    throw new Error("Invalid token payload");
  }
  return { sub: payload.sub, email: payload["email"] };
}

export function generateRefreshToken(): { raw: string; hash: string } {
  const raw = randomBytes(48).toString("base64url");
  const hash = createHash("sha256").update(raw).digest("hex");
  return { raw, hash };
}

export function hashRefreshToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function refreshTokenExpiresAt(): Date {
  const d = new Date();
  d.setDate(d.getDate() + REFRESH_TOKEN_TTL_DAYS);
  return d;
}
