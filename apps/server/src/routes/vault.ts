import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { eq, and, isNull, gt, sql } from "drizzle-orm";
import { db } from "../db/index.js";
import { vaultItems, syncRevisions } from "../db/schema.js";
import { requireAuth } from "../middleware/auth.js";

type Env = { Variables: { userId: string; userEmail: string } };
const app = new Hono<Env>();

app.use("*", requireAuth);

// ---------------------------------------------------------------------------
// Sync — fetch all items (or delta since a revision)
// ---------------------------------------------------------------------------

app.get("/sync", async (c) => {
  const userId = c.get("userId") as string;
  const sinceRevision = c.req.query("since");

  const items = await db
    .select()
    .from(vaultItems)
    .where(
      and(
        eq(vaultItems.userId, userId),
        isNull(vaultItems.deletedAt),
        sinceRevision
          ? gt(vaultItems.updatedAt, new Date(parseInt(sinceRevision, 10)))
          : undefined,
      ),
    );

  const [rev] = await db
    .select()
    .from(syncRevisions)
    .where(eq(syncRevisions.userId, userId))
    .limit(1);

  return c.json({ items, revision: rev?.revision ?? 0 });
});

// ---------------------------------------------------------------------------
// Create item
// ---------------------------------------------------------------------------

const itemSchema = z.object({
  id: z.string().uuid(),
  type: z.enum(["login", "secure-note", "card", "identity"]),
  name: z.string().min(1).max(255),
  hostname: z.string().optional(),
  encryptedData: z.string().min(1),
  favorite: z.boolean().default(false),
  tags: z.string().default(""),
  collectionId: z.string().uuid().optional(),
});

app.post("/items", zValidator("json", itemSchema), async (c) => {
  const userId = c.get("userId") as string;
  const body = c.req.valid("json");

  const [item] = await db
    .insert(vaultItems)
    .values({ ...body, userId })
    .returning();

  await bumpRevision(userId);

  return c.json(item, 201);
});

// ---------------------------------------------------------------------------
// Update item
// ---------------------------------------------------------------------------

app.put(
  "/items/:id",
  zValidator("json", itemSchema.partial().omit({ id: true })),
  async (c) => {
    const userId = c.get("userId") as string;
    const id = c.req.param("id");
    const body = c.req.valid("json");

    const [item] = await db
      .update(vaultItems)
      .set({ ...body, updatedAt: new Date() })
      .where(and(eq(vaultItems.id, id), eq(vaultItems.userId, userId)))
      .returning();

    if (!item) return c.json({ error: "Not found" }, 404);

    await bumpRevision(userId);
    return c.json(item);
  },
);

// ---------------------------------------------------------------------------
// Soft delete item
// ---------------------------------------------------------------------------

app.delete("/items/:id", async (c) => {
  const userId = c.get("userId") as string;
  const id = c.req.param("id");

  const [item] = await db
    .update(vaultItems)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(vaultItems.id, id), eq(vaultItems.userId, userId)))
    .returning({ id: vaultItems.id });

  if (!item) return c.json({ error: "Not found" }, 404);

  await bumpRevision(userId);
  return c.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function bumpRevision(userId: string) {
  await db
    .insert(syncRevisions)
    .values({ userId, revision: 1 })
    .onConflictDoUpdate({
      target: syncRevisions.userId,
      set: {
        revision: sql`${syncRevisions.revision} + 1`,
        updatedAt: new Date(),
      },
    });
}

export default app;
