import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Badge } from "../../shared/ui/Badge";
import { Button } from "../../shared/ui/Button";
import { Panel } from "../../shared/ui/Panel";
import { Spinner } from "../../shared/ui/Spinner";
import type { Appeal, AppealStage, BotCupApiGateway, ResultStage, TournamentView } from "./BotCupApiGateway";
import { botCupErrorMessage } from "./botCupMessages";
import { formatDateTime } from "./botCupFormat";
import { FormAlert } from "./formParts";
import { KnockoutTree } from "./bracket/KnockoutTree";
import { PairingGames } from "./bracket/PairingGames";
import { SwissRounds } from "./bracket/SwissRounds";
import { score, slotLabel } from "./bracket/bracketFormat";
import styles from "./botCup.module.css";

const PHASE_LABELS: Readonly<Record<string, string>> = {
  registration: "Đang đăng ký và luyện tập",
  practice: "Đang luyện tập",
  frozen: "Đã khóa code, bài thi đã niêm phong",
  gate: "Đang đấu vòng kiểm tra",
  qualifying: "Đang đấu vòng loại",
  verification: "BTC đang phỏng vấn code",
  knockout: "Đang đấu loại trực tiếp",
  finished: "Giải đã kết thúc",
};

export const RESULT_STAGE_LABELS: Readonly<Record<ResultStage, string>> = {
  sealed: "Danh sách bài niêm phong",
  gate: "Kết quả vòng kiểm tra",
  qualifying: "Kết quả vòng loại",
  final: "Kết quả chung cuộc",
};

const APPEAL_STAGES: readonly AppealStage[] = ["gate", "qualifying", "final"];
// Results change while games are played; a visible page refreshes on this interval (plain HTTP to /api/t).
export const TOURNAMENT_REFRESH_MS = 15_000;

export type ResultsSection = "bracket" | "qualifying" | "documents";
const SECTIONS: ReadonlyArray<readonly [ResultsSection, string]> = [
  ["bracket", "Nhánh đấu"],
  ["qualifying", "Vòng loại"],
  ["documents", "Tài liệu & khiếu nại"],
];

/** The section that matters most in each phase. */
function defaultSection(phase: string): ResultsSection {
  if (phase === "knockout" || phase === "finished") return "bracket";
  if (phase === "qualifying" || phase === "verification") return "qualifying";
  return "documents";
}

/**
 * Published tournament results (plan §8.8; 2026-10-26 §3.3): the knockout tree, the qualifying rounds and table, and the
 * documents whose SHA-256 anyone can check. Everything here is public and refreshes while the page is visible.
 */
