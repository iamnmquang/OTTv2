# Bàn cờ a×a (kích thước thay đổi theo giai đoạn)

Tài liệu này mô tả phần đã làm để bàn cờ không còn cố định 9×9. Kích thước bàn `a` là một **tham số**, giá trị hợp lệ là số nguyên
từ `9` đến `25` (đổi hai hằng `MIN`/`MAX` ở `packages/game-core/src/config.js` và `packages/arena/src/domain/board-size.mjs` nếu muốn khoảng khác;
`tests/board-size.test.js` sẽ báo nếu hai nơi lệch nhau).

## Luật của bàn a×a

- Hai ô thắng ở hai góc đối diện: A ở `(0, 0)`, B ở `(a−1, a−1)`.
- Mỗi bên giữ **nguyên đội hình 9×9** (10 quân, 3 Đấm – 4 Lá – 3 Kéo), dịch `(a−9)` theo cả hai trục để vẫn nằm sát góc của mình.
  B luôn là phép xoay 180° của A. Khi `a` tăng, khoảng trống ở giữa hai bên rộng ra, ván dài hơn.
- Ba bản đồ `classic`, `flanks`, `center` đều dựng được ở mọi `a` theo cùng quy tắc dịch.
- Luật đi quân, ăn quân, đồng hồ không đổi. Với `a = 9` mọi thứ giống hệt bản cũ (id `ottv2-g-default-v1`, hash, replay).
- Mỗi `a ≠ 9` có `rulesetId` riêng: `ottv2-g-sq<a>-v1` (ví dụ `ottv2-g-sq13-v1`), nên hash và replay không bao giờ lẫn giữa các cỡ bàn.

## Cách dùng

```js
const config = require("./packages/game-core/src/config");
const rules = require("./packages/game-core/src/rules");
const ai = require("./packages/game-core/src/ai");

const cfg = config.createConfig(13);          // 13×13
const r = rules.withConfig(cfg);              // luật cho bàn 13×13
const a = ai.withConfig(r, cfg);              // AI cho bàn 13×13
```

Trọng tài cục bộ cho thí sinh: `node sdk/bot-cup/judge.mjs bot.py easy --size 13`.

Arena / Bot Cup (Node):

| Việc | Hàm |
|---|---|
| Engine cho bàn a×a | `createNodeEngineForSize(a)` (`packages/arena-node/src/core/node-engine.mjs`) |
| Ruleset snapshot | `createCurrentRulesetSnapshot(config.createConfig(a))` |
| Thế cờ ban đầu | `createMapState(mapId, 1, a)` |
| Kiểm tra replay Bot Cup | `verifyReplay(replay, { mapId, boardSize: a })` |
| Chạy giả lập một ván | `playSimulatedGame({ ..., boardSize: a })` |

Tin nhắn `turn` gửi cho bot nay có thêm `goals` (cùng `boardWidth`, `boardHeight` đã có từ trước). Bot mẫu Python/JS đọc kích thước từ đó.

## Những gì đã đổi

- `packages/game-core`: `config.js` (`createConfig`), `rules.js` và `ai.js` (`withConfig`). Cấu hình mặc định không đổi.
- `packages/arena`: `domain/board-size.mjs` (mới), `domain/ruleset.mjs`, `domain/maps/*`, `contracts/validation.mjs`, `contracts/index.*`,
  `application/match-controller.mjs`. Cơ chế "từ chối ruleset lạ" vẫn giữ: chỉ ruleset trùng đúng bản chuẩn của một cỡ bàn trong khoảng cho phép mới được chạy.
- `packages/arena-node`: `createNodeEngineForSize`.
- `packages/bot-cup-core/src/replay.mjs`: replay có `boardSize` (bỏ trống với 9×9). API phải nói rõ cỡ bàn đã xếp lịch (`expected.boardSize`),
  replay khai cỡ khác bị từ chối (`replay_board_size`).
- `apps/bot-cup-runner/src/simulate.mjs`: nhận `boardSize`.
- `sdk/bot-cup`: `judge.mjs` (`--size`), bot mẫu `python/bot.py`, `js/bot.mjs`, `GUIDE.vi.md`.
- `apps/bot-cup-api/src/reference-hashes.mjs`: tạo lại vì `ai.js` và hai bot mẫu đã đổi.
- Test: `tests/board-size.test.js` (mới, 94 test) và `tests/arena-ruleset.test.js` (test "chỉ 9×9" được đổi thành "chỉ bàn vuông trong khoảng 9–25").

## Chưa làm (cần làm tiếp để dùng cho cả giải)

1. **Cơ sở dữ liệu và API Bot Cup**: thêm bảng `stage_rules` (giai đoạn → `a`, `rulesetId`, giờ công bố/mở/khóa nộp), `stage_entries` (bản thi đấu theo giai đoạn
   thay cho `teams.final_submission_id`), và cột `board_size` (hoặc `ruleset_id`) cho `matches`/`jobs`. Sau đó `apps/bot-cup-api/src/runner/api.mjs` truyền
   `boardSize: match.board_size` vào `verifyReplay`, và job gửi `boardSize` cho runner.
2. **Runner thật** (`apps/bot-cup-runner/src/executor.mjs`): dùng `createNodeEngineForSize`, `createMapState(mapId, 1, a)` và `compactReplay({ ..., boardSize })`.
3. **Chống gian lận** (`packages/bot-cup-core/src/fingerprint.mjs`): bộ thế cờ bí mật và regex `[0-8]` còn gắn với 9×9; cần sinh bộ riêng cho từng `a`.
4. **Giao diện web** (`Board.tsx`, `game.module.css`, `lobby.module.css`, `format.ts`) và chế độ chơi online/AI trên web vẫn 9×9.
5. **Bot nội bộ** `bots/sentinel.mjs`, `bots/strategist.mjs` còn viết cứng 9×9 (judge từ chối chúng khi `--size` ≠ 9).
6. **Hiệu chỉnh**: độ mạnh/thời gian của AI "Dễ/Trung bình/Khó" ở bàn lớn, và số nước tối đa (300) theo `a`.
7. `apps/arena-api/src/routes/matches.mjs` vẫn gọi `checkInitialState` mặc định 9×9.

## Lưu ý khi triển khai

- `config.js` và `rules.js` đã đổi nội dung, nên **engine fingerprint** (`computeCurrentEngineFingerprint`, băm hai file này) sẽ khác bản cũ.
  Replay hoặc trận đã lưu với fingerprint cũ không còn khớp nếu có nơi so sánh trực tiếp.
- Các test dùng `better-sqlite3`/`esbuild` (khoảng 260 test: API, database, đóng gói bộ khởi đầu) **chưa chạy được trong môi trường đã dùng để sửa**
  (không có mạng để cài thư viện). Hãy chạy `npm ci && npm run test:unit` trên máy bạn để chắc chắn.
- `scripts/bot-cup/build-kit.mjs` thay hai dòng `require` trong `node-engine.mjs`; hai dòng này được giữ nguyên.
