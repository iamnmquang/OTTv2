// Bot mẫu OTT Bot Cup (Node 22, chỉ module dựng sẵn, chạy dưới dạng ES module: dùng import, không dùng require).
//
// Mỗi lượt, trọng tài gửi MỘT dòng JSON qua stdin; bot trả lời MỘT dòng JSON qua stdout.
// Muốn in log để gỡ lỗi thì dùng log(...) (ghi ra stderr). Đừng console.log(): nó ghi ra stdout và trọng tài sẽ xử thua.
//
// Chạy thử: node judge.mjs bot.mjs easy   (xem GUIDE.vi.md)
import readline from "node:readline";

// Loại quân thắng loại quân nào: Đấm ăn Kéo, Kéo ăn Lá, Lá ăn Đấm.
const BEATS = { dam: "keo", keo: "la", la: "dam" };
// Kích thước bàn KHÔNG cố định: mỗi giai đoạn của giải có thể dùng bàn a×a khác nhau (đọc a từ input mỗi lượt).
// Đừng viết cứng 9 hay 8 trong bot. A thắng ở (0, 0), B thắng ở góc đối diện (a-1, a-1).

function log(...parts) {
  process.stderr.write(parts.join(" ") + "\n");
}

/** Số ô mỗi cạnh của bàn (a trong bàn a×a). */
function boardSize(turn) {
  return turn.boardWidth ?? 9;
}

/** Ô thắng { x, y } của ghế `seat`. */
function goalOf(turn, seat) {
  if (turn.goals) return turn.goals[seat];
  const last = boardSize(turn) - 1;
  return seat === "A" ? { x: 0, y: 0 } : { x: last, y: last };
}

/**
 * Trả về một nước trong turn.legalMoves.
 *
 * turn có các trường chính:
 *   turn.turn             ghế của bot: "A" hoặc "B"
 *   turn.boardWidth       kích thước bàn a (bàn a×a); turn.goals là ô thắng của hai ghế
 *   turn.board            danh sách quân: { id, owner: "A"|"B", type: "dam"|"la"|"keo", x, y }
 *   turn.legalMoves       mọi nước hợp lệ: { from: { x, y }, to: { x, y } }
 *   turn.ply              số thứ tự nước trong ván (từ 1)
 *   turn.turnTimeLimitMs  thời gian tối đa cho nước này
 *   turn.timeRemainingMs  quỹ thời gian còn lại của bot
 */
function chooseMove(turn) {
  const moves = turn.legalMoves;

  // ===== Viết chiến thuật ở đây =====
  // Ví dụ: đi thẳng vào ô thắng nếu được.
  const goal = goalOf(turn, turn.turn);
  const winning = moves.find((move) => move.to.x === goal.x && move.to.y === goal.y);
  if (winning) return winning;

  return moves[0];
}

const input = readline.createInterface({ input: process.stdin, terminal: false });
input.on("line", (line) => {
  if (!line.trim()) return;
  const turn = JSON.parse(line);
  if (turn.type !== "turn") return;
  const move = chooseMove(turn);
  process.stdout.write(JSON.stringify({ protocolVersion: 1, requestId: turn.requestId, move }) + "\n");
});
