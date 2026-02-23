import type { Context, Next, Env } from "hono";

export type AuthEnv = { Variables: { userId: string; userEmail: string } };
import { HTTPException } from "hono/http-exception";
import { verifyAccessToken } from "../lib/auth.js";

export async function requireAuth(c: Context<AuthEnv>, next: Next) {
  const authHeader = c.req.header("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    throw new HTTPException(401, { message: "Missing authorization header" });
  }

  const token = authHeader.slice(7);
  try {
    const payload = await verifyAccessToken(token);
    c.set("userId", payload.sub);
    c.set("userEmail", payload.email);
  } catch {
    throw new HTTPException(401, { message: "Invalid or expired token" });
  }

  await next();
}
