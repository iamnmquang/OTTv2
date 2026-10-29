/**
 * Arena Versioned Map Registry.
 * Pure ES module. Zero Node.js imports. Standard Web API.
 * Owns map descriptors, safe starting positions, and state factories.
 */

import {
  BOARD_SIZE,
  GOALS,
  EXPECTED_TYPE_COUNTS,
  MOVEMENT_DELTAS,
  BEATS,
  CLASSIC_SETUP_A,
  FLANKS_SETUP_A,
  CENTER_SETUP_A,
  MAP_DEFINITIONS,
  cloneDeep,
  createFreshCoreState
} from "./definitions.mjs";
import { assertBoardSize, goalsForSize, shiftSetupToSize } from "../board-size.mjs";

export {
  BOARD_SIZE,
  GOALS,
  EXPECTED_TYPE_COUNTS,
  MOVEMENT_DELTAS,
  BEATS,
  CLASSIC_SETUP_A,
  FLANKS_SETUP_A,
  CENTER_SETUP_A,
  MAP_DEFINITIONS
};

/**
 * Pure helper to compute legal moves for a given seat under invariant core rules.
 * @param {Array<{id: string, player: "A"|"B", type: string, x: number, y: number}>} pieces
 * @param {"A"|"B"} seat
 * @param {number} [size=9] board size
 * @returns {Array<{from: {x: number, y: number}, to: {x: number, y: number}}>}
 */
export function computePureLegalMoves(pieces, seat, size = BOARD_SIZE) {
  const moves = [];
  const seatPieces = pieces.filter((p) => p.player === seat);

  for (const piece of seatPieces) {
    for (const [dx, dy] of MOVEMENT_DELTAS) {
      const tx = piece.x + dx;
      const ty = piece.y + dy;

      if (tx < 0 || tx >= size || ty < 0 || ty >= size) {
        continue;
      }

      const occupants = pieces.filter((p) => p.x === tx && p.y === ty);
      if (occupants.length === 0) {
        moves.push({ from: { x: piece.x, y: piece.y }, to: { x: tx, y: ty } });
      } else if (occupants.length === 1) {
        const target = occupants[0];
        if (target.player !== seat && target.type !== piece.type) {
          if (BEATS[piece.type] === target.type) {
            moves.push({ from: { x: piece.x, y: piece.y }, to: { x: tx, y: ty } });
          }
        }
      }
    }
  }

  return moves;
}

/**
 * Validates a Seat A setup array before state creation.
 * Checks 10 pieces, 3-4-3 type inventory, bounds, single occupancy,
 * 180° rotation disjointness, and Chebyshev distance > 1 from Seat A goal (0, 0).
 * @param {unknown} setupA
 * @param {number} [size=9] board size (the setup is given in the coordinates of that board)
 * @returns {{ ok: boolean, errors: string[] }}
 */
export function validateMapSetup(setupA, size = BOARD_SIZE) {
  const errors = [];
  const goals = goalsForSize(size);
  const last = size - 1;

  if (!Array.isArray(setupA)) {
    return { ok: false, errors: ["setupA must be an array of pieces"] };
  }

  if (setupA.length !== 10) {
    errors.push(`setupA must contain exactly 10 pieces, got ${setupA.length}`);
  }

  const counts = { dam: 0, la: 0, keo: 0 };
  const seenACoords = new Set();
  const seenAllCoords = new Set();

  setupA.forEach((spot, idx) => {
    const prefix = `piece[${idx}]`;
    if (!spot || typeof spot !== "object") {
      errors.push(`${prefix}: piece must be a non-null object`);
      return;
    }

    if (!EXPECTED_TYPE_COUNTS[spot.type]) {
      errors.push(`${prefix}: invalid piece type '${spot.type}', expected dam, la, or keo`);
    } else {
      counts[spot.type] += 1;
    }

    if (!Number.isInteger(spot.x) || !Number.isInteger(spot.y) || spot.x < 0 || spot.x >= size || spot.y < 0 || spot.y >= size) {
      errors.push(`${prefix}: coordinate (${spot.x}, ${spot.y}) out of board bounds [0..${last}]`);
      return;
    }

    const keyA = `${spot.x},${spot.y}`;
    if (seenACoords.has(keyA)) {
      errors.push(`${prefix}: duplicate Seat A piece at (${spot.x}, ${spot.y})`);
    }
    seenACoords.add(keyA);
    seenAllCoords.add(keyA);

    // Goal checks for Seat A: goal is (0, 0)
    if (spot.x === goals.A.x && spot.y === goals.A.y) {
      errors.push(`${prefix}: Seat A piece cannot start on own goal (0, 0)`);
    }

    const distToOwnGoal = Math.max(Math.abs(spot.x - goals.A.x), Math.abs(spot.y - goals.A.y));
    if (distToOwnGoal <= 1) {
      errors.push(`${prefix}: Seat A piece at (${spot.x}, ${spot.y}) is within 1 step of own goal (0, 0)`);
    }

    // Mirror piece B checks: B is at (size - 1 - x, size - 1 - y)
    const bx = size - 1 - spot.x;
    const by = size - 1 - spot.y;
    const keyB = `${bx},${by}`;

    if (seenAllCoords.has(keyB)) {
      errors.push(`${prefix}: Seat B mirror coordinate (${bx}, ${by}) collides with an existing piece`);
    }
    seenAllCoords.add(keyB);

    if (bx === goals.B.x && by === goals.B.y) {
      errors.push(`${prefix}: Seat B piece cannot start on own goal (${goals.B.x}, ${goals.B.y})`);
    }

    const distToBGoal = Math.max(Math.abs(bx - goals.B.x), Math.abs(by - goals.B.y));
    if (distToBGoal <= 1) {
      errors.push(`${prefix}: Seat B piece at (${bx}, ${by}) is within 1 step of own goal (${goals.B.x}, ${goals.B.y})`);
    }
  });

  // Check type inventory
  for (const [type, expected] of Object.entries(EXPECTED_TYPE_COUNTS)) {
    if (counts[type] !== expected) {
      errors.push(`Type count mismatch for '${type}': expected ${expected}, got ${counts[type]}`);
    }
  }

  return { ok: errors.length === 0, errors };
}

