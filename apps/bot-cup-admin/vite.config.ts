/**
 * Organisers' site (plan 2026-10-26-bot-cup-admin-showcase §3.4): React app in web/, built into public/, which the Worker
 * serves as static assets (wrangler.jsonc `assets`, `build.command`). Theme, UI and the bracket components come from the
 * player web app, so both sites look and behave alike. The CSP of the Worker is `script-src 'self'`: everything is
 * bundled, no CDN.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

const here = path.dirname(fileURLToPath(import.meta.url));
const webSrc = path.resolve(here, "../web/src");
const fonts = path.resolve(here, "../web/static/fonts");

/** The pixel fonts of the shared theme (global.css loads /fonts/*.ttf), served in dev and copied into the build. */
function sharedFonts(): Plugin {
  return {
    name: "ott-admin-shared-fonts",
    configureServer(server) {
      server.middlewares.use("/fonts", (request, response, next) => {
        const file = path.join(fonts, path.basename(request.url ?? ""));
        if (!file.endsWith(".ttf") || !fs.existsSync(file)) return next();
        response.setHeader("content-type", "font/ttf");
        fs.createReadStream(file).pipe(response);
      });
    },
    generateBundle() {
      for (const name of fs.readdirSync(fonts).filter((file) => file.endsWith(".ttf"))) {
        this.emitFile({ type: "asset", fileName: `fonts/${name}`, source: fs.readFileSync(path.join(fonts, name)) });
      }
    }
  };
}

export default defineConfig({
  root: path.resolve(here, "web"),
  publicDir: "static",
  plugins: [react(), sharedFonts()],
  resolve: {
    alias: { "@web": webSrc }
  },
  build: {
    outDir: path.resolve(here, "public"),
    emptyOutDir: true
  },
  server: {
    port: 5174,
    // `npm run bot-cup:admin:dev` runs the admin Worker on 8790.
    proxy: { "/admin-api": { target: "http://127.0.0.1:8790" } },
    fs: { allow: [path.resolve(here, "../..")] }
  }
});
