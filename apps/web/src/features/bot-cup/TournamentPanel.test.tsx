// @vitest-environment jsdom
import { act, cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BotCupApiError, type BotCupApiGateway, type BracketView, type KnockoutPairing, type TournamentView } from "./BotCupApiGateway";
import { TOURNAMENT_REFRESH_MS, TournamentPanel } from "./TournamentPanel";
import { KnockoutTree } from "./bracket/KnockoutTree";

const NOW = Date.UTC(2026, 11, 9, 3, 0);
const SHA = "a".repeat(64);

function gatewayWith(overrides: Record<string, unknown>) {
  return { resultDocumentUrl: (stage: string) => `/api/t/results/${stage}`, ...overrides } as unknown as BotCupApiGateway;
}

const semiFinal: KnockoutPairing = {
  round: 1, slot: "SF1", red: "Đội Alpha", blue: "Đội Delta", seeds: [1, 4], points: [3, 3], tiebreaks: 1, winner: null, decidedBySeed: false,
  games: [
    { id: "g1", mapId: "classic", gameIndex: 0, status: "finished", outcome: "win", winner: "A", reason: "goal", red: "a" },
    { id: "g2", mapId: "classic", gameIndex: 1, status: "finished", outcome: "win", winner: "A", reason: "elimination", red: "b" },
    { id: "g7", mapId: "flanks", gameIndex: 6, status: "queued", outcome: null, winner: null, reason: null, red: "a" },
  ],
};

const view: TournamentView = {
  phase: "knockout",
  documents: [{ stage: "sealed", sha256: SHA, publishedAt: NOW }, { stage: "qualifying", sha256: "b".repeat(64), publishedAt: NOW }],
  standings: { format: "swiss", rows: [
    { rank: 1, displayName: "Đội Alpha", points: 12, wins: 20, games: 24, sb: 30, buchholzCut1: 40 },
    { rank: 2, displayName: "Đội Beta", points: 7.5, wins: 14, games: 24, sb: 18, buchholzCut1: 31.5 },
  ] },
  rounds: [
    { round: 1, mapId: "classic", pairings: [
      { red: "Đội Alpha", blue: "Đội Beta", bye: null, points: [2, 0], played: 2, total: 2, games: [
        { id: "s1", mapId: "classic", gameIndex: 0, status: "finished", outcome: "win", winner: "A", reason: "goal", red: "a" },
        { id: "s2", mapId: "classic", gameIndex: 1, status: "finished", outcome: "win", winner: "B", reason: "goal", red: "b" },
      ] },
      { red: null, blue: null, bye: "Đội Gamma", points: null, played: 0, total: 0, games: [] },
    ] },
    { round: 2, mapId: "flanks", pairings: [
      { red: "Đội Gamma", blue: "Đội Alpha", bye: null, points: [0.5, 0.5], played: 1, total: 2, games: [] },
      { red: "Đội Beta", blue: "Đội Delta", bye: null, points: [1, 0], played: 1, total: 2, games: [] },
    ] },
  ],
  bracket: { size: 4, rounds: [
    { name: "SF", slots: [{ slot: "SF1", pairing: semiFinal }, { slot: "SF2", pairing: null }] },
    { name: "F", slots: [{ slot: "F", pairing: null }, { slot: "3RD", pairing: null }] },
  ] },
  knockout: [semiFinal],
};

