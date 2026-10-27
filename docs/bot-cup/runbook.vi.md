# OTT Bot Cup — runbook cho Ban tổ chức

Dành cho người vận hành giải (Demo). Kế hoạch gốc: [`docs/superpowers/plans/2026-10-23-uet-k71-bot-cup.md`](../superpowers/plans/2026-10-23-uet-k71-bot-cup.md)
(§7 thể lệ, §8 chống gian lận, §13.3 sự cố). Mọi thao tác ghi đều nằm ở **trang BTC** (tab ghi trong ngoặc); mỗi thao tác
đòi lý do và được ghi vào audit log có chuỗi băm.

## 1. Trước ngày khóa code

| Việc | Cách làm | Kiểm tra |
|---|---|---|
| Máy runner | Docker Desktop chạy; `docker image inspect ottv2-arena-runner:local --format {{.Id}}` ra đúng image đã qua bộ test cách ly | `npm run test:arena:isolation` đạt trên chính máy đó |
| Token runner | `node scripts/bot-cup/runner-token.mjs <tên-máy> --env staging` (file trong `var/`, chỉ hash lưu D1) | Runner hiện **online** ở tab *Runner & job* |
| Bộ thế cờ bí mật | `npm run bot-cup:probe-set -- --count 100` trên máy runner; chép file sang **mọi** máy runner, không gửi đi đâu khác | Log runner có dòng `probe_sets` với 12 ký tự đầu của SHA-256 |
| JPlag | `var/bot-cup/jplag/jplag-6.2.0-jar-with-dependencies.jar` (Java 21) trên máy BTC | `java -version` |
| Hai admin | Ít nhất 2 người có quyền `admin` (loại đội, xác nhận vi phạm, sửa kết quả cần người thứ hai duyệt) | Tab *Chờ duyệt* mở được với cả hai |
| Chạy runner | `BOT_CUP_RUNNER_URL=… BOT_CUP_RUNNER_TOKEN_FILE=… ARENA_RUNNER_IMAGE_ID=… npm run bot-cup:runner` | Không để máy ngủ; tắt cập nhật tự động |

## 2. Trình tự ngày thi (tab *Điều phối giải*)

Mỗi bước chỉ chạy khi giai đoạn đúng và mọi ván của bước trước đã xong; nếu chưa, trang báo lý do (ví dụ “Còn ván chưa chấm xong (12 ván)”).

1. **Khóa code** (sau giờ khóa): niêm phong Bản thi đấu của mỗi đội, công bố danh sách SHA-256. Đội không có bản qua kiểm tra không vào giải.
2. **Chống gian lận** (tab *Cờ gian lận*), trong lúc vòng kiểm tra chạy:
   - *Xếp job vân tay* với SHA-256 của bộ thế cờ, phạm vi “Bài niêm phong”.
   - *Tải gói mã* (bài niêm phong) → trên máy BTC `npm run bot-cup:similarity -- --bundle <file>` → *Nhập báo cáo JPlag*.
   - Xem từng cờ: *Xem mã* (hai cột), replay; *Đã báo đội* khi đã liên hệ (đội có 48 giờ giải trình); *Bỏ cờ* hoặc *Xác nhận vi phạm* (admin thứ hai duyệt ở *Chờ duyệt*).
   - Vi phạm nặng (§8.8): đề nghị **loại đội** ở tab *Đội* (admin thứ hai duyệt). Đội bị loại không được ghép ở vòng sau; ván đã đấu vẫn tính cho đối thủ.
