# Bot Cup showcase — giai đoạn F: deploy và trang công khai của demo

Ngày: 2026-10-26 · Nhánh: `feat/bot-cup-showcase-web` · Kế hoạch: [2026-10-26-bot-cup-admin-showcase.md](../superpowers/plans/2026-10-26-bot-cup-admin-showcase.md)

## Deploy sau khi merge PR #36, #37

- Web staging (Vercel) tự deploy từ `main` qua workflow Deploy: trang nhánh đấu công khai mới có trên https://ottv2-staging.vercel.app.
- Deploy tay từ `main` (`8a7d467`): `ottv2-bot-cup-api-staging`, `ottv2-bot-cup-admin-staging`, `ottv2-bot-cup-api-rehearsal`,
  `ottv2-bot-cup-admin-rehearsal`. Kiểm tra: trang BTC staging và rehearsal trả bản React (`assets/index-*.js`), `/admin-api/login`
  ở chế độ demo; `GET /api/t/event` của staging có `knockoutSize`.

## Trang công khai của demo 100 đội

Chủ dự án chọn (2026-10-26) Worker web riêng thay vì đổi web staging:

- `apps/bot-cup-showcase-web`: Worker `ottv2-bot-cup-showcase-web` phục vụ bản build web có bật Bot Cup
  (`npm run build:showcase-web`, chạy tự động qua `build.command`), SPA fallback, và chuyển `/api/t/*` sang
  `ottv2-bot-cup-api-showcase` qua service binding (`run_worker_first: ["/api/t/*"]`). Cùng origin nên cookie và kiểm tra origin
  của API như sau rewrite của Vercel. Không có Worker game: chơi online báo không khả dụng.
- API và trang BTC showcase: `BOT_CUP_WEB_ORIGIN` (và `BOT_CUP_ALLOWED_ORIGINS` của API) trỏ sang trang mới, nên nút
  "Mở trang công khai" trên trang BTC mở đúng sự kiện 100 đội.
- `showcase.mjs deploy` deploy cả ba Worker.

Kiểm tra trên Worker thật:
- `/` 200, đường dẫn lạ 200 (SPA), `/api/t/event` trả `showcase-202610260422` (100 đội, đã kết thúc), `/api/t/tournament` 0,9 s,
  bộ khởi đầu `/bot-cup-kit/GUIDE.vi.md` 200.
- Playwright: `?view=bot-cup&screen=bracket` hiện cây 16 đội; chọn Chung kết → "Xem replay" mở replay ván 1 (68 nước) trên bàn
  cờ của app. Lỗi duy nhất trong console là 401 của `/api/t/me` khi chưa đăng nhập (đúng).
- Trang BTC showcase: link "Mở trang công khai" = `https://ottv2-bot-cup-showcase-web.opticsquang.workers.dev/?view=bot-cup&screen=bracket`.

## Địa chỉ demo

- BTC: https://ottv2-bot-cup-admin-showcase.opticsquang.workers.dev (đăng nhập demo một bấm)
- Người xem: https://ottv2-bot-cup-showcase-web.opticsquang.workers.dev/?view=bot-cup&screen=bracket
- Trình chiếu: https://ottv2-bot-cup-showcase-web.opticsquang.workers.dev/?view=bot-cup&screen=projector

## Còn lưu ý

- Trang BTC staging, rehearsal và showcase đều ở `ADMIN_AUTH_MODE=demo`: ai có link cũng vào được với quyền admin. Đổi lại
  `password` hoặc `access` trước khi dùng cho giải thật.
- Production không đổi; không có tag `v*`.
