import type { BracketView, KnockoutPairing } from "../BotCupApiGateway";
import { ROUND_LABELS, score, slotLabel } from "./bracketFormat";
import styles from "./bracket.module.css";

function pairingName(slot: string, pairing: KnockoutPairing): string {
  const result = pairing.winner ? `, ${pairing.winner} đi tiếp` : pairing.games.some((game) => game.status === "finished") ? ", đang đấu" : "";
  return `${slotLabel(slot)}: ${pairing.red} (hạt giống ${pairing.seeds[0]}) ${score(pairing.points[0])} – ${score(pairing.points[1])} ${pairing.blue} (hạt giống ${pairing.seeds[1]})${result}`;
}

function Side({ name, seed, points, won, lost }: { readonly name: string; readonly seed: number; readonly points: number; readonly won: boolean; readonly lost: boolean }) {
  return (
    <span className={styles.side} data-won={won || undefined} data-lost={lost || undefined}>
      <span className={styles.seed}>{seed}</span>
      <span className={styles.name}>{name}</span>
      <span className={styles.points}>{score(points)}</span>
    </span>
  );
}

/**
 * The knockout tree (plan 2026-10-26 §3.3): every round as a column, every slot drawn before it is played, connectors
 * between rounds, the winner of each pairing highlighted. A narrow screen stacks the rounds.
 */
export function KnockoutTree({ bracket, selected, onSelect, large = false }: {
  readonly bracket: BracketView;
  readonly selected?: string | null;
  readonly onSelect?: (slot: string, pairing: KnockoutPairing) => void;
  readonly large?: boolean;
}) {
  if (bracket.size === 0) return <p className={styles.empty}>Chưa đủ đội để có vòng loại trực tiếp.</p>;
  return (
    <div className={styles.treeScroll}>
      <ol className={styles.tree} data-large={large || undefined} aria-label={`Nhánh loại trực tiếp ${bracket.size} đội`}>
        {bracket.rounds.map((round, roundIndex) => (
          <li key={round.name} className={styles.round} data-last={roundIndex === bracket.rounds.length - 1 || undefined}>
            <h3 className={styles.roundTitle}>{ROUND_LABELS[round.name]}</h3>
            <ol className={styles.slots}>
              {round.slots.map(({ slot, pairing }) => {
                const extra = slot === "3RD";
                if (!pairing) {
                  return (
                    <li key={slot} className={styles.slot} data-extra={extra || undefined}>
                      <div className={styles.match} data-empty="true" aria-label={`${slotLabel(slot)}: chưa xác định`}>
                        {extra ? <span className={styles.slotTag}>{slotLabel(slot)}</span> : null}
                        <span className={styles.side}><span className={styles.name}>Chờ đội</span></span>
                        <span className={styles.side}><span className={styles.name}>Chờ đội</span></span>
                      </div>
                    </li>
                  );
                }
                const redWon = pairing.winner === pairing.red;
                const blueWon = pairing.winner === pairing.blue;
                const body = (
                  <>
                    {extra ? <span className={styles.slotTag}>{slotLabel(slot)}</span> : null}
                    <Side name={pairing.red} seed={pairing.seeds[0]} points={pairing.points[0]} won={redWon} lost={blueWon} />
                    <Side name={pairing.blue} seed={pairing.seeds[1]} points={pairing.points[1]} won={blueWon} lost={redWon} />
                    {pairing.tiebreaks ? <span className={styles.slotTag}>{pairing.tiebreaks} lượt tie-break{pairing.decidedBySeed ? " · hạt giống" : ""}</span> : null}
                  </>
                );
                return (
                  <li key={slot} className={styles.slot} data-extra={extra || undefined}>
                    {onSelect ? (
                      <button type="button" className={styles.match} aria-label={pairingName(slot, pairing)} aria-pressed={selected === slot}
                        onClick={() => onSelect(slot, pairing)}>
                        {body}
                      </button>
                    ) : (
                      <div className={styles.match} role="group" aria-label={pairingName(slot, pairing)}>{body}</div>
                    )}
                  </li>
                );
              })}
            </ol>
          </li>
        ))}
      </ol>
    </div>
  );
}
