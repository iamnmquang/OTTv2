# Hướng dẫn viết bot — OTT Bot Cup

Bộ khởi đầu gồm:

| File | Dùng để |
|---|---|
| `bot.py` | Bot mẫu Python 3.12 (chỉ thư viện chuẩn) |
| `bot.mjs` | Bot mẫu JavaScript (Node 22, chỉ module dựng sẵn) |
| `judge.mjs` | Trọng tài chạy trên máy bạn: cho hai bot đấu với nhau, in kết quả, lưu replay |
| `GUIDE.vi.md` | Tài liệu này |

Bạn chỉ cần cài **Node 22** (để chạy trọng tài) và **Python 3.12** nếu viết bot Python.

## 1. Luật cờ tóm tắt

Luật đầy đủ: `Rule.md` trong repo của giải.

- Bàn **a×a**: ban đầu a = 9, nhưng **a có thể đổi giữa các giai đoạn của giải** (a nguyên từ 9 đến 25, được công bố trước
  mỗi giai đoạn). Tọa độ `x` là cột (0 = A …), `y` là hàng (0 = 1 …), cả hai chạy từ 0 đến a − 1. **Đừng viết cứng 9 hay 8 trong bot.**
- Hai ghế: **A (Đỏ)** đi trước, **B (Xanh)** đi sau. Mỗi bên có 10 quân thuộc 3 loại: `dam` (Đấm), `la` (Lá), `keo` (Kéo).
- Mỗi lượt đi **một** quân **1 ô theo 8 hướng**. Không vào ô có quân mình, không vào ô có quân đối phương **cùng loại**.
- Đi vào ô có quân đối phương khác loại: Đấm ăn Kéo, Kéo ăn Lá, Lá ăn Đấm. Đi vào quân mà mình thua là **nước không hợp lệ**.
- Thắng khi: đưa một quân vào **ô thắng của mình** (A: `(0,0)`, B: `(a−1,a−1)`, tức góc đối diện), hoặc đối phương hết quân, hoặc sau nước của bạn
  đối phương không còn nước hợp lệ.

Bạn **không bắt buộc** tự cài luật: trọng tài gửi sẵn danh sách nước hợp lệ.

## 2. Giao thức

Bot là một chương trình đọc stdin và ghi stdout. Mỗi lượt của bot, trọng tài gửi **một dòng JSON**:

```json
{"protocolVersion":1,"type":"turn","requestId":"…","ply":1,"turn":"A","boardWidth":9,"boardHeight":9,
 "goals":{"A":{"x":0,"y":0},"B":{"x":8,"y":8}},"timeRemainingMs":30000,"turnTimeLimitMs":500,
 "board":[{"id":"A-dam-1","owner":"A","type":"dam","x":5,"y":6}, …],
 "legalMoves":[{"from":{"x":5,"y":6},"to":{"x":4,"y":5}}, …]}
```

Bot trả lời **một dòng JSON** (nhớ xuống dòng và flush):

```json
{"protocolVersion":1,"requestId":"<giữ nguyên requestId vừa nhận>","move":{"from":{"x":5,"y":6},"to":{"x":4,"y":5}}}
```

- `boardWidth` / `boardHeight` là kích thước bàn a của ván này và `goals` là ô thắng của hai ghế. **Đọc chúng từ input mỗi lượt**
  (bot mẫu có sẵn hàm `board_size` / `goal_of`).
- `turn` là ghế của bot trong ván này. Hai ván của một cặp đấu đổi màu, nên bot phải chơi được cả A lẫn B.
- **Mọi log ghi ra stderr.** In bất cứ thứ gì khác ra stdout là sai giao thức và bị xử thua.
- Bot chạy suốt ván (một tiến trình cho cả ván), nên có thể giữ dữ liệu giữa các lượt.

## 3. Thời gian và giới hạn

