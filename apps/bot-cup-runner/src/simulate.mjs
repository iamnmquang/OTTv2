/**
 * Simulated executor for showcase events (plan 2026-10-26-bot-cup-admin-showcase §3.5): plays every game in this process
 * with the in-game AI instead of running team code in containers, so a 100-team event plays out in minutes. The games are
 * still real: the Arena match controller referees them under bot-cup-policy-v1 and the Worker replays each one with the
 * rules before it counts.
 *
 * A synthetic team's source carries its strength (`ott-showcase strength=0.73`, written by scripts/bot-cup/showcase.mjs):
 * the share of moves the bot plays well. The rest are random legal moves. Never point this at a real event: team code is
 * not run at all.
 */
import { createRequire } from "node:module";

import { compactReplay } from "../../../packages/bot-cup-core/src/index.mjs";
import { createHeadlessMatchController } from "../../../packages/arena/src/application/match-controller.mjs";
import { createCurrentRulesetSnapshot } from "../../../packages/arena/src/contracts/index.mjs";
import { createFunctionBot } from "../../../packages/arena/src/adapters/function-bot.mjs";
import { createMapState } from "../../../packages/arena/src/domain/maps/index.mjs";
import { coreConfig, createNodeEngine, createNodeEngineForSize } from "../../../packages/arena-node/src/core/node-engine.mjs";
import { computeRulesetHash } from "../../../packages/arena-node/src/core/ruleset-identity.mjs";
import { InfrastructureError } from "./executor.mjs";

const require = createRequire(import.meta.url);
const ai = require("../../../packages/game-core/src/ai.js");

const STRENGTH_PATTERN = /ott-showcase strength=(0(?:\.\d+)?|1(?:\.0+)?)/;
// Simulated thinking time per move on the game clock (no real waiting): well inside the move limit and the bank.
const THINK_MS = 40;
const NO_JOURNAL = Object.freeze({ init() {}, acceptedMove() {}, technicalEvent() {}, finish() {} });

/** Strength 0..1 from a showcase source, or null when the source is not a showcase bot. */
export function parseStrength(text) {
  const match = STRENGTH_PATTERN.exec(String(text));
  return match ? Number(match[1]) : null;
}

const stateFromTurn = (turn) => ({
  pieces: turn.board.map((piece) => ({ id: piece.id, player: piece.owner, type: piece.type, x: piece.x, y: piece.y })),
  turn: turn.turn,
  winner: null
});

/**
 * A move chooser. House bots play their level every move; a showcase team plays the medium AI on `strength` of its moves
 * and a random legal move otherwise. Measured against the easy house bot (the gate): about 0.25 points a game at 0.5,
 * 0.67 at 0.7, 0.83 at 0.8. Medium only: hard takes ~2 s a game, too slow for ~1,400 games.
 * @param {{ house?: string, strength?: number }} profile
 */
export function chooserFor(profile, random = Math.random) {
  if (profile.house === "first-legal") return (turn) => turn.legalMoves[0];
  const level = profile.house && ["easy", "medium", "hard"].includes(profile.house) ? profile.house : "medium";
  const skill = profile.house ? 1 : profile.strength;
  return (turn) => {
    if (random() >= skill) return turn.legalMoves[Math.floor(random() * turn.legalMoves.length)];
    const chosen = ai.chooseMove(stateFromTurn(turn), turn.turn, { level });
    return chosen ? { from: chosen.from, to: chosen.to } : turn.legalMoves[0];
  };
}

/** One game between two choosers on a simulated clock; returns the compact replay the Worker checks. `boardSize` is the a of an a x a board (default 9). */
export async function playSimulatedGame({ matchId, mapId, policy, chooseA, chooseB, boardSize = 9 }) {
  let now = 0;
  const clock = { nowMs: () => now, schedule: () => 0, cancel() {} };
  const bot = (botId, choose) => createFunctionBot({
    botId,
    chooseFn(turn) {
      now += THINK_MS;
      return choose(turn);
    }
  });
  const moves = [];
  const snapshot = createCurrentRulesetSnapshot(boardSize === 9 ? coreConfig : coreConfig.createConfig(boardSize));
  const result = await createHeadlessMatchController({
    matchId,
    engine: boardSize === 9 ? createNodeEngine() : createNodeEngineForSize(boardSize),
    botA: bot(`${matchId.slice(0, 8)}-A`, chooseA),
    botB: bot(`${matchId.slice(0, 8)}-B`, chooseB),
    clock,
    journal: NO_JOURNAL,
    policy,
    rulesetSnapshot: snapshot,
    rulesetHash: computeRulesetHash(snapshot),
    engineRevision: "bot-cup-runner-simulated",
    initialState: createMapState(mapId, 1, boardSize),
    onAcceptedMove: (event) => moves.push({ seat: event.seat, from: event.move.from, to: event.move.to, elapsedMs: event.frame.elapsedMs })
  }).run();
  if (result.kind === "infrastructure_error") throw new InfrastructureError(`match ${result.code}`);
  return compactReplay({ mapId, moves, result, boardSize });
}

/**
 * Same interface as the container executor (runCheck, runMatch, runProbe).
 * @param {{ fetchSource: (sha256: string) => Promise<Uint8Array>, random?: () => number }} options
 */
export function createSimulatedExecutor({ fetchSource, random = Math.random }) {
  const strengths = new Map();

  async function strengthOf(sha256) {
    if (!strengths.has(sha256)) {
      const strength = parseStrength(new TextDecoder().decode(await fetchSource(sha256)));
      // A real team's bot reached a simulated runner: refuse rather than invent a result for it.
      if (strength === null) throw new InfrastructureError(`submission ${sha256.slice(0, 12)} is not a showcase bot`);
      strengths.set(sha256, strength);
    }
    return strengths.get(sha256);
  }

  const profileOf = async (seat) => (seat.house ? { house: seat.house } : { strength: await strengthOf(seat.submission.sha256) });

  return {
    async runCheck(job) {
      await strengthOf(job.submission.sha256);
      return { ok: true, log: "Kiểm tra (giả lập): đạt." };
    },
    async runMatch(job) {
      const [a, b] = await Promise.all([profileOf(job.match.seats.A), profileOf(job.match.seats.B)]);
      const replay = await playSimulatedGame({
        matchId: job.match.id,
        mapId: job.match.mapId,
        policy: job.match.policy,
        chooseA: chooserFor(a, random),
        chooseB: chooserFor(b, random)
      });
      return { replay, stderr: { A: "", B: "" } };
    },
    async runProbe() {
      throw new InfrastructureError("behaviour probes are not simulated");
    }
  };
}
