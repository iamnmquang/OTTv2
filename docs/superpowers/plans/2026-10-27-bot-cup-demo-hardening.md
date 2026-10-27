# Bot Cup: sửa các lỗi tìm thấy khi diễn tập demo tổ chức giải

Ngày: 2026-10-27. Trạng thái: **đã duyệt bản rút gọn**, đang làm.

## Phạm vi đã duyệt (27/10)

Demo sắp tới và không chạy giải trực tiếp (chỉ trình bày luồng và ý tưởng), nên chỉ làm:

1. Phần 1 (T2) đầy đủ.
2. Phần 3 tối thiểu: tự chạy thử lại lỗi tạm thời, hiện trạng thái; thông điệp `internal_error` (T8).
3. Phần 4 tối thiểu: trình chiếu mặc định Chung kết và tự hỏi lại dữ liệu mỗi 15 giây. Không làm chế độ theo dõi,
   kích thước bàn cờ, `progress` công khai.
4. Phần 0 (T1): Claude tự seed, deploy showcase và chạy giải trên staging sau khi Phần 1 qua test.

Để sau: Phần 2 (T3), phần còn lại của Phần 4, Phần 5. Q3: đồng ý chỉ khoá, đính chính để sau. Q4: giữ nguyên danh sách
đăng nhập demo.

## Bối cảnh

Buổi demo tập trung vào phần tổ chức giải. Ngày 27/10 đã diễn tập trọn một giải 100 đội bằng trang BTC (bấm tay từng bước,
và một lần bằng "Tự chạy tới hết"), trên bản sao cục bộ: D1 cục bộ, seed của `showcase.mjs`, admin chế độ demo, runner giả
lập. Đồng thời đọc dữ liệu showcase đang deploy (chỉ đọc). Kết quả:

- Luồng điều phối đúng: khóa code → sơ loại 600 ván → Swiss 7 vòng → phỏng vấn → loại trực tiếp có tie-break → kết thúc.
  Hộp xác nhận có xem trước, bắt ghi lý do; bước sai thời điểm bị chặn kèm lý do.
- Có 8 vấn đề (T1–T8), cộng 3 vấn đề Bot Cup từ đợt đánh giá trước (D3, D4, D6). Chi tiết và bằng chứng ở mục dưới.

## Vấn đề cần xử lý

| ID | Vấn đề | Bằng chứng | Mức |
|---|---|---|---|
| T1 | Showcase: tài liệu "Kết quả chung cuộc" ghi tranh hạng ba 4–6 (10 ván), nhánh đấu và trình chiếu hiện 4–5 và "Ván 9 · chưa đấu" | Audit #76 `match.rerun` lý do "test" ngày 26/10; ván mới ở trạng thái chờ, runner offline | P0 (demo) |
| T2 | "Chạy lại" được phép sau khi giai đoạn đã công bố, kể cả khi giải kết thúc; một người làm được, không cảnh báo. "Sửa kết quả" (hai người duyệt) cũng sửa được ván đã công bố | `rerunMatch`, `setMatchResult` trong `apps/bot-cup-admin/src/app.mjs` không xét giai đoạn | P1 |
| T3 | Một job "mồ côi" làm cả giải đứng 5 phút: `claim` ghi lease rồi mới dựng dữ liệu; lỗi giữa chừng hoặc mất phản hồi thì job giữ lease tới khi hết `leaseMs` | Diễn tập: `claim_failed 500` lúc 05:16:29, job `leased` tới 05:21:29; trang BTC chỉ hiện "1 Job đang chạy", không có nút xử lý | P1 |
| T4 | "Tự chạy tới hết" dừng hẳn ở mọi lỗi khác `games_pending`/`freeze_too_early` | Một lượt chạy dừng 5 lần, mỗi lần một 500 của `GET /tournament`; chỉ có toast "Tự chạy dừng: lỗi internal_error" | P1 |
| T5 | Màn trình chiếu không tự cập nhật, không đi theo vòng mới; mặc định mở cặp đầu của vòng cuối (tranh hạng ba thay vì chung kết); bàn cờ bị cắt ở 1920×1080 | Tab mở từ vòng loại vẫn "Chưa có cặp loại trực tiếp" khi giải đã xong; `ProjectorScreen.tsx` dòng 69–73 | P2 |
| T6 | Trang công khai không có tiến độ trong lúc chạy: vòng kiểm tra chỉ có "Đang đấu vòng kiểm tra" và cây "Chờ đội" | Ảnh diễn tập | P2 |
| T7 | Trang BTC giai đoạn vòng loại hiện 3 nút cùng lúc (cả "Bắt đầu vòng loại" đã làm), không có "vòng X/Y"; loại trực tiếp dùng một nhãn cho cả xếp tie-break và sang vòng | Ảnh diễn tập | P2 |
| T8 | Lỗi hiện mã thô "lỗi internal_error" trong hộp xác nhận và toast | Ảnh diễn tập | P3 |
| D4 | Trang đăng nhập demo của BTC liệt kê email cá nhân, ai có link cũng thấy (sẽ lên màn chiếu) | Trang BTC showcase | P2 |
| D6 | Bấm một cặp trong nhánh đấu: danh sách ván ở tít dưới cây; replay không có URL, "Về sảnh" về sảnh game thay vì nhánh đấu | Đánh giá ngày 27/10 | P3 |