3. **Bắt đầu vòng kiểm tra** → chờ runner xong → **Chốt vòng kiểm tra** (công bố JSON + SHA-256).
4. **Bắt đầu vòng loại** (≤ 10 đội: vòng tròn tạo hết một lần; > 10: Swiss, mỗi vòng bấm *Tạo vòng Swiss kế tiếp*) → **Chốt vòng loại**.
5. **Phỏng vấn code**: chỉ 4 hạt giống đầu phải phỏng vấn, kể cả khi nhánh 8 hoặc 16 đội (`events.config_json.knockoutSize`, mặc định theo chế độ). Bấm *Đạt*/*Không đạt* từng đội, hoặc *Đạt tất cả … đội đang chờ phỏng vấn*. Đội trượt được thay bằng đội kế tiếp; hạt giống 5 trở xuống vào thẳng. Còn dưới 4 đội đạt thì *Kết thúc không cần loại trực tiếp*. Mỗi bước điều phối hiện phần *Xem trước* (số cặp, ván, cỡ nhánh) trước khi xác nhận.
6. **Bắt đầu loại trực tiếp** → sau mỗi vòng **Chốt vòng loại trực tiếp hiện tại** (hòa thì tự xếp 2 ván tie-break trên bản đồ bốc thăm, tối đa 2 lần, rồi hạt giống cao hơn đi tiếp) → kết quả chung cuộc công bố.
7. **Khiếu nại**: trả lời ở cuối tab *Điều phối giải* (đội có 12 giờ sau mỗi lần công bố, tối đa 3 lần/giai đoạn).

## 3. Trình chiếu ở hội trường

Mở `https://<web>/?view=bot-cup&screen=projector` trên máy nối máy chiếu, bấm *Toàn màn hình*. Màn hình mở vào Chung kết
nếu đã có, và tự tải lại dữ liệu mỗi 15 giây (vòng mới hiện ra không cần R; cặp đang chiếu được giữ nguyên).

| Phím | Tác dụng |
|---|---|
| Space | Phát / dừng |
| ← / → | Lùi / tiến một nước |
| Home / End | Về đầu / tới cuối ván |
| + / − | Tăng / giảm tốc độ (0,5× – 4×) |
| N / P | Ván kế / ván trước của cặp |
| ] / [ | Cặp kế / cặp trước |
| R | Tải lại dữ liệu (sau khi chốt một vòng) |

Ván chỉ phát được khi runner đã chấm xong; replay do API dựng lại bằng luật thật, không phát trực tiếp từ runner.

## 4. Sự cố

| Sự cố | Dấu hiệu | Xử lý |
|---|---|---|
| Máy runner tắt giữa vòng | Tab *Runner & job*: runner **offline**, job “đang chạy” không đổi | Không cần làm gì với job: lease hết hạn sau 5 phút thì job quay lại hàng đợi. Bật lại runner, hoặc tạo token cho máy thứ hai và chạy runner ở đó. Trễ lịch thì đăng thông báo (tab *Thông báo*) |
| Job lỗi hạ tầng 3 lần | Tab *Runner & job* → *Job lỗi* | Đọc “Lỗi cuối”; sửa nguyên nhân (Docker, mạng, thiếu bộ thế cờ trên máy) rồi *Đưa lại hàng đợi* |
| Runner bị đánh dấu nghi vấn | Cột *Nghi vấn* (replay bị Worker từ chối khi chơi lại bằng luật thật) | Dừng runner đó, kiểm tra image/mã runner; *Thu hồi* token nếu nghi bị sửa; *Bỏ nghi vấn* khi đã rõ |
| Một ván bị chấm sai do hạ tầng | Replay cho thấy lỗi không do bot | Tab *Trận* → *Chạy lại* (ván cũ bị hủy, ván mới cùng cặp/bản đồ/màu). Chỉ làm được **trước** khi chốt giai đoạn đó: khi tài liệu của giai đoạn đã công bố, *Chạy lại* và *Sửa kết quả* bị từ chối (`stage_published`), vì tài liệu không sửa được |
| Chấm sai hàng loạt | Nhiều ván cùng lỗi | Dừng runner; sửa; *Chạy lại* từng ván bị ảnh hưởng (chưa có nút chạy lại cả vòng); đăng thông báo |
| Email không tới | Đội báo không nhận OTP | Tab *Đội* → xác minh thủ công thành viên theo danh sách MSSV (có audit) |
| Bot nghi thoát sandbox | Log runner/Docker bất thường | Dừng runner (Ctrl+C), *Thu hồi* token, ngắt mạng máy đó, giữ log; đề nghị loại đội; chạy lại `npm run test:arena:isolation` trước khi dùng lại máy |
| Mất mạng ở hội trường | Trang chiếu không tải được | Chế độ runner offline (§7.6) **chưa làm** (mục [T]). Cách tạm: chấm và chốt vòng trước giờ chung kết khi còn mạng; ở hội trường dùng mạng di động cho máy chiếu (chỉ cần tải replay) |

## 5. Sau giải

- Tải JSON kết quả từng giai đoạn (tab *Điều phối giải* → *Tải JSON*), kiểm tra SHA-256 khớp trang công khai.
- `GET /admin-api/audit/verify` phải báo chuỗi băm hợp lệ; lưu bản xuất CSV đội và kết quả.
- Thu hồi token runner (`node scripts/bot-cup/runner-token.mjs <tên> --revoke --env …`), vô hiệu tài khoản admin tạm.

## 6. Demo 100 đội (staging, giả lập)

Dùng để trình diễn trang BTC và nhánh đấu với dữ liệu đầy đủ; **không** dùng cho giải thật. Đội và bài nộp là tổng hợp, mã đội
không chạy: runner giả lập đánh bằng AI trong game theo "sức mạnh" ghi ở đầu mỗi bài, Worker vẫn chơi lại từng replay bằng luật.

1. `npm run bot-cup:showcase -- seed --freeze-in 2`: tạo sự kiện mới `showcase-<giờ UTC>` (100 đội, nhánh 16) trên D1 staging.
   Bài nộp không xoá được nên mỗi lần demo là một sự kiện mới; sự kiện hiện tại ghi ở `var/bot-cup/showcase/current.json`.
2. `npm run bot-cup:showcase -- deploy`: deploy `ottv2-bot-cup-api-showcase` và `ottv2-bot-cup-admin-showcase` trỏ vào sự kiện đó,
   rồi trang công khai `ottv2-bot-cup-showcase-web` (bản build web có bật Bot Cup, chuyển `/api/t` sang API showcase).
   Lần đầu cần secret cho API: `OTP_PEPPER` (ngẫu nhiên ≥ 16 ký tự) và `TURNSTILE_SECRET` (khoá test `1x0000000000000000000000000000000AA`).
3. Runner giả lập (một lần: `node scripts/bot-cup/runner-token.mjs showcase-sim --env staging`):
   `BOT_CUP_RUNNER_URL=https://ottv2-bot-cup-api-showcase.opticsquang.workers.dev BOT_CUP_RUNNER_TOKEN_FILE=var/bot-cup/runner-token-showcase-sim.txt BOT_CUP_RUNNER_SIMULATE=true BOT_CUP_RUNNER_SLOTS=8 npm run bot-cup:runner`.
   Runner từ chối chạy giả lập với URL khác Worker showcase hoặc localhost, và từ chối mọi bài không có dòng sức mạnh.
4. Điều phối: bấm tay trên https://ottv2-bot-cup-admin-showcase.opticsquang.workers.dev (đăng nhập demo một bấm), bấm
   *Tự chạy tới hết* ở tab Điều phối giải (chỉ có ở chế độ demo), hoặc chạy `npm run bot-cup:showcase -- drive`. Hai cách tự
   động cùng một thứ tự bước, cho 4 hạt giống đầu đạt phỏng vấn. Tab *Nhánh đấu* có link sang trang công khai và màn trình chiếu.
5. Người xem: https://ottv2-bot-cup-showcase-web.opticsquang.workers.dev/?view=bot-cup&screen=bracket (nhánh đấu, các vòng Swiss,
   replay) và `&screen=projector` (trình chiếu; phím B hiện cả cây). Trang này chỉ phục vụ Bot Cup: chơi online báo không khả dụng.
6. Muốn trình diễn lại từ đầu: lặp lại bước 1–4. Sự kiện cũ vẫn nằm trong D1; muốn quay lại sự kiện cũ thì sửa `eventId` trong
   `current.json` rồi chạy lại bước 2.
