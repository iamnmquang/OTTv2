import path from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const here = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: path.resolve(here, "web"),
  plugins: [react()],
  resolve: { alias: { "@web": path.resolve(here, "../web/src") } },
  test: {
    environment: "jsdom",
    setupFiles: [path.resolve(here, "../web/src/test/setup.ts")],
    include: ["src/**/*.test.{ts,tsx}"]
  }
});