/**
 * Validates a generated CoreState instance against all map invariants.
 * @param {unknown} state
 * @param {number} [size=9] board size
 * @returns {{ ok: boolean, errors: string[] }}
 */
export function validateMapState(state, size = BOARD_SIZE) {
  const errors = [];
  const goals = goalsForSize(size);
  const last = size - 1;

  if (!state || typeof state !== "object" || Array.isArray(state)) {
    return { ok: false, errors: ["State must be a non-null object"] };
  }

  if (state.turn !== "A") {
    errors.push(`Initial turn must be 'A', got '${state.turn}'`);
  }

  if (state.winner !== null || state.reason !== null || state.eliminatedPlayer !== null) {
    errors.push("Initial state cannot be terminal (winner, reason, eliminatedPlayer must be null)");
  }

  if (!state.clock || typeof state.clock !== "object" || !state.clock.remainingMs) {
    errors.push("Initial clock structure missing or invalid");
  } else {
    const remA = state.clock.remainingMs.A;
    const remB = state.clock.remainingMs.B;
    if (typeof remA !== "number" || !Number.isFinite(remA) || remA < 0) {
      errors.push("Clock remainingMs.A must be finite non-negative number");
    }
    if (typeof remB !== "number" || !Number.isFinite(remB) || remB < 0) {
      errors.push("Clock remainingMs.B must be finite non-negative number");
    }
    if (state.clock.runningSeat !== "A") {
      errors.push(`Clock runningSeat must be 'A', got '${state.clock.runningSeat}'`);
    }
  }

  if (!Array.isArray(state.pieces)) {
    errors.push("Pieces must be an array");
    return { ok: false, errors };
  }

  if (state.pieces.length !== 20) {
    errors.push(`Expected exactly 20 pieces (10 per seat), got ${state.pieces.length}`);
  }

  const occupied = new Set();
  const seenIds = new Set();
  const countsBySeat = {
    A: { dam: 0, la: 0, keo: 0 },
    B: { dam: 0, la: 0, keo: 0 }
  };

  const piecesA = [];
  const piecesB = [];

  state.pieces.forEach((p, idx) => {
    const pPath = `pieces[${idx}]`;
    if (!p || typeof p !== "object" || Array.isArray(p)) {
      errors.push(`${pPath}: piece must be a non-null object`);
      return;
    }

    if (typeof p.id !== "string" || p.id.trim().length === 0) {
      errors.push(`${pPath}: missing or invalid piece id`);
    } else {
      if (seenIds.has(p.id)) {
        errors.push(`${pPath}: duplicate piece id '${p.id}'`);
      }
      seenIds.add(p.id);
    }

    if (p.player !== "A" && p.player !== "B") {
      errors.push(`${pPath}: player must be 'A' or 'B', got '${p.player}'`);
      return;
    }

    if (!EXPECTED_TYPE_COUNTS[p.type]) {
      errors.push(`${pPath}: invalid piece type '${p.type}'`);
    } else {
      countsBySeat[p.player][p.type] += 1;
    }

    if (!Number.isInteger(p.x) || !Number.isInteger(p.y) || p.x < 0 || p.x >= size || p.y < 0 || p.y >= size) {
      errors.push(`${pPath}: coordinates (${p.x}, ${p.y}) out of bounds [0..${last}]`);
      return;
    }

    const cellKey = `${p.x},${p.y}`;
    if (occupied.has(cellKey)) {
      errors.push(`${pPath}: duplicate cell occupancy at (${p.x}, ${p.y})`);
    }
    occupied.add(cellKey);

    if (p.player === "A") {
      piecesA.push(p);
      if (p.x === goals.A.x && p.y === goals.A.y) {
        errors.push(`${pPath}: Seat A piece cannot start on own goal (0, 0)`);
      }
      if (Math.max(Math.abs(p.x - goals.A.x), Math.abs(p.y - goals.A.y)) <= 1) {
        errors.push(`${pPath}: Seat A piece at (${p.x}, ${p.y}) is within 1 step of own goal (0, 0)`);
      }
    } else {
      piecesB.push(p);
      if (p.x === goals.B.x && p.y === goals.B.y) {
        errors.push(`${pPath}: Seat B piece cannot start on own goal (${goals.B.x}, ${goals.B.y})`);
      }
      if (Math.max(Math.abs(p.x - goals.B.x), Math.abs(p.y - goals.B.y)) <= 1) {
        errors.push(`${pPath}: Seat B piece at (${p.x}, ${p.y}) is within 1 step of own goal (${goals.B.x}, ${goals.B.y})`);
      }
    }
  });

  // Verify type counts per seat
  for (const seat of ["A", "B"]) {
    for (const [type, expected] of Object.entries(EXPECTED_TYPE_COUNTS)) {
      if (countsBySeat[seat][type] !== expected) {
        errors.push(`Seat ${seat} type count mismatch for '${type}': expected ${expected}, got ${countsBySeat[seat][type]}`);
      }
    }
  }

  // Verify 180° rotational symmetry: for each A(x, y, type) -> exists B(size-1-x, size-1-y, type)
  for (const pa of piecesA) {
    const expBx = size - 1 - pa.x;
    const expBy = size - 1 - pa.y;
    const matchingB = piecesB.find((pb) => pb.x === expBx && pb.y === expBy && pb.type === pa.type);
    if (!matchingB) {
      errors.push(`Missing 180° rotational symmetric Seat B piece for Seat A ${pa.type} at (${pa.x}, ${pa.y}) -> expected at (${expBx}, ${expBy})`);
    }
  }

  // Legal moves verification for both seats
  const legalMovesA = computePureLegalMoves(state.pieces, "A", size);
  if (legalMovesA.length === 0) {
    errors.push("Seat A has zero legal moves from initial position");
  }

  const legalMovesB = computePureLegalMoves(state.pieces, "B", size);
  if (legalMovesB.length === 0) {
    errors.push("Seat B has zero legal moves from initial position");
  }

  return { ok: errors.length === 0, errors };
}