describe("TournamentPanel", () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("opens on the bracket during the knockout; a pairing shows its games and replays", async () => {
    const user = userEvent.setup();
    const onOpenReplay = vi.fn();
    const getMatchReplay = vi.fn().mockResolvedValue({ replay: { kind: "doc" }, sha256: "x" });
    render(<TournamentPanel gateway={gatewayWith({ getTournament: vi.fn().mockResolvedValue(view), getMatchReplay })} signedIn={false} onOpenReplay={onOpenReplay} />);

    expect(await screen.findByText("Đang đấu loại trực tiếp")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Nhánh đấu" })).toHaveAttribute("aria-pressed", "true");
    const tree = screen.getByRole("list", { name: "Nhánh loại trực tiếp 4 đội" });
    expect(within(tree).getByRole("heading", { name: "Bán kết" })).toBeInTheDocument();
    expect(within(tree).getByLabelText("Bán kết 2: chưa xác định")).toBeInTheDocument();
    expect(within(tree).getByLabelText("Chung kết: chưa xác định")).toBeInTheDocument();

    await user.click(within(tree).getByRole("button", { name: "Bán kết 1: Đội Alpha (hạt giống 1) 3 – 3 Đội Delta (hạt giống 4), đang đấu" }));
    expect(screen.getByText("Bán kết 1: Đội Alpha (1) 3 – 3 Đội Delta (4)")).toBeInTheDocument();
    // Game 2: Delta held Red (seat A) and won.
    expect(screen.getByText("Ván 2 · Classic · Đỏ Đội Delta · Đội Delta thắng (tiêu diệt hết quân)")).toBeInTheDocument();
    expect(screen.getByText("Ván 7 · Flanks · Đỏ Đội Alpha · đang chờ")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Xem replay" })).toHaveLength(2);
    await user.click(screen.getAllByRole("button", { name: "Xem replay" })[0]);
    expect(getMatchReplay).toHaveBeenCalledWith("g1");
    expect(onOpenReplay).toHaveBeenCalledWith({ kind: "doc" });
  });

  it("shows the qualifying rounds one at a time, the newest first, with a team filter and the table", async () => {
    const user = userEvent.setup();
    render(<TournamentPanel gateway={gatewayWith({ getTournament: vi.fn().mockResolvedValue(view) })} signedIn={false} initialSection="qualifying" />);

    const pairings = await screen.findByRole("list", { name: "Các cặp vòng 2" });
    expect(screen.getByRole("button", { name: "Vòng 2 · đang đấu" })).toHaveAttribute("aria-pressed", "true");
    expect(within(pairings).getByRole("button", { name: "Đội Gamma 0,5 – 0,5 Đội Alpha, đã đấu 1/2 ván" })).toBeInTheDocument();
    await user.type(screen.getByLabelText("Tìm đội"), "delta");
    expect(within(pairings).getAllByRole("listitem")).toHaveLength(1);
    await user.clear(screen.getByLabelText("Tìm đội"));

    await user.click(screen.getByRole("button", { name: "Vòng 1" }));
    const first = screen.getByRole("list", { name: "Các cặp vòng 1" });
    expect(within(first).getByText("được nghỉ (bye, 2 điểm)")).toBeInTheDocument();
    await user.click(within(first).getByRole("button", { name: "Đội Alpha 2 – 0 Đội Beta" }));
    expect(within(first).getByText("Ván 2 · Classic · Đỏ Đội Beta · Đội Alpha thắng (vào ô thắng)")).toBeInTheDocument();

    const table = screen.getByRole("table");
    expect(within(table).getByRole("rowheader", { name: "Đội Beta" }).closest("tr")).toHaveTextContent("7,5");
  });

  it("refreshes while the event runs", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const getTournament = vi.fn().mockResolvedValue(view);
    render(<TournamentPanel gateway={gatewayWith({ getTournament })} signedIn={false} />);
    await screen.findByText("Đang đấu loại trực tiếp");
    await act(async () => { vi.advanceTimersByTime(TOURNAMENT_REFRESH_MS); });
    expect(getTournament).toHaveBeenCalledTimes(2);
  });

  it("checks a document's SHA-256 in the browser", async () => {
    const user = userEvent.setup();
    const verifyResultDocument = vi.fn().mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    render(<TournamentPanel gateway={gatewayWith({ getTournament: vi.fn().mockResolvedValue(view), verifyResultDocument })} signedIn={false} />);
    await user.click(await screen.findByRole("button", { name: "Tài liệu & khiếu nại" }));
    expect(screen.getByText(SHA)).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Tải JSON" })[0]).toHaveAttribute("href", "/api/t/results/sealed");
    expect(screen.queryByRole("form", { name: "Gửi khiếu nại" })).not.toBeInTheDocument();
    const buttons = screen.getAllByRole("button", { name: "Kiểm tra SHA-256" });
    await user.click(buttons[0]);
    expect(verifyResultDocument).toHaveBeenCalledWith("sealed", SHA);
    expect(await screen.findByText("Khớp: tài liệu chưa bị sửa.")).toBeInTheDocument();
    await user.click(buttons[1]);
    expect(await screen.findByText("KHÔNG khớp. Hãy báo BTC.")).toBeInTheDocument();
  });

  it("lets a signed-in team appeal a published stage and shows the answer", async () => {
    const user = userEvent.setup();
    const answered = { id: "p1", stage: "qualifying", matchId: null, body: "Ván 3 bị lỗi máy chấm.", status: "answered", response: "Đã xem replay.", createdAt: NOW, answeredAt: NOW };
    const listAppeals = vi.fn().mockResolvedValueOnce({ appeals: [] }).mockResolvedValueOnce({ appeals: [answered] });
    const createAppeal = vi.fn().mockResolvedValue({ id: "p1", status: "open" });
    render(<TournamentPanel gateway={gatewayWith({ getTournament: vi.fn().mockResolvedValue(view), listAppeals, createAppeal })} signedIn initialSection="documents" />);

    const form = await screen.findByRole("form", { name: "Gửi khiếu nại" });
    // Only stages with published results can be appealed; "sealed" is not an appeal stage.
    expect(within(form).getAllByRole("option").map((option) => option.textContent)).toEqual(["Kết quả vòng loại"]);
    await user.type(within(form).getByLabelText("Nội dung (10–2000 ký tự)"), "Ván 3 bị lỗi máy chấm.");
    await user.click(within(form).getByRole("button", { name: "Gửi khiếu nại" }));
    expect(createAppeal).toHaveBeenCalledWith("qualifying", "Ván 3 bị lỗi máy chấm.", undefined);
    expect(await screen.findByText("Đã gửi khiếu nại. BTC sẽ trả lời tại đây.")).toBeInTheDocument();
    expect(screen.getByText("Đã xem replay.")).toBeInTheDocument();
  });

  it("explains a refused appeal in Vietnamese", async () => {
    const user = userEvent.setup();
    const createAppeal = vi.fn().mockRejectedValue(new BotCupApiError(409, "appeal_window_closed"));
    render(<TournamentPanel gateway={gatewayWith({ getTournament: vi.fn().mockResolvedValue(view), listAppeals: vi.fn().mockResolvedValue({ appeals: [] }), createAppeal })} signedIn initialSection="documents" />);
    const form = await screen.findByRole("form", { name: "Gửi khiếu nại" });
    await user.type(within(form).getByLabelText("Nội dung (10–2000 ký tự)"), "Khiếu nại quá hạn rồi.");
    await user.click(within(form).getByRole("button", { name: "Gửi khiếu nại" }));
    expect(await screen.findByText("Ngoài thời hạn khiếu nại của giai đoạn này.")).toBeInTheDocument();
  });
});

