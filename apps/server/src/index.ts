import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { secureHeaders } from "hono/secure-headers";
import authRoutes from "./routes/auth.js";
import vaultRoutes from "./routes/vault.js";

const app = new Hono();

// ---------------------------------------------------------------------------
// Global middleware
// ---------------------------------------------------------------------------

app.use("*", logger());
app.use("*", secureHeaders());
app.use(
  "*",
  cors({
    origin: [
      "tauri://localhost",
      "http://localhost:1420", // Tauri dev server
      "chrome-extension://*",
      "moz-extension://*",
    ],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  }),
);

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

app.route("/auth", authRoutes);
app.route("/vault", vaultRoutes);

app.get("/health", (c) => c.json({ ok: true, version: "0.1.0" }));

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

const port = parseInt(process.env["PORT"] ?? "3000", 10);

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`Keynest server running on http://localhost:${info.port}`);
});

export default app;
