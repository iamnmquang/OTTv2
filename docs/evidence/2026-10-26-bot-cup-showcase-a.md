# Bot Cup showcase — giai đoạn A: nhánh 4/8/16, phỏng vấn Top 4, xem trước

Ngày: 2026-10-26 · Nhánh: `feat/bot-cup-showcase-a` · Kế hoạch: [2026-10-26-bot-cup-admin-showcase.md](../superpowers/plans/2026-10-26-bot-cup-admin-showcase.md) §3.1

## Lỗi đã sửa

`topFourAfterInterviews` dừng ở 4 đội, còn `knockoutFirstRound` chỉ tạo nhánh 16 khi có ≥ 16 đội được xếp hạt giống. Vì vậy
nhánh 16 của chế độ production không bao giờ được tạo: giải luôn chỉ có bán kết.

## Thay đổi

- `packages/bot-cup-core/src/tournament.mjs`: `knockoutSizeOf(event)` (`config.knockoutSize` 4/8/16, mặc định theo `mode`),
  `knockoutBracketSize(size, teams)`, nhánh 8 (QF1–QF4: 1–8, 4–5, 3–6, 2–7), `topAfterInterviews(ranking, interviews, size)`.
  Chỉ 4 hạt giống đầu phải phỏng vấn (`INTERVIEW_COUNT`), hạt giống 5–N vào thẳng (chủ dự án chốt 2026-10-26).
  `topFourAfterInterviews` vẫn giữ để tương thích.
- `apps/bot-cup-api/src/tournament/engine.mjs`: dùng cỡ nhánh của sự kiện; chỉ đội trong nhánh mới được gán hạt giống;
  `adminView` trả thêm `knockoutSize` và `interviews.size`; `planInterviews` (nhiều đội, tất cả hoặc không gì).
- `apps/bot-cup-admin/src/tournament-routes.mjs`: `{ dryRun: true }` ở mọi bước điều phối (cùng kiểm tra, không ghi DB,
  không audit); `POST /tournament/interviews` (audit `tournament.interview_bulk`).
- `apps/bot-cup-admin/public/admin.js`: hộp xác nhận hiện phần xem trước; nút "Đạt tất cả … đội đang chờ phỏng vấn";
  hiện cỡ nhánh.
- `docs/bot-cup/runbook.vi.md` bước 5.

## Kiểm chứng

- `npm run test:unit`: 1183 pass, 0 fail.
- `tests/bot-cup-tournament.test.js`: nhánh 8, 15 đội → nhánh 8, 16 đội → R16, `knockoutSizeOf`; phỏng vấn Top 4 trong nhánh
  16 (đội trượt được thay).
- `tests/bot-cup-tournament-flow.test.js` (SQLite + migration thật, replay thật): Swiss 11 đội → `knockoutSize: 8` → hạng 2
  trượt phỏng vấn → hạng 5 lên thay → phỏng vấn hàng loạt (danh sách có id lạ thì trả 404 và không ghi gì) → dry-run trả
  `QF1..QF4` mà không thêm audit hay cặp đấu → tứ kết 1–8/4–5/3–6/2–7 → bán kết → chung kết + tranh hạng 3 → đội mạnh nhất vô địch.

## Chưa làm / ghi chú

- `apps/web/src/features/bot-cup/BotCupInfo.tsx` vẫn ghi "Top 4"/"Top 16" theo `mode`, chưa đọc `knockoutSize`; xử lý ở giai đoạn C.
- Thể lệ Thực tế gốc (phỏng vấn 4 đội vào bán kết, sau tứ kết) chưa được cài; hiện phỏng vấn trước khi vào nhánh.
- Chưa deploy.
