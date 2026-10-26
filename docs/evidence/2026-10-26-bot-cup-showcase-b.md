# Bot Cup showcase — giai đoạn B: dữ liệu nhánh đấu

Ngày: 2026-10-26 · Nhánh: `feat/bot-cup-showcase-a` · Kế hoạch: [2026-10-26-bot-cup-admin-showcase.md](../superpowers/plans/2026-10-26-bot-cup-admin-showcase.md) §3.2

## Thay đổi

- `apps/bot-cup-api/src/tournament/engine.mjs`
  - `qualifyingRounds()`: cặp vòng loại theo từng vòng, mỗi cặp gồm tên đỏ/xanh, bye, điểm, số ván đã xong/tổng và các ván
    (id công khai để mở replay). Swiss có `mapId` của vòng; vòng tròn để `null`.
  - `bracketView(ev, knockout)`: cây loại trực tiếp có mọi ô của mọi vòng (R16 → QF → SF → F + 3RD), ô chưa có cặp là
    `null`. Cỡ cây lấy theo thứ tự: nhánh đã mở, nhánh mà bảng vòng loại lấp được, rồi `knockoutSize` của sự kiện.
  - `publicView` thêm `rounds` (đã bỏ team id) và `bracket`; `adminView` thêm `rounds` (giữ `teamA`/`teamB`) và `bracket`.
    Trường `knockout` cũ giữ nguyên để không vỡ web hiện tại.
- `apps/web/src/features/bot-cup/BotCupApiGateway.ts`: `QualifyingPairing`, `QualifyingRound`, `BracketView`; `TournamentView`
  có thêm `rounds` và `bracket`. Mock test của `TournamentPanel`/`ProjectorScreen` được cập nhật theo.

## Kiểm chứng

- `tests/bot-cup-tournament-flow.test.js` (Swiss 11 đội → nhánh 8):
  - vòng 1 ra đúng bản đồ `classic`, 6 mục (5 cặp + 1 bye), các ván ở trạng thái `queued`;
  - trước loại trực tiếp đã có cây 8 (QF/SF/F) với mọi ô trống;
  - sau khi mở nhánh: QF1..QF4 có hạt giống 1–8/4–5/3–6/2–7, bán kết vẫn trống;
  - hết giải: đủ 7 vòng Swiss, mọi ô của cây có đội thắng;
  - JSON công khai không chứa team id hay MSSV, cả lúc đầu lẫn lúc kết thúc; view admin vẫn giữ id.
- `npm run test:unit`: 1183 pass, 0 fail. `npm run test:web`: 817 pass. `npm run typecheck:web`: sạch.

## Chưa làm

Giao diện (cây nhánh đấu, các vòng Swiss) thuộc giai đoạn C (web công khai) và E (admin).
