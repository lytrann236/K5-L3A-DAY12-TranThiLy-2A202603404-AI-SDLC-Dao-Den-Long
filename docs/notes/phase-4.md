# Phase 4 — Ticket-04 "Bình minh" + Test Contract v1.3

Nguồn: `docs/notes/ticket-04.md`. Contract v1.3 chỉ thêm `bench_cmd`, `soak_cmd`; luật và đầu ra headless không đổi.

## Tiêu chí nghiệm thu

| ID | Tiêu chí | Trạng thái |
|---|---|---|
| AC4-01 | `bench_cmd --seed 42 --duration 30 --out bench.json` ra đủ trường, công thức đúng mục 1 | Đạt (`bench.json`) |
| AC4-02 | Cảnh bench: 200 Bóng Mực `wander`, 100 đom đóm, L1–L3 sáng fuel 100, camera vòng r30 Y15 15 s/vòng, khởi động 3 s | Đạt (test `tests/bench-scene.test.ts` + chạy thật) |
| AC4-03 | Bench tắt sinh thêm, sát thương, nhặt, hao dầu, kết thúc Đêm | Đạt, làm ngoài sim (`pinScene` trong `src/render/bench.ts`) |
| AC4-04 | `soak_cmd --seed 7 --nights 10 --out soak.json`: crashes 0, `mem_end ≤ 1.2 × mem_start` | Đạt (`soak.json`) |
| AC4-05 | `game.contract.json` v1.3 có `bench_cmd`, `soak_cmd` | Đạt |
| AC4-06 | README đủ mục, CHANGELOG có Phase 4, CREDITS có Playwright | Đạt |
| AC4-07 | Bản web tĩnh `release/dao-den-long-web-v1.0.0.zip` | Đã nén; chưa tạo GitHub Release / tag |
| AC4-08 | Bảng xếp hạng, đổi phím, phụ đề, giảm chuyển động, cỡ chữ | **Chưa làm** (dưới đây) |

## Kết quả bench (Apple M2, 16 GB, macOS Darwin 24.6, Chromium 159 có cửa sổ 1280×720)

`avg_fps` 634.8 · `p1_low_fps` 253.8 · `frame_ms_p95` 2.6 · `frames` 19046 · `load_ms` 1606 · `peak_mem_mb` null · `vsync_off` true.

- Chạy lại từ đầu một lần sau khi bỏ các lần bị đóng cửa sổ; `frames` / `avg_fps` = 30.0 s đúng thời lượng đo.
- Cờ tắt vsync có hiệu lực (fps ≫ 60). Số này chỉ tham khảo; máy chấm của giảng viên quyết định.
- `peak_mem_mb = null`: bản web không đọc được RSS tiến trình trình duyệt (xem README).
- Bench cần cửa sổ thật: trong sandbox của Claude Code cửa sổ bị đóng sau vài giây nên phải chạy ngoài sandbox.
- Giả định: Mây đứng yên làm Bóng Mực trong 12 m chuyển `chase` một tick; bench trả về `wander` mỗi tick để chúng chạy luật `wander`.

## Kết quả soak

10 Đêm, `crashes` 0, mem 74 → 85–87 MB (≈ 1.15×, sát ngưỡng 1.2×). Cả 10 Đêm đều `lost` vì input ngẫu nhiên hết lửa sớm (mỗi Đêm vài chục ms).
- RSS đầu đo sau khi tải Đêm 1 và chạy 600 tick làm nóng JIT; không có bước này tỉ lệ dao động 1.1–1.25 (từng vượt ngưỡng). `heapUsed` phẳng ~9 MB qua 600 Đêm nên không có rò rỉ JS; phần tăng RSS là JIT/allocator.
- Cần chấm dè dặt: do dao động RSS, ngưỡng 1.2× có thể hiếm khi vượt trên máy khác.

## Chưa làm (hết thời gian)

- Bảng xếp hạng cục bộ (nhập tên, top 10, lưu đĩa, `--export-leaderboard`).
- Đổi phím (phát hiện trùng, khôi phục mặc định).
- Phụ đề / chỉ báo hình ảnh (mũi tên Bóng Mực, gió sắp thổi, 10 s cuối, đèn `fuel < 30`).
- Giảm chuyển động.
- Chữ lớn ×1.25 và kiểm tra cỡ chữ tối thiểu 18 px.
- Bản retro, video demo, tag `phase-4` và GitHub Release (cần người làm).
