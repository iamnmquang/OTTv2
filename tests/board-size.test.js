/**
 * Variable board size (a x a, a = 9 is the original game).
 * Covers: game-core config/rules/ai, the Arena ruleset and maps, the referee (turn message, move validation, replay
 * document), the Bot Cup compact replay, the simulated runner and the local judge.
 */
const { before, describe, it } = require("node:test");
const assert = require("node:assert/strict");

const config = require("../packages/game-core/src/config");
const rules = require("../packages/game-core/src/rules");
const ai = require("../packages/game-core/src/ai");

const SIZES = [9, 10, 11, 12, 13, 15, 20, 25];
const M = {};

before(async () => {
  M.boardSize = await import("../packages/arena/src/domain/board-size.mjs");
  M.ruleset = await import("../packages/arena/src/domain/ruleset.mjs");
  M.maps = await import("../packages/arena/src/domain/maps/index.mjs");
  M.contracts = await import("../packages/arena/src/contracts/index.mjs");
  M.identity = await import("../packages/arena-node/src/core/ruleset-identity.mjs");
  M.engine = await import("../packages/arena-node/src/core/node-engine.mjs");
  M.replay = await import("../packages/bot-cup-core/src/replay.mjs");
  M.sim = await import("../apps/bot-cup-runner/src/simulate.mjs");
  M.judge = await import("../sdk/bot-cup/judge.mjs");
});

const sized = (size) => {
  const cfg = config.createConfig(size);
  const r = rules.withConfig(cfg);
  return { cfg, rules: r, ai: ai.withConfig(r, cfg) };
};

describe("game-core config", () => {
  it("keeps the original 9x9 game untouched", () => {
    assert.equal(config.SIZE, 9);
    assert.equal(config.FILES, "abcdefghi");
    assert.deepEqual(config.GOAL, { A: { x: 0, y: 0 }, B: { x: 8, y: 8 } });
    assert.deepEqual(config.A_SETUP[0], { type: "la", x: 4, y: 7 });
    assert.equal(config.A_SETUP.length, 10);
    const nine = config.createConfig(9);
    for (const key of ["SIZE", "FILES", "GOAL", "A_SETUP", "TYPES", "BEATS", "DELTAS", "TIME_CONTROL"]) {
      assert.deepEqual(nine[key], config[key], key);
    }
  });

  it("accepts only integer sizes from MIN_SIZE to MAX_SIZE", () => {
    assert.equal(config.MIN_SIZE, 9);
    assert.equal(config.MAX_SIZE, 25);
    for (const bad of [8, 26, 0, -9, 9.5, "13", NaN, undefined, null]) {
      assert.throws(() => config.createConfig(bad), RangeError, String(bad));
    }
    for (const good of [9, 17, 25]) assert.doesNotThrow(() => config.createConfig(good));
  });

  for (const size of SIZES) {
    it(`builds a consistent ${size}x${size} config`, () => {
      const cfg = config.createConfig(size);
      assert.equal(cfg.SIZE, size);
      assert.equal(cfg.FILES.length, size);
      assert.deepEqual(cfg.GOAL, { A: { x: 0, y: 0 }, B: { x: size - 1, y: size - 1 } });
      const shift = size - 9;
      cfg.A_SETUP.forEach((spot, i) => {
        assert.equal(spot.type, config.A_SETUP[i].type);
        assert.equal(spot.x, config.A_SETUP[i].x + shift);
        assert.equal(spot.y, config.A_SETUP[i].y + shift);
      });
      // Does not change the default config
      assert.equal(config.SIZE, 9);
      assert.equal(config.A_SETUP[0].x, 4);
    });
  }
});