describe("KnockoutTree", () => {
  afterEach(cleanup);

  it("draws a bracket of 16 before it is played: every slot named, from the round of 16 to the final", () => {
    const empty = (slots: string[]) => slots.map((slot) => ({ slot, pairing: null }));
    const bracket: BracketView = { size: 16, rounds: [
      { name: "R16", slots: empty(["R16-1", "R16-2", "R16-3", "R16-4", "R16-5", "R16-6", "R16-7", "R16-8"]) },
      { name: "QF", slots: empty(["QF1", "QF2", "QF3", "QF4"]) },
      { name: "SF", slots: empty(["SF1", "SF2"]) },
      { name: "F", slots: empty(["F", "3RD"]) },
    ] };
    render(<KnockoutTree bracket={bracket} />);
    const tree = screen.getByRole("list", { name: "Nhánh loại trực tiếp 16 đội" });
    expect(within(tree).getAllByRole("heading").map((heading) => heading.textContent)).toEqual(["Vòng 1/8", "Tứ kết", "Bán kết", "Chung kết"]);
    expect(within(tree).getAllByLabelText(/: chưa xác định$/)).toHaveLength(16);
    expect(within(tree).getByLabelText("Vòng 1/8 · cặp 8: chưa xác định")).toBeInTheDocument();
    expect(within(tree).getByLabelText("Tranh hạng ba: chưa xác định")).toBeInTheDocument();
  });

  it("says so when there are too few teams for a knockout", () => {
    render(<KnockoutTree bracket={{ size: 0, rounds: [] }} />);
    expect(screen.getByText("Chưa đủ đội để có vòng loại trực tiếp.")).toBeInTheDocument();
  });
});
