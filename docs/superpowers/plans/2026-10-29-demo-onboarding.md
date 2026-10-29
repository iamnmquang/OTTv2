# Banner Bot Cup gọn gàng hơn và làm nổi bật menu 🧭

Ngày: 2026-10-29. Trạng thái: đã làm, chưa merge và chưa deploy.

Phạm vi nhỏ, gồm hai việc. Không đụng luật, phòng hay session. Production không có menu demo, giữ như cũ.

## 1. Banner Bot Cup

Hiện banner ghi: "TRƯỜNG ĐẠI HỌC CÔNG NGHỆ · ĐHQGHN · BẢN THỬ NGHIỆM / OTT Bot Cup (staging) / Đang mở đăng ký · hạn chót
07:00 1 thg 1, 2027".

Sau khi sửa: "TRƯỜNG ĐẠI HỌC CÔNG NGHỆ · ĐHQGHN / OTT Bot Cup 2026 / Đang mở đăng ký · hạn chót 23:59, 31/12/2026".

- `BotCupBanner.tsx`: bỏ " · Bản thử nghiệm" khỏi dòng nhỏ phía trên tiêu đề.
- `botCupFormat.ts`: `formatDateTime` ra dạng `HH:mm, dd/MM/yyyy` (giờ VN).
- `apps/bot-cup-api/seeds/staging-event.sql`: tên `OTT Bot Cup 2026`, hạn đóng đăng ký 23:59 31/12/2026 giờ VN.
- `scripts/bot-cup/showcase.mjs`: tên `OTT Bot Cup 2026` thay cho `OTT Bot Cup · Demo 100 đội`.
- Email từ staging vẫn ghi "(staging)" (không đổi).

## 2. Làm nổi bật menu 🧭

- Nút có chữ **🧭 Khám phá demo**, nền xanh UET, không mờ. Màn hẹp vẫn giữ chữ vì chữ ngắn và vừa ở 390px.
- Nút nhấp nháy nhẹ và có bong bóng **"Bấm vào đây để xem các trang demo"** với mũi tên nhún chỉ xuống nút.
- Bong bóng tắt khi mở menu lần đầu hoặc bấm ✕, và trình duyệt nhớ để không hiện lại. Dùng `localStorage` bọc
  try/catch; không đọc được thì bong bóng vẫn hiện.
- Không có hiệu ứng động khi người dùng bật `prefers-reduced-motion`.
- Ẩn cả nút lẫn bong bóng trên màn trình chiếu, như hiện nay.
- Danh sách link trong menu giữ nguyên.

## Kiểm thử

- `DemoNav.test.tsx`: lần đầu có bong bóng, mở menu hoặc bấm ✕ thì bong bóng tắt và không hiện lại.
  `localStorage` ném lỗi thì không crash. Các test cũ (ẩn trên production, `Alt+K`, màn trình chiếu) vẫn qua.
- Sửa test có chuỗi ngày hay chuỗi banner nếu bị ảnh hưởng.
- Chạy `test:web`, `typecheck:web`, `test:admin`, `build:web`, `build:admin`. Xem bằng mắt ở 1280×800 và 390×844.

## Triển khai (sau khi merge)

Chạy lại seed staging D1, rồi CI deploy web staging. Chạy `npm run bot-cup:showcase -- deploy` và `wrangler deploy` cho
ba trang BTC.

## Kết quả (2026-10-29)

- Nhánh `feat/demo-onboarding` (tách từ `origin/main` @ `b85ed8a`). Sửa ở `BotCupBanner.tsx`, `botCupFormat.ts`,
  `staging-event.sql`, `showcase.mjs`, `apps/web/src/shared/demo-nav/` (bong bóng, mũi tên SVG, nút có chữ, 3 test mới).
- `npm run test:web`: 68 file, 833 test pass. `test:admin`: 8 pass. `typecheck:web`, `typecheck:admin` sạch.
  `build:web`, `build:admin` thành công. `npm test`: 1186 pass, 0 fail.
- Xem bằng Playwright trên Vite dev (cùng API Bot Cup local) ở 1280×800 sáng/tối và 390×844: banner không còn
  "Bản thử nghiệm", ngày dạng `17:39, 28/11/2026`; bong bóng và mũi tên chỉ đúng vào nút; không cuộn ngang.
- Chưa làm: chạy lại seed staging D1, deploy web/showcase/BTC.
