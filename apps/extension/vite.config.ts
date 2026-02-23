import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import webExtension from "vite-plugin-web-extension";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    webExtension({
      manifest: "public/manifest.json",
      additionalInputs: {
        scripts: ["src/content/index.ts", "src/background/index.ts"],
        html: ["src/popup/popup.html"],
      },
    }),
  ],
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});
