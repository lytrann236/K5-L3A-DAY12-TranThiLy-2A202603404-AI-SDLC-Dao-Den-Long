# Changelog

## Phase 4 — Ticket-04 "Bình minh" (Test Contract v1.3, Release v1.0.0)

### Breaking changes
- `contract_version` "1.3"; `game.contract.json` thêm `bench_cmd` và `soak_cmd`. Tuning và đầu ra headless không đổi.

### Thêm
- Benchmark `scripts/bench.ts` + chế độ `?bench=1` (cảnh chuẩn 200 Bóng Mực / 100 đom đóm, camera vòng) → `bench.json`.
- Soak test `scripts/soak.ts` (10 Đêm liên tiếp, input ngẫu nhiên theo seed) → `soak.json`.
- README đầy đủ; bản web tĩnh `release/dao-den-long-web-v1.0.0.zip` (không commit, đính vào Release).

### Chưa làm (hết thời gian)
- Bảng xếp hạng cục bộ và `--export-leaderboard`; đổi phím; phụ đề / chỉ báo hình ảnh; giảm chuyển động; chữ lớn ×1.25. Chi tiết: `docs/notes/phase-4.md`.

## Phase 3 — Ticket-03 "Đèn cạn dầu" (Test Contract v1.2)

### Breaking changes
- `contract_version` "1.2"; `night1/2/3_duration_s` 300/330/360 → **240/270/300**.
- Không còn thắng sớm khi thắp đủ đèn; `game_over.reason` `all_lit` bị bỏ, thêm `dawn_survived` (thắng ở bình minh khi đèn sáng ≥ `ceil(0.6 × tổng)`).
- Công thức điểm thay toàn bộ: `per_mote` 10 → 5, thêm `per_relight`, `per_stun_drain`, `per_lit_at_dawn`; bỏ `per_second_left`.
- Bóng Mực `wander` không còn đứng yên (đi về đèn yếu / đèn tắt); thêm trạng thái `drain`.
- Đèn `fuel < 30` mất vùng an toàn.
- Snapshot: đèn thêm `fuel`, `ever_lit`, `relit_count`; `player` thêm `capacity`.
- Sự kiện `lantern_lit` thêm `relight`; sự kiện mới `refuel`, `lantern_out`, `fuel_drain`.
- Sức chứa túi không còn cố định 10: `min(20, 10 + 2 × successful_lights)`.

### Thêm
- Nhiên liệu đèn (hao 1/s, châm dầu, tắt, thắp lại 5 đom đóm); scenario `lanterns[].fuel/ever_lit`, `player.successful_lights`, `shades[].target_lantern_id`.
- UI: thanh dầu trên đèn sáng, nhấp nháy 1 Hz khi `fuel < 30`; HUD `đang mang / sức chứa`.
- ADR `docs/adr/0001-nhien-lieu-den-va-luat-thang.md`.

### Chưa làm
- Chế độ mù màu "Bảng màu dễ phân biệt".

## Phase 2 — Ticket-02 "Ba hòn đảo" (Test Contract v1.1)

### Breaking changes
- Số chuẩn mới: nhặt 1 m, tương tác 2 m, đèn cần 10, Tỏa Sáng 3 đom đóm / r 5 3D, vùng an toàn 6 m, Bóng Mực 4.0 m/s; điểm cộng khi nạp thay vì khi nhặt.
- Trạng thái Bóng Mực `spawning | wander | chase | recoil | stunned`; snapshot thêm `night`, `wind`, `vel`, `grounded`, hồi chiêu, `motes`, `drifters`, `charms`; tham số `--night`.

### Thêm
- Nhảy, lướt, rơi khỏi đảo, tạm dừng; Đêm 2 (Đảo Cau: cầu, bục nhảy, Gió Lạc, Bùa Gió); Đêm 3 (Đảo Chuông: tầng, dốc, tháp, gió mạnh); menu 3 Đêm.

## Phase 1 — PRD-0 (Test Contract v1.0)

### Thêm
- Sim tất định 60 tick/s, headless CLI (snapshot / event / end JSONL), 1 đảo 5 đèn, đom đóm, Bóng Mực, Tỏa Sáng, vùng an toàn, thắng/thua; giao diện Three.js cơ bản.