describe("game-core rules and ai on larger boards", () => {
  for (const size of SIZES) {
    it(`${size}x${size}: initial position, edges, goals`, () => {
      const g = sized(size);
      const state = g.rules.createInitialState();
      assert.equal(state.pieces.length, 20);
      const cells = new Set(state.pieces.map((p) => `${p.x},${p.y}`));
      assert.equal(cells.size, 20, "no two pieces share a cell");
      for (const p of state.pieces) assert.ok(p.x >= 0 && p.x < size && p.y >= 0 && p.y < size);
      assert.ok(g.rules.allMoves(state, "A").length > 0);
      assert.ok(g.rules.allMoves(state, "B").length > 0);

      // Edge: a piece on the last column cannot leave the board (but could on a larger one)
      const edge = { turn: "A", winner: null, reason: null, eliminatedPlayer: null, clock: g.rules.createEmptyState().clock,
        pieces: [
          { id: "A-dam-0", player: "A", type: "dam", x: size - 1, y: 5 },
          { id: "B-dam-0", player: "B", type: "dam", x: 3, y: 3 }
        ] };
      assert.equal(g.rules.applyMove(edge, "A", { x: size - 1, y: 5 }, { x: size, y: 5 }).ok, false);
      assert.equal(g.rules.applyMove(edge, "A", { x: size - 1, y: 5 }, { x: size - 2, y: 5 }).ok, true);

      // A wins on (0,0); B wins on (size-1, size-1)
      const winA = { ...edge, turn: "A", pieces: [
        { id: "A-dam-0", player: "A", type: "dam", x: 1, y: 1 },
        { id: "B-dam-0", player: "B", type: "dam", x: 6, y: 6 }
      ] };
      const afterA = g.rules.applyMove(winA, "A", { x: 1, y: 1 }, { x: 0, y: 0 });
      assert.equal(afterA.ok, true);
      assert.equal(afterA.state.winner, "A");
      assert.equal(afterA.state.reason, "goal");
      const winB = { ...edge, turn: "B", pieces: [
        { id: "A-dam-0", player: "A", type: "dam", x: 2, y: 2 },
        { id: "B-dam-0", player: "B", type: "dam", x: size - 2, y: size - 2 }
      ] };
      const afterB = g.rules.applyMove(winB, "B", { x: size - 2, y: size - 2 }, { x: size - 1, y: size - 1 });
      assert.equal(afterB.ok, true);
      assert.equal(afterB.state.winner, "B");
      assert.equal(afterB.state.reason, "goal");
    });

    it(`${size}x${size}: the AI answers with a legal move`, () => {
      const g = sized(size);
      const state = g.rules.createInitialState();
      for (const level of ["easy", "medium"]) {
        const move = g.ai.chooseMove(state, "A", { level });
        assert.ok(move, level);
        const legal = g.rules.allMoves(state, "A");
        assert.ok(legal.some((m) => m.from.x === move.from.x && m.from.y === move.from.y && m.to.x === move.to.x && m.to.y === move.to.y), level);
      }
    });
  }

  it("a cell that is on a 13x13 board is off the 9x9 board", () => {
    const state = (size) => ({ turn: "A", winner: null, reason: null, eliminatedPlayer: null, clock: rules.createEmptyState().clock,
      pieces: [{ id: "A-dam-0", player: "A", type: "dam", x: 8, y: 5 }, { id: "B-dam-0", player: "B", type: "dam", x: 3, y: 3 }], size });
    assert.equal(rules.applyMove(state(9), "A", { x: 8, y: 5 }, { x: 9, y: 5 }).ok, false);
    assert.equal(sized(13).rules.applyMove(state(13), "A", { x: 8, y: 5 }, { x: 9, y: 5 }).ok, true);
  });
});

describe("arena board-size module stays in step with game-core", () => {
  for (const size of SIZES) {
    it(`${size}: files, goals and setup agree`, () => {
      const cfg = config.createConfig(size);
      assert.equal(M.boardSize.filesForSize(size), cfg.FILES);
      assert.deepEqual(M.boardSize.goalsForSize(size), cfg.GOAL);
      assert.deepEqual(M.boardSize.canonicalSetupForSize(size), cfg.A_SETUP);
    });
  }

  it("agrees on the supported range", () => {
    assert.equal(M.boardSize.MIN_BOARD_SIZE, config.MIN_SIZE);
    assert.equal(M.boardSize.MAX_BOARD_SIZE, config.MAX_SIZE);
    assert.equal(M.boardSize.DEFAULT_BOARD_SIZE, config.DEFAULT_SIZE);
    for (const n of [8, 9, 25, 26, 12.5]) assert.equal(M.boardSize.isValidBoardSize(n), config.isValidSize(n), String(n));
  });
});