Ghi chú: lỗi 500 trong diễn tập phần lớn do D1 cục bộ (Miniflare) quá tải khi ghi nhiều; tần suất trên D1 thật chưa đo. Cơ
chế của T3 và T4 đã xác nhận bằng code: một lần rớt mạng ở hội trường đúng lúc runner nhận việc hoặc trang BTC gửi lệnh là đủ.

## Quyết định đề xuất

| Vấn đề | Chọn | Lý do |
|---|---|---|
| T1 | Seed sự kiện showcase mới, deploy và chạy xong **trước** buổi demo, **sau khi** P1 (T2) đã deploy | Sạch nhất; sau T2 không ai chạy lại được ván của giai đoạn đã công bố nữa. Cách khác (bật runner cho ván chờ) có thể ra kết quả khác tài liệu đã công bố |
| T2 | Từ chối `rerun` và `set_result` khi giai đoạn của ván đã có tài liệu trong `stage_results` (`409 stage_published`) | Tài liệu đã công bố là bất biến (trigger `stage_results_keep`); kết quả hiển thị không được lệch với nó. Đính chính sau công bố để sau (câu hỏi Q3) |
| T3 | Ba lớp: `claim` tự trả lease khi lỗi; heartbeat gửi danh sách job đang chạy để máy chủ thả lease mồ côi; trang BTC có nút "Đưa lại hàng đợi" | Lớp 1 chặn lỗi phía máy chủ, lớp 2 chặn mất phản hồi (đứng tối đa khoảng 1 phút thay vì 5), lớp 3 là đường thoát bằng tay |
| T4 | Tự thử lại lỗi tạm thời (5xx, lỗi mạng) tối đa 5 lần, giãn cách 2–8 giây; hiện trạng thái ngay trong khung tự chạy | Giữ nguyên thứ tự bước; chỉ đổi cách xử lý lỗi |
| T5 | Trình chiếu hỏi dữ liệu mỗi 15 giây (như trang công khai), mặc định cặp Chung kết, chế độ "theo dõi" tự chuyển sang cặp mới cho tới khi người trình chiếu tự chọn | Hợp với cách dùng ở hội trường, không cần bấm R |
| T6 | Thêm `progress` vào view giải công khai: chỉ số đếm tổng (ván xong / tổng), không lộ kết quả từng đội trước khi công bố | Người xem thấy giải đang chạy; không đổi quy tắc công bố |
| D4 | Ở chế độ demo, chỉ liệt kê tài khoản có đuôi email cấu hình được (mặc định `@ottcup.test`) | Không phải xoá quyền của ai; chờ câu hỏi Q4 |

