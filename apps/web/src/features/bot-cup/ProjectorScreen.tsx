import { useCallback, useEffect, useMemo, useState } from "react";
import { Board } from "../game/Board";
import { ReplayControls } from "../replay/ReplayControls";
import { useReplayShortcuts, isEditableElement } from "../replay/useReplayShortcuts";
import { ReplaySession, INITIAL_PLAYBACK_VIEW } from "../../sessions/replay/ReplaySession";
import { useSessionSnapshot } from "../../sessions/useSessionSnapshot";
import type { ReplayPlaybackView, ReplaySpeed } from "../../sessions/contract";
import type { ReplayDocument } from "../../../../../packages/arena/src/contracts/index.d.mts";
import { validateReplayDocument } from "../../../../../packages/arena/src/contracts/index.mjs";
import type { BotCupApiGateway, KnockoutGame, KnockoutPairing, TournamentView } from "./BotCupApiGateway";
import { botCupErrorMessage } from "./botCupMessages";
import { MAP_LABELS, reasonLabel } from "./matchFormat";
import { KnockoutTree } from "./bracket/KnockoutTree";
import { slotLabel } from "./bracket/bracketFormat";
import { TOURNAMENT_REFRESH_MS } from "./TournamentPanel";
import { PROJECTOR_BODY_ATTRIBUTE } from "../../shared/demo-nav/DemoNav";
import styles from "./projector.module.css";

const SPEEDS: readonly ReplaySpeed[] = [0.5, 1, 2, 4];
const score = (points: number) => (Number.isInteger(points) ? String(points) : points.toFixed(1).replace(".", ","));

/** Teams of a game in colour order: who held Red, who held Blue. */
function colours(pairing: KnockoutPairing, game: KnockoutGame): { readonly red: string; readonly blue: string } {
  return game.red === "a" ? { red: pairing.red, blue: pairing.blue } : { red: pairing.blue, blue: pairing.red };
}

function gameResult(pairing: KnockoutPairing, game: KnockoutGame): string {
  if (game.status !== "finished") return "chưa đấu";
  if (game.outcome === "draw") return "hòa";
  const { red, blue } = colours(pairing, game);
  return `${game.winner === "A" ? red : blue} thắng · ${reasonLabel(game.reason)}`;
}

/**
 * Finals projector (plan §11.5): `?view=bot-cup&screen=projector`. A large board replaying one knockout game at a time,
 * the two teams and the pairing score, and keyboard control for the MC. Replays come from the API, which rebuilt them
 * with the real rules; the viewer is the app's replay session.
 */
