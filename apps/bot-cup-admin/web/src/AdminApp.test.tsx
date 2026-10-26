// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { act, cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AdminApi } from "./api";
import { AdminApp } from "./AdminApp";
import { nextStep } from "./autoRun";
import type { TournamentAdminView } from "./types";

type Handler = (body: Record<string, unknown> | undefined) => { status?: number; json?: unknown; text?: string };

/** A fetch that answers admin API routes from a table ("METHOD /path"), recording every call. */
function fakeApi(routes: Record<string, Handler | object>) {
  const calls: Array<{ method: string; path: string; body: Record<string, unknown> | undefined }> = [];
  const fetchImpl = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
    const path = String(url).replace("/admin-api", "");
    const method = init?.method ?? "GET";
    const body = init?.body ? JSON.parse(String(init.body)) as Record<string, unknown> : undefined;
    calls.push({ method, path, body });
    const route = routes[`${method} ${path}`];
    if (route === undefined) return new Response(JSON.stringify({ error: "not_found" }), { status: 404, headers: { "content-type": "application/json" } });
    const answer = typeof route === "function" ? (route as Handler)(body) : { json: route };
    if (answer.text !== undefined) return new Response(answer.text, { status: answer.status ?? 200, headers: { "content-type": "text/plain" } });
    return new Response(JSON.stringify(answer.json), { status: answer.status ?? 200, headers: { "content-type": "application/json" } });
  });
  return { api: new AdminApi("/admin-api", fetchImpl as unknown as typeof fetch), calls };
}

const ME = { email: "btc1@demo.local", role: "admin", authMode: "demo", fourEyes: [], publicWebOrigin: "https://web.test" };
const OVERVIEW = {
  event: { id: "showcase-1", name: "OTT Bot Cup · Demo", mode: "demo", phase: "registration", registrationOpensAt: 1, registrationClosesAt: 2, practiceOpensAt: null, codeFreezeAt: null, finalsAt: null },
  serverTime: Date.now(), teams: { active: 100 }, disqualifiedTeams: 0, submissions: { ready: 100 }, submissionsLast24h: 100, jobs: {}, runnersOnline: 1,
  alerts: { suspectRunners: 0, failedJobs: 0, openFlags: 2, pendingApprovals: 0 },
};
const empty = (bracket: TournamentAdminView["bracket"]) => bracket;
const TOURNAMENT: TournamentAdminView = {
  phase: "registration", codeFreezeAt: 1, mode: "demo", knockoutSize: 16, entrants: [], gateProgress: [],
  standings: { format: null, rows: [] }, rounds: [], knockout: [], interviews: null, documents: [], appeals: [],
  bracket: empty({ size: 4, rounds: [
    { name: "SF", slots: [{ slot: "SF1", pairing: null }, { slot: "SF2", pairing: null }] },
    { name: "F", slots: [{ slot: "F", pairing: null }, { slot: "3RD", pairing: null }] },
  ] }),
};