describe("arena ruleset for a x a boards", () => {
  const hashes = new Map();

  for (const size of SIZES) {
    it(`${size}: snapshot is valid, supported and has its own id and hash`, () => {
      const snapshot = M.ruleset.createCurrentRulesetSnapshot(config.createConfig(size));
      assert.equal(snapshot.boardWidth, size);
      assert.equal(snapshot.boardHeight, size);
      assert.equal(snapshot.rulesetId, size === 9 ? M.ruleset.RULESET_ID_G_V1 : `ottv2-g-sq${size}-v1`);
      assert.equal(snapshot.rulesetId, M.ruleset.rulesetIdForSize(size));
      assert.equal(M.ruleset.validateRulesetSnapshot(snapshot).ok, true);
      assert.equal(M.ruleset.isSupportedEngineRuleset(snapshot), true);
      const hash = M.identity.computeRulesetHash(snapshot);
      assert.equal(hashes.has(hash), false, "every size has a different ruleset hash");
      hashes.set(hash, size);
    });
  }

  it("the 9x9 snapshot is byte-identical to the one built from the default config", () => {
    const fromDefault = M.ruleset.createCurrentRulesetSnapshot(config);
    const fromSized = M.ruleset.createCurrentRulesetSnapshot(config.createConfig(9));
    assert.equal(M.ruleset.canonicalRulesetJson(fromDefault), M.ruleset.canonicalRulesetJson(fromSized));
  });

  it("refuses tampered snapshots (fail closed)", () => {
    const make = () => M.ruleset.createCurrentRulesetSnapshot(config.createConfig(13));

    const wrongId = make();
    wrongId.rulesetId = "ottv2-g-sq12-v1";
    assert.equal(M.ruleset.isSupportedEngineRuleset(wrongId), false);

    const nineId = make();
    nineId.rulesetId = M.ruleset.RULESET_ID_G_V1;
    assert.equal(M.ruleset.isSupportedEngineRuleset(nineId), false);

    const wrongGoal = make();
    wrongGoal.goals.B = { x: 11, y: 12 };
    assert.equal(M.ruleset.isSupportedEngineRuleset(wrongGoal), false);

    const wrongSetup = make();
    wrongSetup.initialSetup.A[0] = { ...wrongSetup.initialSetup.A[0], x: wrongSetup.initialSetup.A[0].x - 1 };
    assert.equal(M.ruleset.isSupportedEngineRuleset(wrongSetup), false);

    const nineSetupOn13 = make();
    const nine = M.ruleset.createCurrentRulesetSnapshot(config.createConfig(9));
    nineSetupOn13.initialSetup = nine.initialSetup;
    assert.equal(M.ruleset.isSupportedEngineRuleset(nineSetupOn13), false);

    const notSquare = make();
    notSquare.boardHeight = 12;
    assert.equal(M.ruleset.isSupportedEngineRuleset(notSquare), false);

    const outOfRange = make();
    outOfRange.boardWidth = 8;
    outOfRange.boardHeight = 8;
    assert.equal(M.ruleset.isSupportedEngineRuleset(outOfRange), false);
  });
});

