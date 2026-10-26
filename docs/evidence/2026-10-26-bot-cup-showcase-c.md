# Bot Cup showcase — giai đoạn C: trang nhánh đấu công khai

Ngày: 2026-10-26 · Nhánh: `feat/bot-cup-showcase-a` · Kế hoạch: [2026-10-26-bot-cup-admin-showcase.md](../superpowers/plans/2026-10-26-bot-cup-admin-showcase.md) §3.3

## Thay đổi

- `apps/web/src/features/bot-cup/bracket/` (mới):
  - `KnockoutTree`: mỗi vòng một cột (Vòng 1/8 → Tứ kết → Bán kết → Chung kết). Ô cao bằng nhau nên ô vòng sau nằm đúng giữa
    cặp ô vòng trước; đường nối bằng pseudo-element. Ô chưa có cặp vẽ nét đứt "Chờ đội". Đội thắng tô đậm, đội thua mờ, có ghi
    chú tie-break và "hạt giống" khi thắng nhờ hạt giống. Tranh hạng ba nằm dưới chung kết. Dưới 720 px thì các vòng xếp dọc,
    bỏ đường nối. Chế độ `large` (màn trình chiếu) chia đều chiều rộng sân khấu. Mỗi cặp là một nút có tên accessible đầy đủ
    ("Bán kết 1: Đội Alpha (hạt giống 1) 3 – 3 Đội Delta (hạt giống 4), đang đấu").
  - `SwissRounds`: chọn vòng (mặc định vòng mới nhất và tự theo vòng mới, trừ khi người xem đã chọn), tìm đội không dấu,
    bye, mở một cặp để xem từng ván và replay.
  - `PairingGames`, `bracketFormat` (nhãn vòng/ô, dòng mô tả ván) dùng chung.
- `TournamentPanel`: ba mục "Nhánh đấu" / "Vòng loại" / "Tài liệu & khiếu nại". Mục mặc định theo giai đoạn: loại trực tiếp
  hoặc kết thúc thì mở nhánh đấu; vòng loại hoặc phỏng vấn thì mở vòng loại. Tự làm mới mỗi 15 giây khi tab đang hiện và giải
  chưa kết thúc; nếu lần làm mới lỗi thì giữ dữ liệu cũ. Đây là HTTP tới `/api/t`, không phải PlayHTML.
- `?view=bot-cup&screen=bracket` mở thẳng Kết quả → Nhánh đấu (`App.tsx`, `BotCupScreen.initialTab`). Trang BTC sẽ link tới đây.
- `ProjectorScreen`: phím `B` hoặc nút "Nhánh đấu" hiện cả cây cỡ lớn; chọn một cặp trên cây là chiếu cặp đó.
- `GET /api/t/event` trả `knockoutSize`; trang Thể lệ ghi "Top {knockoutSize}". Vòng loại được mô tả theo số đội (≤ 10 đội
  vòng tròn, đông hơn Swiss), đúng với code.

## Kiểm chứng

- Test (`TournamentPanel.test.tsx`, `ProjectorScreen.test.tsx`, `AppBotCup.test.tsx`): mở nhánh đấu mặc định khi đang loại
  trực tiếp, chọn cặp → các ván → replay; vòng loại: vòng mới nhất, đổi vòng, tìm đội, bye, mở ván; tự làm mới sau 15 s; tài
  liệu và SHA-256; khiếu nại; cây 16 ô vẽ trước khi đấu (16 ô có tên); dưới 4 đội; phím B và chọn cặp trên màn trình chiếu;
  link `screen=bracket`.
- `npm run test:web` 822 pass · `npm run typecheck:web` sạch · `npm run build:web` được · `npm run test:unit` 1186 pass.
- Kiểm tra bằng mắt với dữ liệu thật của `showcase-202610260422` (Vite local, `OTT_BOT_CUP_API_ORIGIN` = API showcase,
  Playwright): desktop tối/sáng 1440 px, điện thoại 390 px, chọn chung kết, vòng Swiss 7 (30 cặp), trình chiếu 1920×1080.
  Không trang nào tràn ngang. Đã sửa ba lỗi tìm được khi xem: cột chung kết bị cắt trên màn trình chiếu (cột cố định 300 px),
  tên đội bị cắt trong lưới Swiss 3 cột (giờ tối thiểu 380 px một cột), ô chồng lên nhau trên điện thoại (`flex: 1 1 0` co về 0).
- Đã deploy lại hai Worker showcase (`knockoutSize` có trong `/api/t/event`).

## Chưa làm

- Web staging trên Vercel vẫn trỏ `/api/t` vào Worker `staging`, không phải showcase, nên muốn xem demo 100 đội trên web cần
  Vite local hoặc đổi rewrite. Quyết định ở giai đoạn F.