describe("organisers' site", () => {
  beforeEach(() => { window.location.hash = ""; });
  afterEach(cleanup);

  it("signs in with one click in demo mode", async () => {
    const user = userEvent.setup();
    let signedIn = false;
    const { api, calls } = fakeApi({
      "GET /me": () => (signedIn ? { json: ME } : { status: 401, json: { error: "unauthorized" } }),
      "GET /login": { authMode: "demo", admins: [{ email: "btc1@demo.local", role: "admin" }, { email: "btc2@demo.local", role: "admin" }] },
      "POST /login": () => { signedIn = true; return { json: { email: "btc2@demo.local", role: "admin" } }; },
      "GET /overview": OVERVIEW,
    });
    render(<AdminApp api={api} />);
    await user.click(await screen.findByRole("button", { name: "Đăng nhập: btc2@demo.local" }));
    expect(calls.find((call) => call.method === "POST" && call.path === "/login")?.body).toEqual({ email: "btc2@demo.local" });
    expect(await screen.findByRole("heading", { name: "OTT Bot Cup · Demo" })).toBeInTheDocument();
    expect(screen.getByText("THỬ NGHIỆM · showcase-1")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Cờ gian lận/ })).toHaveTextContent("2");
  });

  it("shows a step's dry run before it runs, needs a reason, and blocks a step the server refuses", async () => {
    const user = userEvent.setup();
    window.location.hash = "tournament";
    let frozen = false;
    const { api, calls } = fakeApi({
      "GET /me": ME, "GET /overview": OVERVIEW,
      "GET /tournament": () => ({ json: { ...TOURNAMENT, phase: frozen ? "frozen" : "registration" } }),
      "POST /tournament/freeze": (body) => {
        if (body?.dryRun) return { json: { ok: true, dryRun: true, sealed: 98, notSealed: 2 } };
        frozen = true;
        return { json: { ok: true, sealed: 98, notSealed: 2 } };
      },
      "POST /tournament/gate-start": () => ({ status: 409, json: { error: "games_pending", pending: 3 } }),
    });
    render(<AdminApp api={api} />);
    await user.click(await screen.findByRole("button", { name: "Khóa code và niêm phong" }));
    const dialog = await screen.findByRole("dialog", { name: "Khóa code và niêm phong" });
    expect(await within(dialog).findByText("98 bài niêm phong, 2 đội không có bài")).toBeInTheDocument();
    const confirm = within(dialog).getByRole("button", { name: "Xác nhận" });
    expect(confirm).toBeDisabled();
    await user.type(within(dialog).getByLabelText("Lý do (ghi vào audit log)"), "Tới giờ khóa code");
    await user.click(confirm);
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(calls.filter((call) => call.path === "/tournament/freeze").map((call) => call.body)).toEqual([{ dryRun: true }, { reason: "Tới giờ khóa code" }]);
    expect(await screen.findByText("Khóa code và niêm phong: xong.")).toBeInTheDocument();

    await user.click(await screen.findByRole("button", { name: "Bắt đầu vòng sơ loại" }));
    const refused = await screen.findByRole("dialog", { name: "Bắt đầu vòng sơ loại" });
    expect(await within(refused).findByText("Chưa làm được: Còn ván chưa chấm xong (3 ván).")).toBeInTheDocument();
    await user.type(within(refused).getByLabelText("Lý do (ghi vào audit log)"), "thử");
    expect(within(refused).getByRole("button", { name: "Xác nhận" })).toBeDisabled();
  });

  it("shows the bracket with links to the public page and the projector", async () => {
    window.location.hash = "bracket";
    const { api } = fakeApi({ "GET /me": ME, "GET /overview": OVERVIEW, "GET /tournament": TOURNAMENT });
    render(<AdminApp api={api} />);
    expect(await screen.findByRole("list", { name: "Nhánh loại trực tiếp 4 đội" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Mở trang công khai" })).toHaveAttribute("href", "https://web.test/?view=bot-cup&screen=bracket");
    expect(screen.getByRole("link", { name: "Mở màn trình chiếu" })).toHaveAttribute("href", "https://web.test/?view=bot-cup&screen=projector");
    expect(screen.getByRole("button", { name: "Nhánh đấu" })).toHaveAttribute("aria-current", "page");
  });

  it("offers the auto run only to demo admins", async () => {
    window.location.hash = "tournament";
    const routes = { "GET /overview": OVERVIEW, "GET /tournament": TOURNAMENT };
    const demo = fakeApi({ ...routes, "GET /me": ME });
    render(<AdminApp api={demo.api} />);
    expect(await screen.findByRole("button", { name: "Tự chạy tới hết" })).toBeInTheDocument();
    cleanup();
    const real = fakeApi({ ...routes, "GET /me": { ...ME, authMode: "password" } });
    render(<AdminApp api={real.api} />);
    await screen.findByRole("button", { name: "Khóa code và niêm phong" });
    expect(screen.queryByRole("button", { name: "Tự chạy tới hết" })).not.toBeInTheDocument();
  });

  it("pages long tables", async () => {
    const user = userEvent.setup();
    window.location.hash = "teams";
    const teams = Array.from({ length: 120 }, (_, index) => ({ id: `t${index}`, handle: `h${index}`, display_name: `Đội ${index}`, kind: "solo", status: "active", disqualified_at: null, members: 1, submissions: 1 }));
    const { api } = fakeApi({ "GET /me": ME, "GET /overview": OVERVIEW, "GET /teams": { teams } });
    render(<AdminApp api={api} />);
    expect(await screen.findByText("Trang 1/3 · 120 dòng")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Sau" }));
    expect(screen.getByText("Đội 50")).toBeInTheDocument();
    await user.type(screen.getByLabelText("Tìm"), "Đội 119");
    expect(screen.getByRole("heading", { name: "Đội (1/120)" })).toBeInTheDocument();
  });
});

describe("auto run", () => {
  it("presses the step the phase allows, waits on pending games, passes the top 4 and stops when finished", async () => {
    let phase = "qualifying";
    const { api, calls } = fakeApi({
      "GET /tournament": () => ({ json: { ...TOURNAMENT, phase, standings: { format: "swiss", rows: [] }, interviews: phase === "verification" ? { size: 16, ready: false, seeded: [], waitingFor: ["a", "b"] } : null } }),
      "POST /tournament/swiss-next": () => ({ status: 409, json: { error: "swiss_complete" } }),
      "POST /tournament/qualifying-close": () => { phase = "verification"; return { json: { ok: true, teams: 60 } }; },
      "POST /tournament/interviews": () => ({ json: { ok: true, teamIds: ["a", "b"] } }),
    });
    expect(await nextStep(api)).toEqual({ kind: "done", step: "qualifying-close", summary: { ok: true, teams: 60 } });
    expect(await nextStep(api)).toMatchObject({ kind: "done", step: "interviews" });
    expect(calls.find((call) => call.path === "/tournament/interviews")?.body).toEqual({ reason: "Demo: điều phối tự động", teamIds: ["a", "b"], result: "pass" });

    phase = "knockout";
    const pending = fakeApi({
      "GET /tournament": { ...TOURNAMENT, phase: "knockout" },
      "POST /tournament/knockout-advance": () => ({ status: 409, json: { error: "games_pending", pending: 4 } }),
    });
    expect(await nextStep(pending.api)).toEqual({ kind: "wait", code: "games_pending" });
    const done = fakeApi({ "GET /tournament": { ...TOURNAMENT, phase: "finished" } });
    expect(await nextStep(done.api)).toEqual({ kind: "finished" });
    const broken = fakeApi({ "GET /tournament": { ...TOURNAMENT, phase: "frozen" }, "POST /tournament/gate-start": () => ({ status: 403, json: { error: "read_only" } }) });
    await expect(nextStep(broken.api)).rejects.toThrow("read_only");
    await act(async () => undefined);
  });
});
