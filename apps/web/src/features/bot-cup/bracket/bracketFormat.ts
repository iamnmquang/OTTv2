import type { BracketRoundName, KnockoutGame } from "../BotCupApiGateway";
import { MAP_LABELS, reasonLabel } from "../matchFormat";

export const ROUND_LABELS: Readonly<Record<BracketRoundName, string>> = {
  R16: "Vòng 1/8",
  QF: "Tứ kết",
  SF: "Bán kết",
  F: "Chung kết",
};

export const SLOT_LABELS: Readonly<Record<string, string>> = { F: "Chung kết", "3RD": "Tranh hạng ba" };

/** "R16-3" → "Vòng 1/8 · cặp 3", "QF2" → "Tứ kết 2", "F" → "Chung kết". */
export function slotLabel(slot: string): string {
  if (SLOT_LABELS[slot]) return SLOT_LABELS[slot];
  const match = /^(R16-|QF|SF)(\d+)$/.exec(slot);
  if (!match) return slot;
  return match[1] === "R16-" ? `Vòng 1/8 · cặp ${match[2]}` : `${ROUND_LABELS[match[1] as BracketRoundName]} ${match[2]}`;
}

export const score = (points: number) => (Number.isInteger(points) ? String(points) : points.toFixed(1).replace(".", ","));

/** One line about a game, from the pairing's point of view: map, who held Red, result. */
export function gameLine(red: string, blue: string, game: KnockoutGame): string {
  const holdsRed = game.red === "a" ? red : blue;
  const holdsBlue = game.red === "a" ? blue : red;
  const head = `Ván ${game.gameIndex + 1} · ${MAP_LABELS[game.mapId] ?? game.mapId} · Đỏ ${holdsRed}`;
  if (game.status === "queued" || game.status === "running") return `${head} · đang chờ`;
  if (game.status !== "finished") return `${head} · BTC sẽ chạy lại`;
  if (game.outcome === "draw") return `${head} · hòa (${reasonLabel(game.reason)})`;
  return `${head} · ${game.winner === "A" ? holdsRed : holdsBlue} thắng (${reasonLabel(game.reason)})`;
}