## Công việc

Mỗi phần là một PR riêng, theo thứ tự ưu tiên. Phần 0 là thao tác dữ liệu, không phải code.

### Phần 1 — T2: khoá ván của giai đoạn đã công bố

1. `apps/bot-cup-admin/src/app.mjs`: hàm `publishedStageOf(match)` ánh xạ `gate → gate`, `round_robin|swiss → qualifying`,
   `knockout → final`, rồi tra `stage_results`. `rerunMatch` và `setMatchResult` trả `409 stage_published` nếu đã có.
   `rerunMatch` cũng từ chối ván đang `running` (hiện vẫn xếp thêm ván mới, thành hai ván cùng chỗ).
2. Trang BTC tab *Trận*: ẩn hoặc vô hiệu "Chạy lại"/"Sửa kết quả" ở ván đã công bố, ghi "Đã công bố"; thêm thông điệp
   cho `stage_published`.
3. Runbook §4: ghi rõ chạy lại hoặc sửa ván chỉ làm được **trước** khi chốt giai đoạn đó.
4. Test (`tests/bot-cup-admin.test.js` hoặc `tests/bot-cup-tournament-flow.test.js`): chạy lại ván sơ loại trước khi chốt
   thì được; sau khi chốt thì 409; ván loại trực tiếp sau khi kết thúc thì 409; yêu cầu sửa kết quả ván đã công bố thì 409.

### Phần 2 — T3: không còn job mồ côi

1. `apps/bot-cup-api/src/runner/api.mjs` `claim`: nếu dựng dữ liệu cho các job vừa lease bị lỗi, trong một batch trả các
   job đó về `queued` (`attempts - 1`, xoá lease) và đưa `matches` về `queued`, rồi mới ném lỗi.
2. Runner (`apps/bot-cup-runner/src/runner.mjs`, `client.mjs`): heartbeat gửi thêm `activeJobIds` (mảng, tối đa
   `JOB_POLICY.maxClaim`). Máy chủ `heartbeat`: job đang `leased` cho runner này, không có trong danh sách và đã lease quá
   20 giây (tránh tranh chấp với phản hồi `claim` đang trên đường) thì trả về `queued`. Runner cũ không gửi trường này thì
   giữ cách cũ.
3. Trang BTC tab *Runner & job*: bảng "Job đang chạy" (loại, giai đoạn, runner, lease từ lúc, hết hạn lúc) và nút
   "Đưa lại hàng đợi" (ghi lý do, có audit) qua `POST /admin-api/jobs/:id/requeue`.
4. Test: `tests/bot-cup-runner-api.test.js` (claim lỗi giữa chừng thì job vẫn `queued`; heartbeat thiếu một job thì job đó
   được thả; job vừa lease dưới 20 giây thì giữ); `tests/bot-cup-runner.test.js` (heartbeat có `activeJobIds`); test admin
   cho requeue (có dòng audit, chỉ admin).

### Phần 3 — T4, T8: tự chạy bền hơn, thông điệp dễ hiểu

1. `apps/bot-cup-admin/web/src/autoRun.ts`: phân loại lỗi tạm thời (`AdminApiError` có status ≥ 500, lỗi mạng); thử lại
   tối đa 5 lần liên tiếp, giãn cách 2, 4, 8, 8, 8 giây; thành công thì đặt lại bộ đếm. Thêm `status` để giao diện hiện
   "Đang chờ 27 ván", "Lỗi tạm thời, thử lại 2/5", "Đã dừng: …".
