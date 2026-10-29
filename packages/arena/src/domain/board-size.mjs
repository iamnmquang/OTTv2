/**
 * Board size helpers for the a x a variants of ruleset G.
 * Pure ES module, no imports. Mirrors `createConfig(size)` in packages/game-core/src/config.js
 * (tests/arena-board-size.test.js fails if the two ever disagree).
 *
 * Rules of the family:
 * - Size is an integer in [MIN_BOARD_SIZE, MAX_BOARD_SIZE]; 9 is the original game (ruleset "ottv2-g-default-v1").
 * - Goals sit in opposite corners: A at (0, 0), B at (size - 1, size - 1).
 * - Each seat keeps its 9x9 opening formation anchored to its own corner: Seat A's cells are shifted by (size - 9)
 *   on both axes; Seat B is always the 180-degree rotation of Seat A.
 */

export const DEFAULT_BOARD_SIZE = 9;
export const MIN_BOARD_SIZE = 9;
export const MAX_BOARD_SIZE = 25;

const ALL_FILES = "abcdefghijklmnopqrstuvwxy";

export function isValidBoardSize(size) {
  return Number.isInteger(size) && size >= MIN_BOARD_SIZE && size <= MAX_BOARD_SIZE;
}

/** Throws RangeError unless `size` is a supported board size; returns it for chaining. */
export function assertBoardSize(size) {
  if (!isValidBoardSize(size)) {
    throw new RangeError(`Board size must be an integer from ${MIN_BOARD_SIZE} to ${MAX_BOARD_SIZE}, received ${size}`);
  }
  return size;
}

/** Column letters of an a x a board: "abcdefghi" for 9. */
export function filesForSize(size) {
  return ALL_FILES.slice(0, assertBoardSize(size));
}

/** Goal cells: A at (0, 0), B at the opposite corner. */
export function goalsForSize(size) {
  assertBoardSize(size);
  return { A: { x: 0, y: 0 }, B: { x: size - 1, y: size - 1 } };
}

/** Shifts a 9x9 Seat A setup (list of {type, x, y}) to an a x a board. Returns a new array. */
export function shiftSetupToSize(setupA, size) {
  const shift = assertBoardSize(size) - DEFAULT_BOARD_SIZE;
  return setupA.map((spot) => ({ type: spot.type, x: spot.x + shift, y: spot.y + shift }));
}

const CANONICAL_A_SETUP_9 = Object.freeze([
  { type: "la", x: 4, y: 7 },
  { type: "dam", x: 5, y: 7 },
  { type: "keo", x: 4, y: 6 },
  { type: "la", x: 5, y: 6 },
  { type: "dam", x: 6, y: 6 },
  { type: "keo", x: 5, y: 5 },
  { type: "la", x: 6, y: 5 },
  { type: "dam", x: 7, y: 5 },
  { type: "keo", x: 6, y: 4 },
  { type: "la", x: 7, y: 4 }
]);

/** The canonical 10-piece Seat A setup for an a x a board. */
export function canonicalSetupForSize(size) {
  return shiftSetupToSize(CANONICAL_A_SETUP_9, size);
}
