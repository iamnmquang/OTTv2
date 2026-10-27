/**
 * Links of the demo page switcher (plan docs/superpowers/plans/2026-10-27-demo-nav.md). Every URL here is already public
 * in the repository (wrangler.jsonc, scripts/bot-cup/showcase.mjs, docs), so they live in code rather than in build env.
 */
const STAGING_WEB = "https://ottv2-staging.vercel.app";
const PRODUCTION_WEB = "https://ottv2-psi.vercel.app";
const SHOWCASE_WEB = "https://ottv2-bot-cup-showcase-web.opticsquang.workers.dev";
const ADMIN_SHOWCASE = "https://ottv2-bot-cup-admin-showcase.opticsquang.workers.dev";
const ADMIN_STAGING = "https://ottv2-bot-cup-admin-staging.opticsquang.workers.dev";
const ADMIN_REHEARSAL = "https://ottv2-bot-cup-admin-rehearsal.opticsquang.workers.dev";

export interface DemoNavLink {
  readonly label: string;
  readonly href: string;
  readonly hint?: string;
}

export interface DemoNavGroup {
  readonly title: string;
  readonly links: readonly DemoNavLink[];
}

export const DEMO_NAV_GROUPS: readonly DemoNavGroup[] = [
  {
    title: "Game",
    links: [
      { label: "Game staging", href: `${STAGING_WEB}/`, hint: "Bản thử nghiệm dùng khi demo" },
      { label: "Game production", href: `${PRODUCTION_WEB}/`, hint: "Bản chính thức, dự phòng" },
    ],
  },
  {
    title: "Bot Cup showcase (100 đội)",
    links: [
      { label: "Trang chủ showcase", href: `${SHOWCASE_WEB}/` },
      { label: "Nhánh đấu", href: `${SHOWCASE_WEB}/?view=bot-cup&screen=bracket` },
      { label: "Trình chiếu", href: `${SHOWCASE_WEB}/?view=bot-cup&screen=projector` },
      { label: "Trang BTC showcase", href: `${ADMIN_SHOWCASE}/`, hint: "Đăng nhập một bấm" },
    ],
  },
  {
    title: "Bot Cup staging",
    links: [
      { label: "Màn giải staging", href: `${STAGING_WEB}/?view=bot-cup` },
      { label: "Trang BTC staging", href: `${ADMIN_STAGING}/` },
      { label: "Trang BTC diễn tập", href: `${ADMIN_REHEARSAL}/` },
    ],
  },
  {
    title: "Mã nguồn",
    links: [{ label: "GitHub", href: "https://github.com/iamnmquang/OTTv2" }],
  },
];

/** Origins that show the switcher. Production web and the production organisers' site are not among them. */
const DEMO_NAV_ORIGINS = new Set([STAGING_WEB, SHOWCASE_WEB, ADMIN_SHOWCASE, ADMIN_STAGING, ADMIN_REHEARSAL]);

type Place = Pick<Location, "origin" | "search">;

/** On for the demo origins, or anywhere the build sets VITE_OTT_DEMO_NAV=true (local development). */
export function isDemoNavEnabled(place: Pick<Location, "origin">, env?: { readonly [key: string]: unknown }): boolean {
  const flag = env?.VITE_OTT_DEMO_NAV;
  if (flag === true || (typeof flag === "string" && ["true", "1"].includes(flag.trim().toLowerCase()))) return true;
  return DEMO_NAV_ORIGINS.has(place.origin);
}

/** Same origin and, for the player web app, the same `view` and `screen` (an absent one counts). */
export function isCurrentLink(href: string, place: Place): boolean {
  const target = new URL(href);
  if (target.origin !== place.origin) return false;
  const here = new URLSearchParams(place.search);
  return ["view", "screen"].every((name) => target.searchParams.get(name) === here.get(name));
}