export function TournamentPanel({ gateway, signedIn, onOpenReplay, initialSection }: {
  readonly gateway: BotCupApiGateway;
  readonly signedIn: boolean;
  readonly onOpenReplay?: (document: unknown) => void;
  readonly initialSection?: ResultsSection;
}) {
  const [view, setView] = useState<TournamentView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [section, setSection] = useState<ResultsSection | null>(initialSection ?? null);
  const [selected, setSelected] = useState<string | null>(null);
  const [checks, setChecks] = useState<Readonly<Record<string, "checking" | "ok" | "bad" | "error">>>({});
  const [replayError, setReplayError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    gateway.getTournament(controller.signal).then(setView, (cause) => {
      if (!controller.signal.aborted) setError(botCupErrorMessage(cause));
    });
    return () => controller.abort();
  }, [gateway]);

  // Keep the last good view if a refresh fails; stop once the event is over.
  const loaded = view !== null;
  const finished = view?.phase === "finished";
  useEffect(() => {
    if (!loaded || finished) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === "hidden") return;
      gateway.getTournament().then(setView, () => undefined);
    }, TOURNAMENT_REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [gateway, loaded, finished]);

  const verify = async (stage: ResultStage, sha256: string) => {
    setChecks((current) => ({ ...current, [stage]: "checking" }));
    try {
      const ok = await gateway.verifyResultDocument(stage, sha256);
      setChecks((current) => ({ ...current, [stage]: ok ? "ok" : "bad" }));
    } catch {
      setChecks((current) => ({ ...current, [stage]: "error" }));
    }
  };

  const replay = onOpenReplay ? (matchId: string) => {
    setReplayError(null);
    gateway.getMatchReplay(matchId).then(({ replay: document }) => onOpenReplay(document), (cause) => setReplayError(botCupErrorMessage(cause)));
  } : undefined;

  if (error) return <Panel heading="Kết quả giải"><FormAlert message={error} /></Panel>;
  if (!view) return <Panel heading="Kết quả giải"><Spinner label="Đang tải kết quả giải" /></Panel>;

  const shown = section ?? defaultSection(view.phase);
  const pick = view.bracket.rounds.flatMap((round) => round.slots).find((slot) => slot.slot === selected)?.pairing ?? null;

  return (
    <div className={styles.results}>
      <Panel className={styles.submissionsCard}>
        <div className={styles.resultsHead}>
          <Badge status="info">{PHASE_LABELS[view.phase] ?? view.phase}</Badge>
          {finished ? null : <span className={styles.hint}>Tự cập nhật mỗi {TOURNAMENT_REFRESH_MS / 1000} giây.</span>}
        </div>
        <nav className={styles.tabs} aria-label="Mục kết quả">
          {SECTIONS.map(([id, label]) => (
            <button key={id} type="button" className={styles.tab} aria-pressed={shown === id} onClick={() => setSection(id)}>{label}</button>
          ))}
        </nav>
      </Panel>

      {shown === "bracket" ? (
        <Panel heading={view.bracket.size ? `Loại trực tiếp · ${view.bracket.size} đội` : "Loại trực tiếp"} className={styles.submissionsCard}>
          {view.knockout.length === 0 && view.bracket.size ? (
            <p className={styles.hint}>Nhánh được điền theo hạt giống sau vòng loại và phỏng vấn code. Mỗi cặp đấu 6 ván; hòa thì đấu thêm tie-break.</p>
          ) : null}
          <KnockoutTree bracket={view.bracket} selected={selected} onSelect={(slot) => setSelected(selected === slot ? null : slot)} />
          <FormAlert message={replayError} />
          {pick && selected ? (
            <section className={styles.pairingDetail} aria-label={`Chi tiết ${slotLabel(selected)}`}>
              <h3 className={styles.subheading}>
                {slotLabel(selected)}: {pick.red} ({pick.seeds[0]}) {score(pick.points[0])} – {score(pick.points[1])} {pick.blue} ({pick.seeds[1]})
              </h3>
              <p className={styles.hint}>
                {pick.winner ? `${pick.winner} đi tiếp${pick.decidedBySeed ? " (hòa sau tie-break, hạt giống cao hơn đi tiếp)" : ""}.` : "Chưa phân thắng thua."}
                {pick.tiebreaks ? ` Đã đấu ${pick.tiebreaks} lượt tie-break.` : ""}
              </p>
              <PairingGames red={pick.red} blue={pick.blue} games={pick.games} onOpenReplay={replay} />
            </section>
          ) : view.knockout.length ? <p className={styles.hint}>Chọn một cặp để xem từng ván và replay.</p> : null}
        </Panel>
      ) : null}

      {shown === "qualifying" ? (
        view.standings.format ? (
          <>
            <Panel heading={`Vòng loại · ${view.standings.format === "round_robin" ? "vòng tròn" : "Swiss"}`} className={styles.submissionsCard}>
              <FormAlert message={replayError} />
              <SwissRounds rounds={view.rounds} format={view.standings.format} onOpenReplay={replay} />
            </Panel>
            <Panel heading="Bảng xếp hạng vòng loại" className={styles.submissionsCard}>
              <p className={styles.hint}>
                {view.standings.format === "round_robin"
                  ? "Mỗi cặp đấu 6 ván (3 bản đồ × 2 màu). Thắng ván 1 điểm, hòa 0,5; điểm bảng là tổng điểm các ván."
                  : "Mỗi vòng, mỗi cặp đấu 2 ván đổi màu trên bản đồ của vòng. Thắng ván 1 điểm, hòa 0,5; bye được 2 điểm."}
              </p>
              <div className={styles.tableWrap}>
                <table className={styles.schedule}>
                  <thead>
                    <tr>
                      <th scope="col">#</th>
                      <th scope="col">Đội</th>
                      <th scope="col">Điểm</th>
                      <th scope="col">Ván thắng</th>
                      <th scope="col">Số ván</th>
                      {view.standings.format === "swiss" ? <th scope="col">Buchholz-1</th> : null}
                      <th scope="col">SB</th>
                    </tr>
                  </thead>
                  <tbody>
                    {view.standings.rows.map((row) => (
                      <tr key={row.rank}>
                        <td>{row.rank}</td>
                        <th scope="row">{row.displayName}</th>
                        <td>{score(row.points)}</td>
                        <td>{row.wins}</td>
                        <td>{row.games}</td>
                        {view.standings.format === "swiss" ? <td>{score(row.buchholzCut1 ?? 0)}</td> : null}
                        <td>{score(row.sb ?? 0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
          </>
        ) : <Panel heading="Vòng loại" className={styles.submissionsCard}><p className={styles.hint}>Vòng loại chưa bắt đầu. Chỉ đội đạt vòng kiểm tra được vào.</p></Panel>
      ) : null}

      {shown === "documents" ? (
        <>
          <Panel heading="Tài liệu đã công bố" className={styles.submissionsCard}>
            {view.documents.length === 0 ? <p className={styles.hint}>Chưa công bố kết quả nào. Danh sách bài niêm phong có ngay sau giờ khóa code.</p> : (
              <ul className={styles.announcements} aria-label="Tài liệu kết quả đã công bố">
                {view.documents.map((doc) => (
                  <li key={doc.stage}>
                    <h3 className={styles.subheading}>{RESULT_STAGE_LABELS[doc.stage] ?? doc.stage}</h3>
                    <p className={styles.hint}>Công bố {formatDateTime(doc.publishedAt)}</p>
                    <p className={styles.hint}>SHA-256: <code className={styles.sha}>{doc.sha256}</code></p>
                    <div className={styles.docActions}>
                      <a href={gateway.resultDocumentUrl(doc.stage)} target="_blank" rel="noopener noreferrer">Tải JSON</a>
                      <Button variant="secondary" disabled={checks[doc.stage] === "checking"} onClick={() => void verify(doc.stage, doc.sha256)}>Kiểm tra SHA-256</Button>
                      <span role="status" className={styles.hint}>
                        {checks[doc.stage] === "ok" ? "Khớp: tài liệu chưa bị sửa." : null}
                        {checks[doc.stage] === "bad" ? "KHÔNG khớp. Hãy báo BTC." : null}
                        {checks[doc.stage] === "error" ? "Không tải được tài liệu." : null}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
          {signedIn ? <AppealsPanel gateway={gateway} published={view.documents.map((doc) => doc.stage)} /> : null}
        </>
      ) : null}
    </div>
  );
}

/** A team's appeals (plan §8.9): at most 3 per stage, inside the window after that stage's results are published. */
export function AppealsPanel({ gateway, published }: { readonly gateway: BotCupApiGateway; readonly published: readonly ResultStage[] }) {
  const [appeals, setAppeals] = useState<readonly Appeal[] | null>(null);
  const [stage, setStage] = useState<AppealStage>("gate");
  const [text, setText] = useState("");
  const [matchId, setMatchId] = useState("");
  const [alert, setAlert] = useState<{ message: string; tone: "error" | "success" } | null>(null);
  const [busy, setBusy] = useState(false);
  const stages = APPEAL_STAGES.filter((item) => published.includes(item));

  const refresh = useCallback((signal?: AbortSignal) => gateway.listAppeals(signal).then((result) => setAppeals(result.appeals), (cause) => {
    if ((cause as { name?: string }).name !== "AbortError") setAlert({ message: botCupErrorMessage(cause), tone: "error" });
  }), [gateway]);

  useEffect(() => {
    const controller = new AbortController();
    void refresh(controller.signal);
    return () => controller.abort();
  }, [refresh]);

  useEffect(() => {
    if (stages.length && !stages.includes(stage)) setStage(stages[stages.length - 1]);
  }, [stages, stage]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setAlert(null);
    try {
      await gateway.createAppeal(stage, text.trim(), matchId.trim() || undefined);
      setText("");
      setMatchId("");
      setAlert({ message: "Đã gửi khiếu nại. BTC sẽ trả lời tại đây.", tone: "success" });
      await refresh();
    } catch (cause) {
      setAlert({ message: botCupErrorMessage(cause), tone: "error" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Panel heading="Khiếu nại" className={styles.submissionsCard}>
      <p className={styles.hint}>
        Chỉ đội có bài niêm phong được gửi, trong thời hạn sau khi công bố kết quả giai đoạn đó, tối đa 3 khiếu nại mỗi giai đoạn.
        Ghi rõ mã trận (nếu có) và điều bạn cho là sai.
      </p>
      {stages.length ? (
        <form className={styles.appealForm} onSubmit={submit} aria-label="Gửi khiếu nại">
          <label className={styles.fileField}>
            <span>Giai đoạn</span>
            <select value={stage} onChange={(event) => setStage(event.currentTarget.value as AppealStage)}>
              {stages.map((item) => <option key={item} value={item}>{RESULT_STAGE_LABELS[item]}</option>)}
            </select>
          </label>
          <label className={styles.fileField}>
            <span>Mã trận (không bắt buộc)</span>
            <input value={matchId} maxLength={64} onChange={(event) => setMatchId(event.currentTarget.value)} />
          </label>
          <label className={styles.appealText}>
            <span>Nội dung (10–2000 ký tự)</span>
            <textarea value={text} rows={4} minLength={10} maxLength={2000} required onChange={(event) => setText(event.currentTarget.value)} />
          </label>
          <Button type="submit" disabled={busy || text.trim().length < 10}>{busy ? "Đang gửi…" : "Gửi khiếu nại"}</Button>
        </form>
      ) : <p className={styles.hint}>Chưa có kết quả nào để khiếu nại.</p>}
      <FormAlert message={alert?.message ?? null} tone={alert?.tone} />
      {appeals && appeals.length ? (
        <ol className={styles.submissionList} aria-label="Khiếu nại của đội">
          {appeals.map((item) => (
            <li key={item.id} className={styles.submission}>
              <p className={styles.hint}>
                {RESULT_STAGE_LABELS[item.stage]} · {formatDateTime(item.createdAt)}{item.matchId ? ` · trận ${item.matchId}` : ""}{" "}
                <Badge status={item.status === "answered" ? "success" : "warning"}>{item.status === "answered" ? "Đã trả lời" : "Chờ BTC"}</Badge>
              </p>
              <p className={styles.announcementBody}>{item.body}</p>
              {item.response ? <p className={styles.announcementBody}><strong>BTC:</strong> {item.response}</p> : null}
            </li>
          ))}
        </ol>
      ) : null}
    </Panel>
  );
}