/**
 * Returns a list of all registered map descriptors.
 * @param {object} [options]
 * @param {boolean} [options.includeState=false]
 * @returns {Array<{id: string, revision: number, name: string, description: string, initialState?: object}>}
 */
export function listMaps(options = {}) {
  return Object.keys(MAP_DEFINITIONS).map((id) => getMap(id, options));
}

/**
 * Retrieves a map descriptor by ID.
 * Returns null if the map ID is unknown.
 * @param {string} id
 * @param {object} [options]
 * @param {boolean} [options.includeState=false]
 * @returns {{id: string, revision: number, name: string, description: string, initialState?: object} | null}
 */
export function getMap(id, options = {}) {
  if (typeof id !== "string") return null;
  const def = MAP_DEFINITIONS[id];
  if (!def) return null;

  const descriptor = {
    id: def.id,
    revision: def.revision,
    name: def.name,
    description: def.description
  };

  if (options.includeState) {
    descriptor.initialState = createMapState(id, def.revision, options.size);
  }

  return descriptor;
}

/**
 * Creates a fresh, deep-cloned initial CoreState for a specified map and revision.
 * Defaults to 'classic' revision 1.
 * Throws on unknown map or unsupported revision.
 * @param {string} [id="classic"]
 * @param {number} [revision=1]
 * @param {number} [size=9] board size (9..25); the 9x9 formation is shifted to the seat's own corner
 * @returns {object} Full initial CoreState
 */
export function createMapState(id = "classic", revision = 1, size = BOARD_SIZE) {
  const def = MAP_DEFINITIONS[id];
  if (!def) {
    throw new Error(`Unknown map id: '${id}'`);
  }

  if (revision !== undefined && revision !== null && revision !== def.revision) {
    throw new Error(`Unsupported revision ${revision} for map '${id}'; expected ${def.revision}`);
  }

  assertBoardSize(size);
  const setupA = size === BOARD_SIZE ? def.setupA : shiftSetupToSize(def.setupA, size);
  const state = createFreshCoreState(setupA, undefined, size);
  const validation = validateMapState(state, size);
  if (!validation.ok) {
    throw new Error(`Map '${id}' (size ${size}) generated invalid initial state: ${validation.errors.join("; ")}`);
  }

  return cloneDeep(state);
}