2. `screens/Tournament.tsx`: hiện `status` trong khung "Tự chạy tới hết", không chỉ toast.
3. Thông điệp: `internal_error` → "Máy chủ lỗi tạm thời, thử lại sau vài giây" ở hộp xác nhận, toast và tự chạy.
4. Test (vitest admin): một lần 500 rồi thành công thì vòng lặp tiếp tục; 5 lần liên tiếp thì dừng với thông điệp tiếng
   Việt; `games_pending` vẫn là chờ.

### Phần 4 — T5, T6: trình chiếu và trang công khai đi theo giải

1. View giải công khai (`apps/bot-cup-api/src/tournament/`): thêm `progress = { stage, round, done, total }` cho giai đoạn
   đang chạy, chỉ số đếm.
2. `TournamentPanel.tsx`: dòng tiến độ ("Vòng kiểm tra: 412/600 ván", "Swiss vòng 3/7: 50/68 ván").
3. `ProjectorScreen.tsx`:
   - hỏi lại dữ liệu mỗi `TOURNAMENT_REFRESH_MS`;
   - mặc định chọn cặp `F` nếu có, rồi mới tới cặp đầu của vòng cuối;
   - chế độ theo dõi: khi có vòng mới thì chuyển sang cặp đầu chưa xong của vòng đó, chỉ khi không đang phát; tắt khi
     người trình chiếu dùng `]`/`[`/`B`, bật lại bằng phím `L`;
   - khi chưa có loại trực tiếp: hiện tiến độ thay vì màn trống;
   - kích thước bàn cờ theo chiều cao màn hình để vừa 1920×1080 và 1366×768.
4. Test: `ProjectorScreen.test.tsx` (mặc định chọn chung kết; timer giả và dữ liệu vòng mới thì tự chuyển; đã chọn tay thì
   không chuyển); `TournamentPanel.test.tsx` (hiện tiến độ); test API cho số đếm `progress`.

### Phần 5 — T7, D4, D6: gọn giao diện BTC và nhánh đấu

1. Tab *Điều phối giải*: ẩn bước đã làm ("Bắt đầu vòng loại" khi đã có thể thức); nút Swiss ghi "Tạo vòng Swiss 4/7"; dòng
   "Vòng hiện tại X/Y". Ở loại trực tiếp, nhãn theo xem trước: "Xếp tie-break …" hoặc "Sang vòng …".
2. D4: biến `ADMIN_DEMO_LIST_DOMAIN` (mặc định `ottcup.test`); danh sách đăng nhập demo chỉ gồm email có đuôi đó.
3. D6: chọn cặp trong nhánh đấu thì cuộn tới danh sách ván; replay mở từ nhánh đấu có nút "← Nhánh đấu" và trạng thái nằm
   trên URL (`&pair=…&game=…`) để Back của trình duyệt quay đúng chỗ.
4. Test admin và web tương ứng.

### Phần 0 — T1: làm lại dữ liệu showcase (sau Phần 1)

1. `npm run bot-cup:showcase -- seed --freeze-in 2`, `npm run bot-cup:showcase -- deploy`, chạy runner giả lập, rồi
   "Tự chạy tới hết" (runbook §6). Khoảng 15–20 phút.
2. Kiểm tra: mọi cặp trên `/api/t/tournament` khớp điểm và số ván với `/api/t/results/final`; nút "Kiểm tra SHA-256" báo
   "Khớp"; không còn "Ván đang chờ". Nếu được duyệt, thêm lệnh `showcase.mjs verify` làm việc này tự động.
3. Không bấm "Chạy lại" trên showcase sau khi đã chạy xong.

## Kiểm tra trước khi coi là xong

- `npm run test:bot-cup`, `npm run test:admin`, `npm run typecheck:admin`, `npm run test:web`, `npm run typecheck:web`,
  `npm run build:web`, `npm run build:admin`, `npm test`.
- Diễn tập lại cục bộ như ngày 27/10 (D1 cục bộ, seed showcase, admin demo, runner giả lập), bấm tay một lượt và tự chạy
  một lượt. Đạt khi: không đứng quá 1 phút vì một job; tự chạy không dừng vì lỗi tạm thời; màn trình chiếu mở từ đầu tự tới
  chung kết; trang công khai có tiến độ.