describe("arena maps on a x a boards", () => {
  for (const size of SIZES) {
    for (const mapId of ["classic", "flanks", "center"]) {
      it(`${mapId} ${size}x${size} passes every invariant`, () => {
        const state = M.maps.createMapState(mapId, 1, size);
        assert.equal(state.pieces.length, 20);
        const result = M.maps.validateMapState(state, size);
        assert.deepEqual(result.errors, []);
        assert.equal(result.ok, true);
      });
    }

    it(`classic ${size}x${size} equals the game-core initial position`, () => {
      const fromMap = M.maps.createMapState("classic", 1, size);
      const fromCore = sized(size).rules.createInitialState();
      assert.deepEqual(fromMap.pieces, fromCore.pieces);
    });
  }

  it("rejects sizes outside the supported range", () => {
    for (const bad of [8, 26, 9.5, "13"]) assert.throws(() => M.maps.createMapState("classic", 1, bad), RangeError, String(bad));
  });

  it("a 13x13 state is not a valid 9x9 state", () => {
    const state = M.maps.createMapState("classic", 1, 13);
    assert.equal(M.maps.validateMapState(state, 9).ok, false);
    assert.equal(M.maps.validateMapState(state, 13).ok, true);
  });

  it("keeps the 9x9 default when no size is given", () => {
    assert.deepEqual(M.maps.createMapState("flanks"), M.maps.createMapState("flanks", 1, 9));
  });
});

describe("referee on a x a boards", () => {
  it("validateBotAction checks coordinates against the board of the match", () => {
    const action = (x, y) => ({ protocolVersion: 1, requestId: "r1", move: { from: { x: 11, y: 11 }, to: { x, y } } });
    assert.equal(M.contracts.validateBotAction(action(12, 12), "r1", 13, 13).ok, true);
    assert.equal(M.contracts.validateBotAction(action(13, 12), "r1", 13, 13).ok, false);
    assert.equal(M.contracts.validateBotAction(action(12, 12), "r1").ok, false, "default board is 9x9");
  });

  it("sends boardWidth, boardHeight and goals in every turn and plays a whole game", async () => {
    const turns = [];
    const size = 13;
    const g = sized(size);
    const stateFromTurn = (turn) => ({ pieces: turn.board.map((p) => ({ id: p.id, player: p.owner, type: p.type, x: p.x, y: p.y })), turn: turn.turn, winner: null });
    const choose = (turn) => {
      turns.push(turn);
      return g.ai.chooseMove(stateFromTurn(turn), turn.turn, { level: "easy" }) ?? turn.legalMoves[0];
    };
    const replay = await M.sim.playSimulatedGame({
      matchId: "board-size-turn-check",
      mapId: "classic",
      policy: M.replay.BOT_CUP_POLICY,
      chooseA: choose,
      chooseB: choose,
      boardSize: size
    });
    assert.ok(turns.length > 4);
    for (const turn of turns) {
      assert.equal(turn.boardWidth, size);
      assert.equal(turn.boardHeight, size);
      assert.deepEqual(turn.goals, { A: { x: 0, y: 0 }, B: { x: size - 1, y: size - 1 } });
      assert.equal(turn.rulesetId, "ottv2-g-sq13-v1");
      assert.ok(turn.legalMoves.length > 0);
    }
    assert.ok(["win", "draw", "forfeit"].includes(replay.result.outcome));
    assert.ok(replay.moves.length > 0);
    assert.notEqual(replay.result.outcome, "forfeit", "easy AI never answers illegally");
  });
});

