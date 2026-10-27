# Bot Cup demo hardening — bằng chứng (2026-10-27)

Kế hoạch: [`docs/superpowers/plans/2026-10-27-bot-cup-demo-hardening.md`](../superpowers/plans/2026-10-27-bot-cup-demo-hardening.md)
(bản rút gọn đã duyệt). Nhánh `feat/bot-cup-demo-hardening`.

## Kiểm thử

| Lệnh | Kết quả |
|---|---|
| `node --test tests/bot-cup-tournament-flow.test.js tests/bot-cup-admin.test.js` | 15 pass, 0 fail |
| `npm run test:admin` | 8 pass (2 mới: vòng tự chạy thử lại lỗi tạm thời; dừng ở lỗi từ chối và khi quá số lần thử) |
| `npm run typecheck:admin` | sạch |
| `npm run test:web` | 68 file, 830 pass (2 mới ở `ProjectorScreen.test.tsx`) |
| `npm run typecheck:web` | sạch |
| `npm run build:web`, `npm run build:admin` | thành công |
| `npm test` | 1186 pass, 0 fail |

Test mới trong `tests/bot-cup-tournament-flow.test.js`: sau khi chốt vòng sơ loại, chạy lại và sửa kết quả ván sơ loại trả
`409 stage_published`, danh sách ván có `published: true`; trước khi chốt vòng loại, chạy lại một ván vẫn được và
`qualifying-close` chờ ván đó; đề nghị sửa kết quả gửi trước khi công bố chung cuộc, duyệt sau khi công bố bị từ chối và
kết quả không đổi; chạy lại ván loại trực tiếp sau khi kết thúc bị từ chối. `tests/bot-cup-admin.test.js`: chạy lại ván
đang `running` trả `409 match_running`.

## Showcase mới trên staging (Phần 0)

- `npm run bot-cup:showcase -- seed --freeze-in 2` → sự kiện `showcase-202610270654`, 100 đội.
- `npm run bot-cup:showcase -- deploy` từ nhánh này: API `2cb2b95e-057d-4709-9d26-70bc82fb4aec`, BTC
  `49de5546-baca-40e8-89b6-dd135ca90875`, web showcase `b4e91033-8c71-4b76-8928-0c623b6e9942`.
- Runner giả lập 8 slot và `npm run bot-cup:showcase -- drive`. Kết quả: 68/100 đội qua vòng kiểm tra, Swiss 7 vòng, nhánh
  16 đội. Tổng 1.192 ván (600 sơ loại, 476 Swiss, 116 loại trực tiếp). Vô địch Đội Lửa Đêm, nhì Đội Sao Đỏ, ba Đội Sấm Vàng,
  tư Đội Hổ Mai. Bốn tài liệu đã công bố: sealed, gate, qualifying, final.
- Vòng sơ loại mất khoảng 8,5 phút (600 ván), so với khoảng 3 phút ở lần showcase trước. Runner ghi hai `claim_failed:
  fetch failed` (07:05:53 và 07:08:50): khớp với T3 (lease mồ côi giữ ván 5 phút), chưa sửa trong bản rút gọn.
- `showcase.mjs drive` dừng một lần với `fetch failed` sau `qualifying-start`; chạy lại lệnh thì tiếp tục từ giai đoạn đang
  ở. Lệnh CLI chưa có thử lại như "Tự chạy tới hết" (chỉ sửa ở trang BTC).

## Kiểm tra trên bản đã deploy

- Đối chiếu nhánh đấu `/api/t/tournament` với `/api/t/results/final`: 16/16 cặp khớp điểm, số lượt tie-break và số ván;
  không còn ván chưa xong; `x-sha256` khớp nội dung.
- Trang BTC showcase: 116 ván loại trực tiếp đều `published: true`; `POST /admin-api/matches/:id/rerun` trên một ván chung
  kết trả `409 {"error":"stage_published","stage":"final"}`, đối chiếu lại sau đó vẫn khớp. Tab *Trận* hiện "Đã công bố"
  thay cho nút. Thao tác này để lại dòng `admin.login` của `btc-check@ottcup.test` trong audit.
- Màn trình chiếu `?view=bot-cup&screen=projector` ở 1920×1080 mở vào "Chung kết" (Đội Lửa Đêm 5 – 3 Đội Sao Đỏ).
