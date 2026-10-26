# Bot Cup — trang BTC mới, nhánh đấu công khai và demo 100 đội

Ngày: 2026-10-26 · Trạng thái: **A–E xong** (A–D: PR #36 đã merge; E: nhánh `feat/bot-cup-admin-react`), F chưa làm · Kế hoạch gốc: [2026-10-23-uet-k71-bot-cup.md](2026-10-23-uet-k71-bot-cup.md)

## 1. Mục tiêu

1. BTC xem được nhánh đấu từng giai đoạn (cặp đấu Swiss theo vòng, cây loại trực tiếp), và một bấm là mở trang công khai hoặc màn trình chiếu.
2. Người xem có trang nhánh đấu công khai đẹp. Kết quả **vẫn tự động công khai** như hiện tại, tài liệu chốt mỗi giai đoạn vẫn có SHA-256.
3. Trang BTC viết lại bằng React, dùng theme và UI chung của `apps/web`. Thao tác nhanh: modal thay cho `prompt`/`confirm`, có xem trước trước bước không hoàn tác.
4. Có sự kiện demo 100 đội ảo: sơ loại → Swiss → phỏng vấn → loại trực tiếp **16 đội**. Ván được đánh thật bằng runner giả lập trong Node, Worker kiểm tra lại replay như giải thật.

Quyết định đã chốt với chủ dự án (2026-10-26): giữ công khai tự động và thêm trang đẹp; giữ thể thức, nhánh 16; React + theme web; runner giả lập Node.

## 2. Hiện trạng (đã đọc code)

| Phần | Hiện tại | Thiếu |
| --- | --- | --- |
| Admin (`apps/bot-cup-admin/public/admin.js`, JS thuần ~700 dòng) | 10 tab: Tổng quan, Điều phối giải, Trận, Đội, Bài nộp, Cờ gian lận, Runner & job, Chờ duyệt, Thông báo, Audit | Không có màn nhánh đấu; Swiss chỉ có bảng xếp hạng, không xem cặp theo vòng; loại trực tiếp là bảng phẳng; mọi thao tác dùng `window.prompt`/`confirm` |
| Điều phối (`tournament-routes.mjs` → `engine.mjs`) | Từng bước kiểm tra phase, mỗi bước là một batch D1 kèm audit; chốt giai đoạn ghi `stage_results` (bất biến, SHA-256) | Không có xem trước (dry-run) trước bước không hoàn tác |
| Công khai (`engine.publicView` → `/api/t/tournament`, `TournamentPanel.tsx`) | Bảng vòng loại live, danh sách cặp loại trực tiếp, tài liệu đã chốt | Không có cặp Swiss theo vòng; chưa vẽ cây; admin không có link sang |
| Nhánh 16 | `KNOCKOUT_SIZE.production = 16`, `knockoutFirstRound` có bảng hạt giống 16 | **Lỗi:** `topFourAfterInterviews` dừng ở 4 đội nên `seeded.length` không bao giờ ≥ 16 → nhánh 16 không bao giờ được tạo. Cỡ nhánh còn gắn cứng theo `mode` |
| Đăng nhập | `ADMIN_AUTH_MODE=demo` (bấm là vào) trên staging | — |
| Diễn tập | `scripts/bot-cup/rehearsal.mjs`: 8 đội, bot thật chạy qua runner container | Không đủ quy mô cho nhánh 16 |

## 3. Thiết kế

### 3.1 Cỡ nhánh và phỏng vấn Top N

- Thêm `knockoutSize` vào `events.config_json` (4, 8 hoặc 16). Nếu thiếu thì dùng `KNOCKOUT_SIZE[mode]`. Không cần migration vì đây là cột JSON có sẵn.
- `topFourAfterInterviews` đổi thành `topAfterInterviews(ranking, interviews, size)`; giữ tên cũ làm wrapper `size = 4` để test cũ không vỡ.
- `knockoutFirstRound(seeded, size)` nhận đúng `size`; thêm bảng hạt giống 8 (QF1–QF4: 1–8, 4–5, 3–6, 2–7) và nhãn `QF`.
- Phỏng vấn (chốt 2026-10-26): **chỉ 4 hạt giống đầu** phải phỏng vấn, kể cả nhánh 8/16; đội trượt được thay bằng đội kế tiếp, hạt giống 5–N vào thẳng. Thêm `POST /tournament/interviews` (danh sách đội + kết quả, một audit row `tournament.interview_bulk`) và nút "Đạt tất cả đội đang chờ".
- Test tại `packages/bot-cup-core` (seeding 8/16, đội trượt phỏng vấn thì người kế tiếp lên thay) và luồng engine trên SQLite (`tests/bot-cup-tournament-flow.test.js`).

### 3.2 Dữ liệu nhánh đấu cho admin và công khai

- Trong engine, thêm `bracketView()` dùng chung cho `adminView` và `publicView`:
  - `rounds`: với Swiss/vòng tròn, mỗi vòng là một danh sách cặp `{ red, blue, points, games: [{ id, mapId, status, winner, reason }], bye }`.
  - `knockout`: cây theo `round`/`slot`, ô chưa có đội để `null` để UI vẽ trước khung (R16 → QF → SF → F).
- `publicView` chỉ thêm `rounds`; vẫn không lộ MSSV, email, id đội (giữ quy tắc §8.8). Match id công khai để mở replay như hiện tại.
- Cập nhật kiểu trong `BotCupApiGateway.ts`. Mã lỗi mới (nếu có) phải có thông điệp trong `botCupMessages.ts`.

### 3.3 Trang nhánh đấu công khai (`apps/web/src/features/bot-cup/`)

- Component mới `bracket/` (dùng chung với admin):
  - `KnockoutTree`: cây SVG hoặc CSS grid, đường nối giữa các vòng, hạt giống, điểm, đội thắng nổi bật, bấm cặp để xem các ván (mở `ReplaySession`). Màn hẹp chuyển sang danh sách theo vòng.
  - `SwissRounds`: tab theo vòng, thẻ cặp đấu, lọc theo tên đội.
  - `StandingsTable`: tách từ `TournamentPanel`.
- `TournamentPanel` dùng ba component trên. URL `?view=bot-cup&screen=bracket` mở thẳng nhánh đấu (để admin link tới); `screen=projector` dùng `KnockoutTree` cỡ lớn.
- Tự làm mới: giữ cơ chế tải hiện có. Nếu chưa có polling thì thêm làm mới 15 giây khi tab đang hiện. Đây là HTTP tới `/api/t`, không phải PlayHTML.
- Accessibility: mỗi cặp là một nút có tên accessible ("R16-1: Đội A (1) 4 – 2 Đội B (16)").

### 3.4 Trang BTC bằng React

- `apps/bot-cup-admin/web/` (Vite + React + TS), build ra `apps/bot-cup-admin/public/`. Worker giữ nguyên: CSP `script-src 'self'` vẫn đúng vì bundle tự host.
- Dùng `apps/web/src/shared/theme/tokens.css` và `apps/web/src/shared/ui` qua alias Vite. Logo UET và màu xanh hiện tại trở thành biến theme của admin.
- Bố cục: sidebar theo nhóm như hiện tại, header có chip giai đoạn và đồng hồ máy chủ, thông báo dạng toast.
- Các màn:
  1. **Tổng quan**: thẻ số liệu, tiến độ ván theo giai đoạn (thanh tiến trình), việc cần làm (cờ mở, job lỗi, chờ duyệt, khiếu nại).
  2. **Điều phối giải**: stepper giai đoạn. Nút bước kế tiếp mở modal **xem trước** (gọi `?dryRun=1`: số cặp/ván sẽ tạo, đội đạt/trượt, hạt giống), ô lý do có sẵn gợi ý, rồi xác nhận.
  3. **Nhánh đấu** (mới): dùng lại `SwissRounds`/`KnockoutTree`, thêm thông tin chỉ admin thấy (job đang chạy, ván lỗi, nút chạy lại ván). Có nút "Mở trang công khai" và "Mở màn trình chiếu".
  4. Đội, Bài nộp, Trận, Cờ gian lận, Runner & job, Chờ duyệt, Thông báo, Audit: chuyển tương đương 1-1 sang React; bảng có tìm kiếm và phân trang (100 đội).
- Dry-run: `step()` trong `tournament-routes.mjs` nhận `dryRun` và trả `plan.summary` mà không chạy batch hay ghi audit. Engine đã tách sẵn `plan*` → `statements`, nên việc này nhỏ.
- Biến mới `PUBLIC_WEB_ORIGIN` (URL web người chơi) cho link công khai.
- Test: `npm run test:bot-cup` (API) cùng một ít test component cho bracket (render 16 đội, tên accessible). Không test nội bộ UI theo CLAUDE.md.

### 3.5 Sự kiện demo 100 đội và runner giả lập

- **Sự kiện riêng** `showcase-100` trên D1 staging, như cách `rehearsal-demo` đang làm, để không đụng sự kiện đăng ký thử. Mode `demo`, `config_json.knockoutSize = 16`. Thêm env `showcase` cho `apps/bot-cup-api` và `apps/bot-cup-admin` (`ADMIN_AUTH_MODE=demo`).
- `scripts/bot-cup/showcase.mjs`:
  - `seed`: ghi thẳng vào D1 100 đội (tên tiếng Việt sinh sẵn, ví dụ "Đội Sao Băng 042"), mỗi đội có thành viên ảo với MSSV tiền tố `99` để không trùng người thật, và một bài nộp. Bài nộp là template Python/JS của SDK kèm một dòng chú thích `strategy=<tên>` để mỗi đội có SHA-256 khác nhau. Đặt `code_freeze_at` sau N phút.
  - `reset`: xoá sạch dữ liệu `showcase-100` (chỉ sự kiện này). Không dùng được trên production; script kiểm tra tên DB như `rehearsal.mjs`.
- **Runner giả lập** (`apps/bot-cup-runner`, cờ `BOT_CUP_RUNNER_SIMULATE=true`):
  - Kéo job qua đúng `/runner/claim` → `/runner/complete` bằng token runner. Worker vẫn chơi lại replay bằng `verifyReplay` nên kết quả là thật theo luật.
  - Job `check`: trả đạt ngay. Job ván: chọn chiến lược theo `sha256` của bài (map cố định), đánh trong process bằng `house-bots.mjs`/`ai.js`. Có khoảng 6 mức mạnh (random, greedy, easy, medium, minimax giới hạn nút ...) để bảng xếp hạng có phân hoá và vẫn có ván bất ngờ.
  - Chạy song song K ván. Từ chối chạy nếu Worker không trả `eventId` thuộc danh sách cho phép (`showcase-100`, `rehearsal-demo`), để không bao giờ giả lập giải thật.
- Khối lượng: sơ loại 600 ván, Swiss 7 vòng × 50 cặp × 2 = 700 ván, loại trực tiếp 16 đội khoảng 15 cặp × 6 = 90 ván (cộng tie-break), tổng khoảng 1.400 ván. Cần đo ở P-D, mục tiêu cả giải chạy dưới 30 phút.
- **Rủi ro cần kiểm tra:** batch D1 khi tạo 600 ván sơ loại cùng lúc (giới hạn số statement mỗi batch: xem `bulkInsert`), và lượng ghi D1 trên gói miễn phí.

### 3.6 Không đổi

Luật cờ (`rules.js`), thể thức (sơ loại → vòng tròn/Swiss → phỏng vấn → loại trực tiếp), trigger bất biến của `entrants`/`stage_results`, hash chain audit, duyệt hai admin, các chế độ `access`/`password`.

## 4. Các giai đoạn

| Giai đoạn | Nội dung | Kiểm chứng |
| --- | --- | --- |
| **A. Nhánh N đội** ✅ | §3.1: `knockoutSize`, phỏng vấn Top 4 hạt giống, hạt giống 8/16, phỏng vấn hàng loạt, dry-run | `npm run test:unit` 1183+ pass; luồng Swiss 11 đội → nhánh 8 trên SQLite. Evidence: `docs/evidence/2026-10-26-bot-cup-showcase-a.md` |
| **B. Dữ liệu nhánh đấu** ✅ | §3.2: `qualifyingRounds`, `bracketView` (`rounds`, `bracket` trong admin/public view), kiểu gateway | Test API: public view không chứa MSSV/team id; cây 8 vẽ trống trước loại trực tiếp. Evidence: `docs/evidence/2026-10-26-bot-cup-showcase-b.md` |
| **C. Trang công khai** ✅ | §3.3: `KnockoutTree`, `SwissRounds`, ba mục kết quả, tự làm mới 15 s, `screen=bracket`, projector phím B, `knockoutSize` ở trang Thể lệ | 822 test web; xem bằng Playwright với dữ liệu 100 đội thật. Evidence: `docs/evidence/2026-10-26-bot-cup-showcase-c.md` |
| **D. Demo 100 đội** ✅ | §3.5: env `showcase`, `showcase.mjs seed/deploy/drive` (không có reset: bài nộp không xoá được, mỗi lần là sự kiện mới), runner giả lập | Staging `showcase-202610260422`: 1.136 ván, 11 phút, 0 lỗi, nhánh 16 chạy hết. Evidence: `docs/evidence/2026-10-26-bot-cup-showcase-d.md` |
| **E. Admin React** ✅ | §3.4: đủ 11 màn + Nhánh đấu, hộp thoại xem trước, tự chạy (demo), xoá trang cũ, tăng tốc view | 6 test admin; Playwright trên showcase; tự chạy 20 đội trong trình duyệt 226 s. Evidence: `docs/evidence/2026-10-26-bot-cup-showcase-e.md` |
| **F. Hoàn thiện** | Runbook (`docs/bot-cup/runbook.vi.md`) thêm mục demo; deploy staging/showcase; cập nhật `bot-cup-progress.md` và evidence `docs/evidence/2026-10-xx-bot-cup-showcase.md` | Checklist demo end-to-end |

Thứ tự: A → B → D chạy được sớm trên admin cũ để có dữ liệu thật, rồi C, E, F. Có thể làm C song song với D.

## 5. Quyết định (đã chốt)

1. **Admin React đặt ở đâu**: `apps/bot-cup-admin/web/`, import theme/UI/bracket từ `apps/web` bằng alias `@web` (mặc định).
2. **Sự kiện demo**: Worker env `showcase`; mỗi lần `seed` là một sự kiện `showcase-<giờ>` mới (bài nộp không xoá được).
3. **Tự động điều phối**: có, chỉ ở `ADMIN_AUTH_MODE=demo` và tài khoản admin (chủ dự án chốt 2026-10-26).
4. **Trang BTC cũ**: xoá trong cùng PR khi bản React đủ chức năng (chủ dự án chốt 2026-10-26).
