import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DemoNav, HINT_STORAGE_KEY, PROJECTOR_BODY_ATTRIBUTE } from "./DemoNav";
import { DEMO_NAV_GROUPS, isCurrentLink, isDemoNavEnabled } from "./demoNavLinks";

const STAGING = { origin: "https://ottv2-staging.vercel.app", search: "" };
const NO_FLAG = {};

describe("demo page switcher", () => {
  afterEach(() => {
    cleanup();
    document.body.removeAttribute(PROJECTOR_BODY_ATTRIBUTE);
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it("stays off on production and unknown hosts", () => {
    expect(isDemoNavEnabled({ origin: "https://ottv2-psi.vercel.app" }, NO_FLAG)).toBe(false);
    expect(isDemoNavEnabled({ origin: "https://ottv2-bot-cup-admin.opticsquang.workers.dev" }, NO_FLAG)).toBe(false);
    expect(isDemoNavEnabled({ origin: "http://localhost:5173" }, NO_FLAG)).toBe(false);
    render(<DemoNav place={{ origin: "https://ottv2-psi.vercel.app", search: "" }} env={NO_FLAG} />);
    expect(screen.queryByRole("button", { name: /Chuyển trang/ })).toBeNull();
  });

  it("turns on for every demo origin and for VITE_OTT_DEMO_NAV", () => {
    for (const origin of [
      "https://ottv2-staging.vercel.app",
      "https://ottv2-bot-cup-showcase-web.opticsquang.workers.dev",
      "https://ottv2-bot-cup-admin-showcase.opticsquang.workers.dev",
      "https://ottv2-bot-cup-admin-staging.opticsquang.workers.dev",
      "https://ottv2-bot-cup-admin-rehearsal.opticsquang.workers.dev",
    ]) expect(isDemoNavEnabled({ origin }, NO_FLAG)).toBe(true);
    expect(isDemoNavEnabled({ origin: "http://localhost:5173" }, { VITE_OTT_DEMO_NAV: "true" })).toBe(true);
  });

  it("lists every demo page as a named link and marks the current one", async () => {
    const user = userEvent.setup();
    render(<DemoNav place={STAGING} env={NO_FLAG} />);

    await user.click(screen.getByRole("button", { name: /Chuyển trang/ }));
    const nav = within(screen.getByRole("navigation", { name: "Các trang demo" }));
    const links = nav.getAllByRole("link");
    expect(links).toHaveLength(DEMO_NAV_GROUPS.flatMap((group) => group.links).length);
    for (const link of DEMO_NAV_GROUPS.flatMap((group) => group.links)) {
      expect(nav.getByRole("link", { name: new RegExp(link.label) })).toHaveAttribute("href", link.href);
    }
    const current = links.filter((link) => link.getAttribute("aria-current") === "page");
    expect(current.map((link) => link.getAttribute("href"))).toEqual(["https://ottv2-staging.vercel.app/"]);
  });

  it("tells the Bot Cup screens of one origin apart", () => {
    const showcase = "https://ottv2-bot-cup-showcase-web.opticsquang.workers.dev";
    const bracket = { origin: showcase, search: "?view=bot-cup&screen=bracket" };
    expect(isCurrentLink(`${showcase}/?view=bot-cup&screen=bracket`, bracket)).toBe(true);
    expect(isCurrentLink(`${showcase}/?view=bot-cup&screen=projector`, bracket)).toBe(false);
    expect(isCurrentLink(`${showcase}/`, bracket)).toBe(false);
    expect(isCurrentLink("https://ottv2-bot-cup-admin-staging.opticsquang.workers.dev/", { origin: "https://ottv2-bot-cup-admin-staging.opticsquang.workers.dev", search: "" })).toBe(true);
  });

  it("points at the button until the visitor opens the switcher, then remembers", async () => {
    const user = userEvent.setup();
    render(<DemoNav place={STAGING} env={NO_FLAG} />);

    expect(screen.getByRole("note")).toHaveTextContent("Bấm vào đây để xem các trang demo");
    await user.click(screen.getByRole("button", { name: /Chuyển trang/ }));
    expect(screen.queryByRole("note")).toBeNull();
    expect(window.localStorage.getItem(HINT_STORAGE_KEY)).toBe("true");

    cleanup();
    render(<DemoNav place={STAGING} env={NO_FLAG} />);
    expect(screen.queryByRole("note")).toBeNull();
  });

  it("hides the pointer with its close button", async () => {
    const user = userEvent.setup();
    render(<DemoNav place={STAGING} env={NO_FLAG} />);

    await user.click(screen.getByRole("button", { name: "Ẩn gợi ý" }));
    expect(screen.queryByRole("note")).toBeNull();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(window.localStorage.getItem(HINT_STORAGE_KEY)).toBe("true");
  });

  it("still works when storage is blocked", async () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("blocked"); });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("blocked"); });
    const user = userEvent.setup();
    render(<DemoNav place={STAGING} env={NO_FLAG} />);

    expect(screen.getByRole("note")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Chuyển trang/ }));
    expect(screen.getByRole("dialog", { name: "Chuyển trang" })).toBeInTheDocument();
  });

  it("opens and closes with Alt+K", () => {
    render(<DemoNav place={STAGING} env={NO_FLAG} />);

    fireEvent.keyDown(window, { code: "KeyK", key: "k", altKey: true });
    expect(screen.getByRole("dialog", { name: "Chuyển trang" })).toBeInTheDocument();
    fireEvent.keyDown(window, { code: "KeyK", key: "k", altKey: true });
    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.keyDown(window, { code: "KeyK", key: "k" });
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