| | Giới hạn |
|---|---|
| Mỗi nước | 500 ms |
| Quỹ mỗi bot mỗi ván | 30 s |
| Nước đầu tiên (gồm khởi động) | Máy chấm cho tối đa 5 s, không trừ quỹ. `judge.mjs` hiện vẫn tính nước đầu như nước thường (500 ms) |
| Số nước tối đa | Máy chấm: 300 (hết thì hòa). `judge.mjs`: 400 |
| Tài nguyên | 1 CPU, 256 MiB RAM, không có mạng, không ghi được ra ngoài `/tmp/scratch` |

Quá giờ, bot dừng, trả lời sai định dạng hay đi nước không hợp lệ đều **thua ván đó**.

## 4. Chạy thử trên máy

```bash
node judge.mjs bot.py easy                 # 2 ván với AI "Dễ" trên bản đồ classic, đổi màu
node judge.mjs bot.py easy --maps all      # 6 ván: 3 bản đồ × 2 màu, giống vòng kiểm tra
node judge.mjs bot.py bot.mjs --verbose    # hai bot của bạn, in stderr của bot
node judge.mjs bot.py hard --replays out   # lưu replay JSON từng ván vào thư mục out/
node judge.mjs bot.py easy --size 13       # bàn 13×13 (a từ 9 đến 25): thử xem bot có còn đúng khi a đổi không
```

House bot có sẵn: `first-legal`, `easy`, `medium`, `hard` (AI trong game), `sentinel`, `strategist`.
Với `--size` khác 9 chỉ dùng được `first-legal`, `easy`, `medium`, `hard` (`sentinel` và `strategist` chỉ chơi bàn 9×9).
Hãy thử bot của bạn ở vài cỡ bàn khác nhau trước khi nộp.

`judge.mjs` kiểm tra cú pháp trước khi chạy (giống máy chấm: `py_compile` / `node --check`). Khi bot thua vì lỗi, trọng tài
in 10 dòng stderr cuối cùng của bot.

Lưu ý: trên máy bạn, bot chạy thẳng như một chương trình bình thường. Máy chấm chạy bot trong container không có mạng.

## 5. Nộp bài

- Nộp **một file** `.py` hoặc `.js` / `.mjs`, tối đa 200 KB, mã hóa UTF-8, trên trang đội của giải.
- JavaScript luôn chạy dưới dạng **ES module**: dùng `import`, không dùng `require` (cần thì `import { createRequire } from "node:module"`).
- Mỗi đội nộp tối đa 10 lần mỗi ngày. Mỗi phiên bản có mã SHA-256: đó là biên nhận của bạn.
- Bản thi đấu mặc định là phiên bản hợp lệ mới nhất; bạn có thể chọn phiên bản khác cho tới lúc khóa code.
- Mã phải đọc được: không làm rối mã, không nhúng payload mã hóa rồi `exec`/`eval`. Bảng tra cứu dạng dữ liệu thì được.
- Được dùng trợ lý AI khi viết code, nhưng đội phải hiểu và giải thích được code (Top 4 có phỏng vấn).
  Nộp lại hoặc dịch `ai.js`, bot mẫu của giải rồi nhận là của mình là **đạo văn**.

## 6. Lỗi thường gặp

| Hiện tượng | Nguyên nhân |
|---|---|
| Thua vì "trả lời sai định dạng" | `print()` / `console.log()` ra stdout để gỡ lỗi. Dùng `log()` (stderr) |
| Thua vì "quá 500 ms một nước" | Tìm kiếm quá sâu. Đo thời gian và dừng sớm, trả về nước tốt nhất đã có |
| Thua vì "bot dừng hoặc lỗi khi chạy" | Exception chưa bắt, hoặc thiếu `flush` nên trọng tài không nhận được dòng trả lời |
| `require is not defined` | File JS chạy dạng ES module, xem mục 5 |

## 7. Gợi ý thuật toán

1. **Tham lam**: ưu tiên nước vào ô thắng, nước ăn quân, nước tiến gần ô thắng; tránh ô mà quân đối phương ăn được ngay.
2. **Minimax** độ sâu 2–3 với hàm đánh giá (số quân, khoảng cách tới ô thắng, quân bị đe dọa).
3. **Alpha-beta** + sắp xếp nước + đào sâu dần theo thời gian còn lại (iterative deepening).
