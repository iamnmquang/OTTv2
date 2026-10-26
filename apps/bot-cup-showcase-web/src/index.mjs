/**
 * Public site of the 100-team showcase (plan docs/superpowers/plans/2026-10-26-bot-cup-admin-showcase.md §3.5, F): the
 * player web app built with the Bot Cup on (scripts/bot-cup/build-showcase-web.mjs) and served as static assets, and
 * /api/t/* handed to the showcase API Worker through a service binding, so the browser stays same-origin as it does
 * behind Vercel's rewrite on staging. No game Worker: online play shows as unavailable here; the Bot Cup screens,
 * bracket, replays and projector work.
 *
 * Bindings: ASSETS (the build), API (service: ottv2-bot-cup-api-showcase). Only /api/t/* reaches this code
 * (wrangler.jsonc `run_worker_first`); everything else is served from the assets.
 */
export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);
    if (pathname === "/api/t" || pathname.startsWith("/api/t/")) return env.API.fetch(request);
    return env.ASSETS.fetch(request);
  }
};
