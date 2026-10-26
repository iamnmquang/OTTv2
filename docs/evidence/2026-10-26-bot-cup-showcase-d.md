# Bot Cup showcase — giai đoạn D: demo 100 đội với runner giả lập

Ngày: 2026-10-26 · Nhánh: `feat/bot-cup-showcase-a` · Kế hoạch: [2026-10-26-bot-cup-admin-showcase.md](../superpowers/plans/2026-10-26-bot-cup-admin-showcase.md) §3.5

## Thay đổi

- `apps/bot-cup-runner/src/simulate.mjs`: executor giả lập (cùng giao diện `runCheck`/`runMatch`/`runProbe`). Ván được đánh
  trong process bằng `ai.js` mức medium theo "sức mạnh" ghi trong bài (`ott-showcase strength=0.73`), các nước còn lại là
  nước hợp lệ ngẫu nhiên. Đồng hồ giả lập (40 ms/nước); trọng tài là Arena match controller với `bot-cup-policy-v1`; kết quả
  gửi về là replay gọn như runner thật. Bài không có dòng sức mạnh thì bị từ chối (lỗi hạ tầng), tức là không bao giờ
  giả lập bài của đội thật. Probe không giả lập.
- `apps/bot-cup-runner/src/main.mjs`: `BOT_CUP_RUNNER_SIMULATE=true` thì không cần Docker hay image ID; chỉ chạy được với URL
  Worker showcase hoặc localhost (`SIMULATE_URL`).
- `scripts/bot-cup/showcase.mjs` (`npm run bot-cup:showcase`): `seed` (sự kiện mới `showcase-<giờ UTC>`, 100 đội, mỗi đội một
  bài ready, `knockoutSize: 16`), `deploy` (hai Worker showcase với `--var BOT_CUP_EVENT_ID`), `drive` (tự bấm mọi bước;
  `driveEvent` dùng chung với test).
  - Bài nộp được ghi thẳng vào D1, không tải qua API: tải 100 file gần giống nhau sẽ làm mọi đội bị cờ "chép template" (chuẩn
    hoá bỏ comment và hằng số).
  - Không có `reset`: trigger `submissions_keep` chặn DELETE, nên mỗi lần demo là một sự kiện mới, không đụng tới lớp bảo vệ
    của DB staging dùng chung.
- `apps/bot-cup-api/wrangler.jsonc`, `apps/bot-cup-admin/wrangler.jsonc`: env `showcase` (D1 staging, admin `ADMIN_AUTH_MODE=demo`,
  API không đặt `BOT_CUP_RUNNER_IMAGE_ID`). Secret của API showcase: `OTP_PEPPER` (ngẫu nhiên), `TURNSTILE_SECRET` (khoá test).
- `tests/bot-cup-showcase.test.js` (nằm trong `test:bot-cup`), `docs/bot-cup/runbook.vi.md` §6.

## Đo đạc trước khi chạy

Điểm trung bình một ván khi đánh với bot nhà easy (12 ván mỗi mức): sức mạnh 0.5 → 0.25; 0.7 → 0.67; 0.8 → 0.83. Mức `hard`
mất ~2 s/ván nên bỏ; medium ~30 ms/ván.

## Chạy thật trên staging (2026-10-26, sự kiện `showcase-202610260422`)

Runner giả lập (8 slot) chạy trên máy dev, nối `https://ottv2-bot-cup-api-showcase.opticsquang.workers.dev`; `showcase.mjs drive`
gọi `https://ottv2-bot-cup-admin-showcase.opticsquang.workers.dev`. Log: `var/bot-cup/showcase/{drive,runner}.log` (ngoài git).

| Mốc | Thời điểm | Ghi chú |
| --- | --- | --- |
| Khóa code | 64 s | 100 bài niêm phong, 0 đội thiếu bài (chờ giờ khóa) |
| Sơ loại | 65 → 294 s | 600 ván; **60/100** đội đạt → Swiss |
| Swiss | 295 → 545 s | 60 đội, 7 vòng (bản đồ xoay classic/flanks/center), ~35 s/vòng |
| Phỏng vấn | 547 s | 4 hạt giống đầu: đạt (phỏng vấn hàng loạt) |
| Loại trực tiếp | 550 → 670 s | **nhánh 16**: R16 → QF (tie-break QF4) → SF → F + tranh hạng 3 (tie-break cả hai, hạng 3 hai lần) |
| Kết thúc | 671 s | công bố đủ 4 tài liệu: sealed, gate, qualifying, final |

- Tổng **1.136 ván** trong **11 phút 11 giây**; 0 `job_infrastructure_error`, 0 `job_report_refused`, 0 lỗi claim. Mọi replay
  được Worker chơi lại bằng luật trước khi ghi.
- Cây cuối: R16 8/8, QF 4/4, SF 2/2, F + 3RD 2/2 đều có đội thắng; `rounds` có đủ 7 vòng Swiss. JSON công khai không chứa
  team id hay MSSV (`showcase-2026…`, `9900…`).
- Phân hoá hợp lý: sức mạnh trung bình Top 16 là 0.88, các đội còn lại 0.81. Vô địch "Đội Phượng Đêm" (0.93). Có bất ngờ
  (hạng 6 sức mạnh 0.64) nên bảng không quá đoán trước.

## Khác với kế hoạch

- Ước tính ~1.400 ván và ~70 đội qua sơ loại; thực tế 60 đội qua (ngưỡng 4/6 điểm chặt hơn dự kiến), 1.136 ván.
- Nút bấm của sơ loại do mạng chứ không do CPU: ~2,6 ván/giây với 8 slot.

## Chưa làm

- Trang công khai cho sự kiện showcase: web staging (`/api/t`) đang trỏ Worker `staging`, chưa trỏ showcase. Giai đoạn C sẽ
  xem bằng Vite local với `OTT_BOT_CUP_API_ORIGIN=https://ottv2-bot-cup-api-showcase.opticsquang.workers.dev`.
