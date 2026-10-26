import { useMemo, useState, type ReactNode } from "react";
import type { KnockoutGame, QualifyingRound } from "../BotCupApiGateway";
import { MAP_LABELS } from "../matchFormat";
import { PairingGames } from "./PairingGames";
import { score } from "./bracketFormat";
import styles from "./bracket.module.css";

const key = (text: string) => text.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/gi, "d").toLowerCase();

/**
 * Qualifying pairings round by round (plan 2026-10-26 §3.3): one round at a time, the latest by default, a filter by team
 * name, and each pairing opening its games and replays.
 */
export function SwissRounds({ rounds, format, onOpenReplay, gameActions }: {
  readonly rounds: readonly QualifyingRound[];
  readonly format: "round_robin" | "swiss";
  readonly onOpenReplay?: (matchId: string) => void;
  readonly gameActions?: (game: KnockoutGame) => ReactNode;
}) {
  const [picked, setPicked] = useState<number | null>(null);
  const [filter, setFilter] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const latest = rounds.length ? rounds[rounds.length - 1].round : null;
  // Follow the newest round as it appears, unless the viewer picked one.
  const shown = picked !== null && rounds.some((round) => round.round === picked) ? picked : latest;

  const round = rounds.find((item) => item.round === shown) ?? null;
  const needle = key(filter.trim());
  const pairings = useMemo(() => (round?.pairings ?? []).filter((pairing) =>
    !needle || [pairing.red, pairing.blue, pairing.bye].some((name) => name && key(name).includes(needle))), [round, needle]);

  if (!rounds.length) return <p className={styles.empty}>Vòng loại chưa bắt đầu.</p>;
  const finished = (item: QualifyingRound) => item.pairings.every((pairing) => pairing.bye || pairing.played === pairing.total);

  return (
    <div className={styles.rounds}>
      <div className={styles.roundTabs} role="group" aria-label="Chọn vòng">
        {rounds.map((item) => (
          <button key={item.round} type="button" className={styles.roundTab} aria-pressed={item.round === shown}
            onClick={() => { setPicked(item.round); setOpen(null); }}>
            Vòng {item.round}{finished(item) ? "" : " · đang đấu"}
          </button>
        ))}
      </div>
      <div className={styles.roundBar}>
        <p className={styles.empty}>
          {round ? `Vòng ${round.round}` : ""}{round?.mapId ? ` · bản đồ ${MAP_LABELS[round.mapId] ?? round.mapId}` : format === "round_robin" ? " · 3 bản đồ × 2 màu" : ""}
          {round ? ` · ${round.pairings.filter((pairing) => !pairing.bye).length} cặp` : ""}
        </p>
        <label className={styles.filter}>
          <span>Tìm đội</span>
          <input type="search" value={filter} onChange={(event) => setFilter(event.currentTarget.value)} placeholder="Tên đội" />
        </label>
      </div>
      {pairings.length === 0 ? <p className={styles.empty}>Không có cặp nào khớp.</p> : (
        <ul className={styles.pairings} aria-label={round ? `Các cặp vòng ${round.round}` : undefined}>
          {pairings.map((pairing, index) => {
            if (pairing.bye) {
              return <li key={`bye-${pairing.bye}`} className={styles.pairing} data-bye="true"><span className={styles.name}>{pairing.bye}</span><span className={styles.empty}>được nghỉ (bye, 2 điểm)</span></li>;
            }
            const id = `${round?.round}-${index}-${pairing.red}`;
            const [a, b] = pairing.points ?? [0, 0];
            const done = pairing.played === pairing.total;
            return (
              <li key={id} className={styles.pairing}>
                <button type="button" className={styles.pairingHead} aria-expanded={open === id} onClick={() => setOpen(open === id ? null : id)}
                  aria-label={`${pairing.red} ${score(a)} – ${score(b)} ${pairing.blue}${done ? "" : `, đã đấu ${pairing.played}/${pairing.total} ván`}`}>
                  <span className={styles.side} data-won={(done && a > b) || undefined}><span className={styles.name}>{pairing.red}</span></span>
                  <span className={styles.scoreline}>{score(a)} – {score(b)}</span>
                  <span className={styles.side} data-won={(done && b > a) || undefined}><span className={styles.name}>{pairing.blue}</span></span>
                  <span className={styles.progress}>{done ? "xong" : `${pairing.played}/${pairing.total}`}</span>
                </button>
                {open === id ? <PairingGames red={pairing.red ?? ""} blue={pairing.blue ?? ""} games={pairing.games} onOpenReplay={onOpenReplay} actions={gameActions} /> : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
