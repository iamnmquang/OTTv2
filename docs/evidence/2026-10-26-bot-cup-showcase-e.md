# Bot Cup showcase — giai đoạn E: trang BTC bằng React

Ngày: 2026-10-26 · Nhánh: `feat/bot-cup-admin-react` · Kế hoạch: [2026-10-26-bot-cup-admin-showcase.md](../superpowers/plans/2026-10-26-bot-cup-admin-showcase.md) §3.4

## Thay đổi

- `apps/bot-cup-admin/web/` (mới): React 18 + Vite, dùng `apps/web/src/shared` (tokens, theme sáng/tối, Button, Badge, Dialog,
  Toast) và `features/bot-cup/bracket` qua alias `@web`. Build ra `apps/bot-cup-admin/public/` (git-ignored);
  `wrangler.jsonc` có `build.command = npm run build:admin` nên `wrangler deploy`/`dev` tự build. Font pixel của theme được
  copy vào build (CSP `default-src 'self'`, không CDN).
- Đủ 11 màn của trang cũ, cộng tab mới **Nhánh đấu**:
  - Tổng quan, Điều phối giải (stepper; mỗi bước mở hộp thoại có **Xem trước** từ `dryRun`, lý do bắt buộc; bước máy chủ từ chối
    thì hiện lý do và khóa nút), phỏng vấn (chỉ 4 hạt giống đầu, nút "Đạt tất cả"), bài niêm phong (tìm, phân trang), tài liệu,
    khiếu nại (trả lời trong hộp thoại).
  - **Nhánh đấu**: cùng `KnockoutTree`/`SwissRounds` với trang công khai, thêm trạng thái từng ván, nút **Chạy lại**, số ván
    xong/đang chạy/chờ/lỗi, link **Mở trang công khai** và **Mở màn trình chiếu** (`BOT_CUP_WEB_ORIGIN` → `/me.publicWebOrigin`).
  - Trận, Đội (lọc, chi tiết, đổi tên, loại đội), Bài nộp (xem mã), Cờ gian lận (so mã, JPlag, vân tay, bất thường), Runner & job,
    Chờ duyệt, Thông báo, Audit log. Bảng dài phân trang 50 dòng.
  - `window.prompt/confirm` thay bằng hộp thoại (focus trap, Esc); thông báo bằng toast; tab nằm trên URL (`#bracket`).
- **Tự chạy tới hết** (chỉ `ADMIN_AUTH_MODE=demo`, tài khoản admin): cùng thứ tự với `showcase.mjs drive`, chạy ở cấp app nên
  vẫn chạy khi chuyển tab; chip "Đang tự chạy · Dừng" trên header.
- Đã xoá `public/admin.js`, `admin.css`, `index.html` (logo chuyển sang `web/static/`).
- Engine: một view (admin/public) đọc mỗi tập dữ liệu một lần (cache chỉ sống trong view, các bước ghi không dùng); `adminView`
  chỉ tính tiến độ sơ loại khi đang ở giai đoạn sơ loại. Đo trên showcase 100 đội: `GET /admin-api/tournament` **5,8 s → 1,1–1,7 s**,
  `GET /api/t/tournament` 1,4 s → 0,7 s.
- CI: `build:admin`, `typecheck:admin`, `test:admin` trong job verify.

## Kiểm chứng

- `npm run test:admin` 6 pass: đăng nhập demo; hộp thoại bước có xem trước, cần lý do, gửi `{ dryRun }` rồi `{ reason }`;
  bước bị từ chối (games_pending) khóa nút; nhánh đấu và link công khai; nút tự chạy chỉ ở demo; phân trang 120 đội; logic
  `nextStep` (đóng vòng loại, phỏng vấn, chờ ván, kết thúc, lỗi quyền).
- `npm run test:unit` 1186 pass · `test:web` 822 pass · typecheck web/admin/worker sạch · `build:web`, `build:admin` được.
- Trên Worker showcase thật (Playwright): đăng nhập demo, Tổng quan, Điều phối, Nhánh đấu (chọn chung kết → 8 ván, chạy lại),
  Đội (100, phân trang), hộp thoại Sửa kết quả, giao diện sáng, điện thoại 390 px + menu. Không tràn ngang, không lỗi trang hay
  CSP (chỉ 401 của `/me` trước khi đăng nhập).
- **Tự chạy tới hết bấm trong trình duyệt** trên sự kiện `showcase-202610260534` (20 đội, runner giả lập): khóa code → sơ loại →
  Swiss 7 vòng → phỏng vấn → nhánh 8 → kết thúc trong **226 giây**, 276 ván, 0 lỗi job/replay. Sau đó Worker showcase được trỏ lại
  sự kiện 100 đội `showcase-202610260422`.

## Chưa làm

- Worker admin `staging`/`rehearsal` vẫn chạy trang cũ cho tới khi deploy lại sau khi merge (giai đoạn F).