export function ProjectorScreen({ gateway, onExit }: { readonly gateway: BotCupApiGateway; readonly onExit: () => void }) {
  const [view, setView] = useState<TournamentView | null>(null);
  const [error, setError] = useState<string | null>(null);
  // The shown pairing by slot ("SF1", "F"…), so a refresh that adds a round keeps the same pairing on screen.
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [gameIndex, setGameIndex] = useState(0);
  const [session, setSession] = useState<ReplaySession | null>(null);
  const [playback, setPlayback] = useState<ReplayPlaybackView>(INITIAL_PLAYBACK_VIEW);
  const [loading, setLoading] = useState(false);
  const [showBracket, setShowBracket] = useState(false);
  const snapshot = useSessionSnapshot(session);

  // The demo page switcher hides its floating button on the projector.
  useEffect(() => {
    document.body.setAttribute(PROJECTOR_BODY_ATTRIBUTE, "");
    return () => document.body.removeAttribute(PROJECTOR_BODY_ATTRIBUTE);
  }, []);

  const load = useCallback(async () => {
    try {
      setView(await gateway.getTournament());
      setError(null);
    } catch (cause) {
      setError(botCupErrorMessage(cause));
    }
  }, [gateway]);

  // Same refresh as the public results page, so a projector opened early picks up new rounds without R.
  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), TOURNAMENT_REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [load]);

  const pairings = useMemo(() => view?.knockout.filter((pairing) => pairing.games.length > 0) ?? [], [view]);
  // Start on the final once it exists, otherwise on the latest round's first pairing that has games to show.
  useEffect(() => {
    if (selectedSlot !== null || pairings.length === 0) return;
    const lastRound = Math.max(...pairings.map((pairing) => pairing.round));
    setSelectedSlot((pairings.find((pairing) => pairing.slot === "F") ?? pairings.find((pairing) => pairing.round === lastRound))?.slot ?? null);
  }, [pairings, selectedSlot]);
  const pairingIndex = pairings.findIndex((pairing) => pairing.slot === selectedSlot);
  const pairing = pairingIndex >= 0 ? pairings[pairingIndex] : null;
  const game = pairing?.games[gameIndex] ?? null;

  // One replay session per shown game; the previous one is disposed.
  useEffect(() => {
    if (!game || game.status !== "finished") {
      setSession(null);
      return;
    }
    let cancelled = false;
    let created: ReplaySession | null = null;
    setLoading(true);
    gateway.getMatchReplay(game.id).then(async ({ replay }) => {
      if (cancelled) return;
      if (!validateReplayDocument(replay).ok) {
        setError("Replay của ván này không hợp lệ.");
        return;
      }
      created = new ReplaySession();
      await created.start({ mode: "replay", document: replay as ReplayDocument });
      if (cancelled) {
        void created.dispose();
        return;
      }
      setSession(created);
      setError(null);
    }, (cause) => {
      if (!cancelled) setError(botCupErrorMessage(cause));
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
      if (created) void created.dispose();
    };
  }, [gateway, game?.id, game?.status]);

  useEffect(() => {
    if (!session) {
      setPlayback(INITIAL_PLAYBACK_VIEW);
      return;
    }
    setPlayback(session.getPlayback());
    return session.subscribe(() => setPlayback(session.getPlayback()));
  }, [session]);

  const changeSpeed = useCallback((direction: 1 | -1) => {
    if (!session) return;
    const index = SPEEDS.indexOf(session.getPlayback().speed);
    const next = SPEEDS[Math.min(SPEEDS.length - 1, Math.max(0, index + direction))];
    session.setSpeed(next);
  }, [session]);

  const moveGame = useCallback((direction: 1 | -1) => {
    if (!pairing) return;
    setGameIndex((current) => Math.min(pairing.games.length - 1, Math.max(0, current + direction)));
  }, [pairing]);

  const movePairing = useCallback((direction: 1 | -1) => {
    if (pairings.length === 0) return;
    setSelectedSlot(pairings[(Math.max(pairingIndex, 0) + direction + pairings.length) % pairings.length].slot);
    setGameIndex(0);
  }, [pairings, pairingIndex]);

  useReplayShortcuts({
    enabled: session !== null,
    onStepPrev: () => session?.step("prev"),
    onStepNext: () => session?.step("next"),
    onTogglePlay: () => (session?.getPlayback().isPlaying ? session.pause() : session?.play()),
    onSeekStart: () => session?.seek(0),
    onSeekEnd: () => session?.seek(session.getPlayback().maxCursor)
  });

  // The MC's keys on top of the replay shortcuts: speed, next/previous game and pairing, reload.
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (isEditableElement(event.target) || event.ctrlKey || event.altKey || event.metaKey) return;
      const actions: Record<string, () => void> = {
        "+": () => changeSpeed(1), "=": () => changeSpeed(1), "-": () => changeSpeed(-1),
        n: () => moveGame(1), N: () => moveGame(1), p: () => moveGame(-1), P: () => moveGame(-1),
        "]": () => movePairing(1), "[": () => movePairing(-1),
        r: () => void load(), R: () => void load(),
        b: () => setShowBracket((open) => !open), B: () => setShowBracket((open) => !open)
      };
      const action = actions[event.key];
      if (!action) return;
      event.preventDefault();
      action();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [changeSpeed, moveGame, movePairing, load]);

  const fullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen?.().catch(() => undefined);
  };

  const lastMove = playback.lastMove;
  const teams = pairing && game ? colours(pairing, game) : null;

  return (
    <section className={styles.stage} aria-label="Trình chiếu chung kết OTT Bot Cup">
      <header className={styles.top}>
        <div>
          <p className={styles.kicker}>OTT Bot Cup · Trình chiếu</p>
          <h1 className={styles.title}>{showBracket ? "Nhánh loại trực tiếp" : pairing ? slotLabel(pairing.slot) : "Chưa có cặp loại trực tiếp"}</h1>
        </div>
        <div className={styles.actions}>
          <button type="button" aria-pressed={showBracket} onClick={() => setShowBracket((open) => !open)}>Nhánh đấu</button>
          <button type="button" onClick={fullscreen}>Toàn màn hình</button>
          <button type="button" onClick={onExit}>Thoát</button>
        </div>
      </header>

      {error ? <p className={styles.error} role="alert">{error}</p> : null}

      {showBracket && view ? (
        <div className={styles.bracket}>
          <KnockoutTree bracket={view.bracket} large selected={pairing?.slot ?? null} onSelect={(slot) => {
            if (pairings.some((item) => item.slot === slot)) {
              setSelectedSlot(slot);
              setGameIndex(0);
            }
            setShowBracket(false);
          }} />
        </div>
      ) : null}

      {showBracket ? null : pairing ? (
        <div className={styles.scoreboard} aria-label="Tỉ số cặp đấu">
          <span className={styles.team}>{pairing.red} <small>hạt giống {pairing.seeds[0]}</small></span>
          <span className={styles.score}>{score(pairing.points[0])} – {score(pairing.points[1])}</span>
          <span className={styles.team}>{pairing.blue} <small>hạt giống {pairing.seeds[1]}</small></span>
        </div>
      ) : view ? (
        <p className={styles.hint}>Giai đoạn hiện tại chưa có ván loại trực tiếp. Nhấn R để tải lại.</p>
      ) : (
        <p className={styles.hint} role="status">Đang tải…</p>
      )}

      {pairing && !showBracket ? (
        <div className={styles.body}>
          <div className={styles.boardArea}>
            {game && teams ? (
              <p className={styles.gameLine}>
                Ván {game.gameIndex + 1} · {MAP_LABELS[game.mapId] ?? game.mapId} ·{" "}
                <span className={styles.red}>Đỏ: {teams.red}</span> · <span className={styles.blue}>Xanh: {teams.blue}</span>
              </p>
            ) : null}
            {session ? (
              <>
                <div className={styles.board}>
                  <Board session={session} snapshot={snapshot} highlightMove={lastMove ? { from: lastMove.from, to: lastMove.to } : null} />
                </div>
                <ReplayControls
                  playback={playback}
                  onSeek={(cursor) => session.seek(cursor)}
                  onPlay={() => session.play()}
                  onPause={() => session.pause()}
                  onStep={(direction) => session.step(direction)}
                  onSetSpeed={(speed) => session.setSpeed(speed)}
                  canFork={false}
                />
                {playback.isAtEnd && game ? <p className={styles.result} role="status">{gameResult(pairing, game)}</p> : null}
              </>
            ) : (
              <p className={styles.hint}>{loading ? "Đang tải replay…" : game?.status === "finished" ? "" : "Ván này chưa đấu xong."}</p>
            )}
          </div>
          <aside className={styles.games} aria-label="Các ván của cặp">
            <ol>
              {pairing.games.map((item, index) => (
                <li key={item.id} aria-current={index === gameIndex ? "true" : undefined}>
                  <button type="button" onClick={() => setGameIndex(index)}>
                    Ván {item.gameIndex + 1} · {MAP_LABELS[item.mapId] ?? item.mapId}
                    <span>{gameResult(pairing, item)}</span>
                  </button>
                </li>
              ))}
            </ol>
            {pairing.winner ? <p className={styles.winner}>{pairing.winner} đi tiếp{pairing.decidedBySeed ? " (hạt giống cao hơn)" : ""}</p> : null}
          </aside>
        </div>
      ) : null}

      <footer className={styles.keys}>
        Space phát/dừng · ←/→ từng nước · Home/End đầu/cuối · +/− tốc độ ({playback.speed}×) · N/P ván kế/trước · ]/[ cặp kế/trước · B nhánh đấu · R tải lại
      </footer>
    </section>
  );
}