- Ghi kết quả vào mục "Kết quả" của file này và `docs/evidence/<ngày>-bot-cup-demo-hardening.md`.

## Câu hỏi cần bạn trả lời

- **Q1. Ngày demo?** Nếu gần: làm Phần 1, Phần 0, rồi bản tối thiểu của Phần 3 (thử lại) và Phần 4 (mặc định chung kết và
  tự hỏi dữ liệu). Các phần còn lại để sau.
- **Q2. Có chạy giải trực tiếp trong buổi demo không?** Không: Phần 2 và tiến độ công khai (Phần 4.1–4.2) giảm còn P2.
  Có: Phần 2 và Phần 3 là bắt buộc.
- **Q3. Sau khi công bố mà phát hiện sai thì sao?** Đề xuất: lần này chỉ khoá (T2); "tài liệu đính chính" (giai đoạn mới
  trong `stage_results`, hai người duyệt) làm sau nếu cần cho giải thật.
- **Q4. Email cá nhân trên trang đăng nhập demo:** lọc theo đuôi email (Phần 5.2) hay chỉ tắt tài khoản đó trên showcase
  (`scripts/bot-cup/admin-user.mjs … --disable`)? Lưu ý showcase, staging và rehearsal dùng chung D1 staging.
- **Q5. Phần 0:** tôi được tự seed, deploy showcase và chạy runner giả lập trên staging, hay bạn tự chạy?

## Kết quả (2026-10-27, bản rút gọn)

Bằng chứng: [`docs/evidence/2026-10-27-bot-cup-demo-hardening.md`](../../evidence/2026-10-27-bot-cup-demo-hardening.md).

- **Phần 1 (T2) — xong.** `requireUnpublished` trong `apps/bot-cup-admin/src/app.mjs`: chạy lại, đề nghị sửa kết quả và
  duyệt sửa kết quả đều trả `409 stage_published` khi tài liệu của giai đoạn đã công bố; chạy lại ván `running` trả
  `409 match_running`. `GET /matches` có `published`; tab *Trận* và *Nhánh đấu* của trang BTC hiện "Đã công bố" thay cho
  nút. Runbook §3 và §4 đã cập nhật.
- **Phần 3 tối thiểu (T4, T8) — xong.** `runAuto` trong `autoRun.ts`: thử lại lỗi 5xx và lỗi mạng sau 2, 4, 8, 8, 8 giây;
  khung tự chạy hiện "Đang chờ chấm xong N ván", "… Thử lại k/5…", và "Đã dừng: …" khi dừng. `internal_error`,
  `stage_published`, `match_running` có thông điệp tiếng Việt.
- **Phần 4 tối thiểu (T5) — xong.** Màn trình chiếu chọn cặp theo slot, mặc định Chung kết, tự tải lại mỗi 15 giây.
- **Phần 0 (T1) — xong.** Showcase mới `showcase-202610270654` đã chạy hết; nhánh đấu khớp tài liệu chung cuộc 16/16 cặp;
  trên bản deploy, chạy lại ván chung kết bị từ chối. Số liệu mới cho kịch bản demo: 68 đội qua vòng kiểm tra, 1.192 ván,
  vô địch Đội Lửa Đêm.
- **Quan sát thêm:** trên staging thật, runner gặp hai `fetch failed` khi nhận việc và vòng sơ loại chậm hơn lần trước
  khoảng 5 phút, khớp T3. Lệnh `showcase.mjs drive` không thử lại lỗi mạng (dừng một lần, chạy lại thì tiếp tục). Cả hai
  thuộc phần để sau.
- Còn lại: Phần 2 (T3), phần còn lại của Phần 4, Phần 5; thêm thử lại cho `showcase.mjs drive`.
