(function (global, factory) {
  const api = factory();
  if (typeof module === "object" && module && module.exports) module.exports = api;
  global.OTT_CONFIG = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  // Board size. 9 is the original (v1) board; `createConfig(a)` builds the same game on an a x a board.
  const DEFAULT_SIZE = 9;
  const MIN_SIZE = 9;
  const MAX_SIZE = 25;
  const ALL_FILES = "abcdefghijklmnopqrstuvwxy";
  const SIZE = DEFAULT_SIZE;
  const FILES = ALL_FILES.slice(0, SIZE);
  const TYPES = ["dam", "la", "keo"];
  const BEATS = { dam: "keo", keo: "la", la: "dam" };
  const TYPE_LABEL = { dam: "Đấm", la: "Lá", keo: "Kéo" };
  const SEAT_LABEL = { A: "Đỏ", B: "Xanh" };
  const GOAL = { A: { x: 0, y: 0 }, B: { x: SIZE - 1, y: SIZE - 1 } };

  const TIME_CONTROL = {
    initialMs: 10 * 60 * 1000,
    reconnectGraceMs: 60 * 1000
  };

  // A starts in the upper-right. B is the 180-degree rotate around e5.
  const A_SETUP = [
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
  ];

  const DELTAS = [
    [-1, -1], [0, -1], [1, -1],
    [-1, 0],           [1, 0],
    [-1, 1],  [0, 1],  [1, 1]
  ];

  const PORT =
    typeof process !== "undefined" && process.env && process.env.PORT
      ? Number(process.env.PORT)
      : 3000;

  function isValidSize(size) {
    return Number.isInteger(size) && size >= MIN_SIZE && size <= MAX_SIZE;
  }

  /**
   * The same game on an `size` x `size` board (MIN_SIZE..MAX_SIZE).
   * - Goals stay in opposite corners: A at (0, 0), B at (size - 1, size - 1).
   * - Each side keeps its 9x9 opening formation, anchored to its own corner, so the formation is shifted by
   *   (size - 9) along both axes and B is still the 180-degree rotation of A. The gap between the sides grows with `size`.
   * - Everything that is not about the board (types, BEATS, DELTAS, clock) is shared with the default config.
   * `createConfig(9)` is deep-equal to the default config.
   * @param {number} size
   */
  function createConfig(size) {
    if (!isValidSize(size)) {
      throw new RangeError("Board size must be an integer from " + MIN_SIZE + " to " + MAX_SIZE + ", received " + size);
    }
    const shift = size - DEFAULT_SIZE;
    return Object.assign({}, base, {
      SIZE: size,
      FILES: ALL_FILES.slice(0, size),
      GOAL: { A: { x: 0, y: 0 }, B: { x: size - 1, y: size - 1 } },
      A_SETUP: A_SETUP.map((spot) => ({ type: spot.type, x: spot.x + shift, y: spot.y + shift }))
    });
  }

  const base = {
    SIZE,
    FILES,
    TYPES,
    BEATS,
    TYPE_LABEL,
    SEAT_LABEL,
    GOAL,
    A_SETUP,
    TIME_CONTROL,
    DELTAS,
    PORT,
    HOST: "0.0.0.0",
    NAME_MAX: 20,
    ROOM_ID_LEN: 4,
    MAX_ROOMS: 200,
    MAX_MESSAGE: 8192,
    ASSET: { dam: "assets/dam.png", la: "assets/la.png", keo: "assets/keo.png" }
  };

  return Object.assign({}, base, { DEFAULT_SIZE, MIN_SIZE, MAX_SIZE, isValidSize, createConfig });
});