describe("Bot Cup replays on a x a boards", () => {
  const play = (boardSize, mapId = "classic") => {
    const g = sized(boardSize ?? 9);
    const stateFromTurn = (turn) => ({ pieces: turn.board.map((p) => ({ id: p.id, player: p.owner, type: p.type, x: p.x, y: p.y })), turn: turn.turn, winner: null });
    const choose = (turn) => g.ai.chooseMove(stateFromTurn(turn), turn.turn, { level: "easy" }) ?? turn.legalMoves[0];
    return M.sim.playSimulatedGame({
      matchId: `replay-${boardSize}-${mapId}`,
      mapId,
      policy: M.replay.BOT_CUP_POLICY,
      chooseA: choose,
      chooseB: choose,
      ...(boardSize === undefined ? {} : { boardSize })
    });
  };

  it("a 9x9 replay has no boardSize and verifies as before", async () => {
    const replay = await play(undefined);
    assert.equal("boardSize" in replay, false);
    assert.equal(M.replay.verifyReplay(replay, { mapId: "classic" }).ok, true);
    assert.equal(M.replay.verifyReplay(replay, { mapId: "classic", boardSize: 9 }).ok, true);
  });

  for (const size of [11, 13, 17]) {
    it(`a ${size}x${size} replay verifies only for that size`, async () => {
      const replay = await play(size);
      assert.equal(replay.boardSize, size);
      const ok = M.replay.verifyReplay(replay, { mapId: "classic", boardSize: size });
      assert.equal(ok.ok, true, JSON.stringify(ok));
      assert.equal(M.replay.verifyReplay(replay, { mapId: "classic" }).error, "replay_board_size", "API did not schedule a size, so 9");
      assert.equal(M.replay.verifyReplay(replay, { mapId: "classic", boardSize: size + 2 }).error, "replay_board_size");
      assert.equal(M.replay.verifyReplay({ ...replay, boardSize: undefined }, { mapId: "classic", boardSize: size }).error, "replay_board_size");
    });
  }

  it("refuses a replay that leaves the board or lies about the size", async () => {
    const replay = await play(13);
    const bad = JSON.parse(JSON.stringify(replay));
    bad.moves[0].to = { x: 13, y: bad.moves[0].to.y };
    assert.equal(M.replay.verifyReplay(bad, { mapId: "classic", boardSize: 13 }).error, "replay_illegal_move");
    // A 13x13 game claimed as 9x9 is replayed on the 9x9 board and breaks there
    const lie = { ...JSON.parse(JSON.stringify(replay)) };
    delete lie.boardSize;
    assert.equal(M.replay.verifyReplay(lie, { mapId: "classic" }).ok, false);
  });

  it("expands into a replay document that passes the Arena validator", async () => {
    const replay = await play(13);
    const verified = M.replay.verifyReplay(replay, { mapId: "classic", boardSize: 13 });
    assert.equal(verified.ok, true);
    const doc = await M.replay.expandReplay(replay, {
      matchId: "expand-13",
      participants: { A: { botId: "a", name: "A" }, B: { botId: "b", name: "B" } }
    });
    assert.equal(doc.rulesetId, "ottv2-g-sq13-v1");
    assert.equal(doc.rulesetSnapshot.boardWidth, 13);
    const validation = M.contracts.validateReplayDocument(doc);
    assert.deepEqual(validation.errors, []);
    assert.equal(validation.ok, true);
  });

  it("works for every map", async () => {
    for (const mapId of ["classic", "flanks", "center"]) {
      const replay = await play(15, mapId);
      assert.equal(M.replay.verifyReplay(replay, { mapId, boardSize: 15 }).ok, true, mapId);
    }
  });
});

describe("local judge (--size)", () => {
  const run = async (args) => {
    const lines = [];
    const code = await M.judge.main(args, (line) => lines.push(line));
    return { code, text: lines.join("\n") };
  };

  it("plays on a 11x11 board with house bots", async () => {
    const { code, text } = await run(["first-legal", "easy", "--size", "11", "--maps", "classic"]);
    assert.equal(code, 0, text);
    assert.match(text, /11×11/);
    assert.match(text, /Kết quả sau 2 ván/);
    assert.doesNotMatch(text, /lỗi trọng tài/);
  });

  it("keeps the default 9x9 output unchanged", async () => {
    const { code, text } = await run(["first-legal", "easy", "--maps", "classic"]);
    assert.equal(code, 0, text);
    assert.doesNotMatch(text, /×/ , "no size note on the original board");
  });

  it("rejects a size outside the range", async () => {
    for (const size of ["8", "26", "abc"]) {
      const { code, text } = await run(["easy", "easy", "--size", size]);
      assert.equal(code, 2, size);
      assert.match(text, /--size phải là số nguyên từ 9 đến 25/);
    }
  });

  it("refuses the house bots that only know 9x9", async () => {
    for (const bot of ["sentinel", "strategist"]) {
      const { code, text } = await run([bot, "easy", "--size", "11"]);
      assert.equal(code, 2, bot);
      assert.match(text, /chỉ chơi bàn 9×9/);
    }
  });
});
