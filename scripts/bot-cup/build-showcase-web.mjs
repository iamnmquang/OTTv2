#!/usr/bin/env node
/**
 * Builds the player web app for the showcase public site (apps/bot-cup-showcase-web): the Bot Cup on, no Vercel rewrite
 * (the Worker forwards /api/t itself) and no game Worker endpoints, into apps/bot-cup-showcase-web/public.
 * Run by that Worker's `build.command`, so `wrangler deploy` always ships a fresh build.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "vite";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

process.env.VITE_OTT_BOT_CUP_ENABLED = "true";
delete process.env.OTT_BOT_CUP_API_ORIGIN;
for (const name of ["VITE_OTT_PLAYHTML_HOST", "VITE_OTT_PLAYHTML_CONTROL_ENDPOINT"]) delete process.env[name];

await build({
  configFile: path.join(ROOT, "apps/web/vite.config.ts"),
  build: { outDir: path.join(ROOT, "apps/bot-cup-showcase-web/public"), emptyOutDir: true },
  logLevel: "warn"
});
console.log("showcase web built into apps/bot-cup-showcase-web/public");
