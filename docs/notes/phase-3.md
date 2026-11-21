# Phase 3 — Ticket-03 "Đèn cạn dầu" + Test Contract v1.2

Nguồn: `docs/notes/ticket-03.md` (BẮT BUỘC chính xác). Tuning đọc từ `game.contract.json` (v1.2). Mọi luật Phase 2 (`docs/notes/phase-2.md`) không bị ticket-03 thay thế vẫn giữ nguyên. Quyết định thiết kế: `docs/adr/0001-nhien-lieu-den-va-luat-thang.md`.

## 1. Luật bị thay thế `[THAY THẾ]` (cũ → mới)

| Luật | Phase 2 (v1.1) | Phase 3 (v1.2) |
|---|---|---|
| Đèn đã sáng | Sáng mãi, không nhận thêm đom đóm | Có `fuel` 0–100; hao 1/s; châm dầu bằng Tương tác; `fuel ≤ 0` → tắt (`lantern_out`), `deposited = 0`, nhớ `ever_lit` |
| Chọn đèn khi Tương tác | Đèn chưa sáng gần nhất ≤ 2 m | Đèn **nhận được** (chưa sáng, hoặc sáng mà `fuel < 100`) gần nhất ≤ 2 m, hòa thì `id` nhỏ hơn |
| Giá thắp | 10 | Lần đầu 10; thắp lại (`ever_lit`) **5** |
| Vùng an toàn | Mọi đèn đã sáng, r 6 | Chỉ đèn sáng có `fuel ≥ 30`; `fuel < 30` mất vùng |
| Bóng Mực `wander` | Đứng yên tại chỗ | Đi tới đèn sáng `fuel < 30` gần nhất; không có thì về đèn tắt gần nhất; ≤ 2 m với đèn yếu → `drain` |
| Trạng thái Bóng Mực | 5 trạng thái | Thêm `drain` |
| Thắng | Ngay khi tất cả đèn sáng (`all_lit`) | Chỉ ở bình minh: còn sống và số đèn sáng ở tick cuối ≥ `ceil(0.6 × tổng)` (`dawn_survived`); không thắng sớm |
| Thời lượng Đêm 1/2/3 | 300 / 330 / 360 s | **240 / 270 / 300 s** |
| Sức chứa túi | 10 cố định | `min(20, 10 + 2 × successful_lights)` |
| Điểm | +10/đom đóm nạp, +100/đèn, +5/bóng choáng, +2/giây còn lại, +50/lửa | +5/đom đóm nạp (thắp, thắp lại, châm), +100 thắp lần đầu, +40 thắp lại, +5/bóng choáng (+15 nếu đang `drain`), bình minh khi thắng: +50 + floor(fuel) mỗi đèn sáng, +50/lửa; **bỏ** thưởng thời gian |
| `game_over.reason` | `all_lit` / `dawn` / `no_flames` | `dawn_survived` / `dawn` / `no_flames` (`all_lit` bỏ) |

## 2. Giả định (agent tự chốt theo chỉ đạo "chọn cách đơn giản")

### Nhiên liệu
- Lưu `fuel` bằng số nguyên đơn vị 1/60 (`fuelU`, tối đa 6000). Hao 1 đơn vị/tick; mỗi Bóng Mực `drain` hút 5 đơn vị/tick; châm 10 fuel = 600 đơn vị mỗi đom đóm. Xuất ra `fuel = round(fuelU / 6) / 10` (1 chữ số thập phân). Đèn tắt luôn `fuel: 0`.
- Châm dầu: `used = min(carried, ceil((6000 − fuelU) / 600))`, `fuelU = min(6000, fuelU + 600 × used)`. `used = 0` (đầy dầu) → đèn không được chọn. Mang 0 đom đóm → không có gì (không sự kiện).
- Sự kiện `refuel {lantern_id, amount: used, fuel}`; `fuel` là giá trị sau khi châm (1 chữ số).
- Thắp (lần đầu hoặc lại) vẫn nạp từng phần như Phase 2 (`deposit` rồi `lantern_lit` khi đủ). Đèn vừa tắt có `deposited = 0` và cần 5. Đèn đang tắt mà đã nạp dở vẫn giữ `deposited`.
- Bước 2: trừ hao (mọi đèn sáng) + hút (mọi bóng `drain` đang nhắm đèn đó, `safeTicks = 0`). Ngay sau đó đèn `fuelU ≤ 0` tắt: `lantern_out`, các bóng `drain` của đèn đó về `wander`.
- `fuel_drain {lantern_id, shade_id, fuel}`: mỗi bóng đếm số tick đã hút kể từ khi vào `drain`; phát ở tick hút thứ 60, 120, …; `fuel` sau khi trừ của tick đó. Thứ tự trong tick: `fuel_drain` (theo thứ tự mảng bóng) trước `lantern_out`.

### Bóng Mực
- `wander` (bước 8, sau xét phát hiện ≤ 12 m như cũ): mục tiêu = đèn sáng `fuel < 30` gần nhất (XZ, hòa `id` nhỏ); không có thì đèn tắt gần nhất; không có đèn nào thì đứng yên. Đi với tốc độ Bóng Mực của Đêm, dừng khi cách mục tiêu 2 m. Nếu sau khi đi cách đèn yếu ≤ 2 m → `drain` (bắt đầu hút từ bước 2 tick sau). Đây là **đổi so với Phase 2** (wander đứng yên).
- `drain`: đứng yên, không gây sát thương. Bước 8 xét theo thứ tự: Mây ≤ 6 m → `chase` (đuổi luôn tick đó); đèn tắt, `fuel ≥ 30` hoặc cách đèn > 2 m → `wander` (không đi trong tick đó).
- Châm dầu lên `≥ 30`: bóng `drain` của đèn đó về `wander` ngay ở bước 5; bước 6 (vùng an toàn, cơ chế đẩy 30 tick của Phase 2) đẩy mọi bóng trong r 6 ra mép, không gây sát thương trong lúc đẩy.
- Tỏa Sáng trúng bóng `drain` → `stunned`, +15 thay vì +5. Hết choáng → `wander`.
- Scenario `shades[].target_lantern_id`: đèn mà bóng `drain` đang hút. Bóng `drain` thiếu `target_lantern_id` → đèn gần nhất. Với trạng thái khác thì bỏ qua (wander chọn lại mỗi tick). `drain` không có `state_ticks_left`.

### Thắng / thua, sức chứa, điểm
- Bước 11: hết Ngọn Lửa → `no_flames` (luôn trước); hết giờ → đếm đèn sáng ở tick cuối: `≥ ceil(win_ratio × tổng)` → `won dawn_survived` + thưởng bình minh; không thì `lost dawn` (không thưởng).
- `successful_lights` tăng mỗi lần `lantern_lit` (cả thắp lại). Đèn đặt sẵn bằng scenario không tính. Scenario `player.successful_lights` đặt giá trị đầu. Sức chứa giảm không xảy ra (chỉ tăng trong Đêm).
- Khóa điểm trong `score` của contract: `per_mote 5`, `per_lantern 100`, `per_relight 40`, `per_stun 5`, `per_stun_drain 15`, `per_lit_at_dawn 50`, `per_flame_left 50`. `per_second_left` bỏ.

### Scenario / snapshot
- Đèn `lit: true` thiếu `fuel` → 100. `fuel` ∈ [0, 100]. Đèn `lit: true` luôn `ever_lit: true`. `fuel` của đèn không sáng bị bỏ qua (luôn 0). `deposited` ≥ giá thắp (10 hoặc 5 nếu `ever_lit`) → đèn sáng, `fuel` 100. `relit_count` đầu Đêm = 0.
- Snapshot: đèn thêm `fuel`, `ever_lit`, `relit_count` (sau `deposited`); `player` thêm `capacity` (sau `charm_s`). Bóng Mực không thêm trường.
- `lantern_lit {lantern_id, relight}`.

### Giao diện
- Thanh dầu trên đèn sáng; `fuel < 30`: đèn và thanh nhấp nháy 1 Hz (theo `sim_tick`). HUD `carried/capacity`.
- **Chế độ mù màu (mục 6 ticket): Chưa làm.**

## 3. Thứ tự xử lý một tick (bổ sung ticket-03 vào phase-2.md mục 4.3)

1 input + pause → 2 giảm bộ đếm **+ trừ dầu (hao + hút) → đèn `fuel ≤ 0` tắt** → 3 Mây di chuyển + rơi → 4 nhặt → 5 đèn (thắp / châm) → 6 vùng an toàn (chỉ đèn `fuel ≥ 30`) → 7 Tỏa Sáng → 8 Bóng Mực (wander/drain/chase…) + Gió Lạc → 9 chạm → 10 sinh → 11 thắng/thua (sau mọi cập nhật, kể cả tick bình minh) → 12 snapshot.

## 4. Tiêu chí nghiệm thu (AC3-xx)

U = unit test, S = scenario headless (`scenarios/manifest.txt`), P = ảnh giao diện.

| ID | Tiêu chí | Kiểm |
|---|---|---|
| AC3-01 | Thắp (lần đầu / lại) → `fuel 100`; đèn sáng hao 1/s (60 tick = −1.0) | U + S |
| AC3-02 | Châm dầu đúng công thức `used`, trừ `used` đom đóm, `refuel {lantern_id, amount, fuel}`, +5 × used | U + S |
| AC3-03 | Đèn đầy dầu không được chọn (chọn đèn nhận được kế tiếp, hoặc không có gì) | U + S |
| AC3-04 | `fuel ≤ 0` → tắt ngay sau bước 2, `deposited 0`, `lantern_out`, `ever_lit` true | U + S |
| AC3-05 | Thắp lại cần 5, `lantern_lit relight:true`, `relit_count` +1, +40 | U + S |
| AC3-06 | `fuel < 30` mất vùng an toàn; đúng 30 còn | U |
| AC3-07 | `wander` đi tới đèn sáng `fuel < 30` gần nhất (hòa id nhỏ); không có thì đèn tắt gần nhất | U + S |
| AC3-08 | ≤ 2 m → `drain`, hút 5/s cộng dồn với hao 1/s; nhiều con cộng dồn; `fuel_drain` mỗi 60 tick | U + S |
| AC3-09 | `drain` → `chase` (Mây ≤ 6 m), `stunned` (Tỏa Sáng, +15), `wander` (đèn tắt / fuel ≥ 30 / > 2 m) | U + S |
| AC3-10 | Châm lên ≥ 30 khi có bóng trong 6 m → đẩy ra mép trong 30 tick, không gây sát thương | U + S |
| AC3-11 | Thắng chỉ ở bình minh với số đèn sáng ≥ 3/5, 4/6, 5/7 (`dawn_survived`); thiếu → `lost dawn`; thắp đủ không kết thúc sớm | U + S |
| AC3-12 | Hết Ngọn Lửa ở tick bình minh → `no_flames` (ưu tiên) | U + S |
| AC3-13 | Sức chứa `10 + 2 × successful_lights` ≤ 20; snapshot `player.capacity`; scenario `successful_lights` | U + S |
| AC3-14 | Điểm bình minh: +50 + floor(fuel) mỗi đèn sáng, +50/lửa; không có thưởng thời gian | U + S |
| AC3-15 | Contract v1.2: khóa mới, thời lượng 240/270/300 (`time_left_s` tick 0) | U + S |
| AC3-16 | Snapshot v1.2: đèn `fuel` (1 chữ số), `ever_lit`, `relit_count`; scenario `fuel`, `ever_lit`, `target_lantern_id`; đèn `lit` thiếu `fuel` → 100 | U + S |
| AC3-17 | Tất định theo seed; 21.600 tick mỗi Đêm ≤ 30 s | S + perf |
| AC3-18 | UI: thanh dầu trên đèn sáng, nhấp nháy 1 Hz khi `fuel < 30`; HUD `carried/capacity` | P |
| AC3-19 | Chế độ mù màu | **Chưa làm** |

## 5. Test cũ bị luật mới làm sai (sửa / bỏ, không skip)

Mỗi chỗ sửa trong `tests/` có comment `Phase 3:` ghi lý do. Không có test nào bị `skip`.

| Test / scenario | Luật thay thế | Xử lý |
|---|---|---|
| `lanterns.test.ts` AC7 thắng `all_lit`; `ac07-win-all-lit` | Không thắng sớm | Viết lại: thắp đủ 5 đèn → vẫn `playing`; thắng chuyển sang test bình minh |
| `endgame.test.ts` thắng `all_lit`, thưởng `per_second_left` | Luật thắng mới, bỏ thưởng thời gian | Viết lại theo `dawn_survived` + thưởng bình minh |
| `ac2-16-noflames-beats-win` | Không thắng sớm | Đổi sang tick bình minh: đủ đèn nhưng hết lửa → `no_flames` |
| Điểm nạp `+10` (`ac06`, `lanterns.test`, …) | `per_mote` 5 | Sửa số |
| `time_left_s` 300/330/360 (`ac01`…, night-start) | 240/270/300 | Sửa số |
| `lantern_lit {lantern_id}` | Thêm `relight` | Sửa kỳ vọng |
| Snapshot đèn / player (so khớp nguyên chuỗi) | Thêm `fuel`, `ever_lit`, `relit_count`, `capacity` | Sửa kỳ vọng |
| Bóng `wander` đứng yên (`ac2-08`, `shades.test`, …) | `wander` đi về đèn | Sửa vị trí kỳ vọng hoặc đặt bóng sao cho kết quả không phụ thuộc |
| Túi đầy 10 (`ac05`, `motes.test`) | Sức chứa tăng dần | Giữ: `successful_lights = 0` → 10 |
| `nearestUnlit` | Chọn đèn nhận được | Đổi tên thành `nearestAccepting`, test theo luật mới |
| `lanterns.test` "chỉ xét đèn chưa sáng" | Đèn sáng chưa đầy được chọn | Sửa: đèn sáng (đã hao) được châm; thêm ca đèn vừa thắp (đầy) bị bỏ qua |
| `feedback.test` "đứng cạnh đèn đã thắp → không có đèn để nạp" | Đèn sáng nhận châm dầu | Sửa: bấm hợp lệ, không thông báo; câu thông báo đổi thành "chưa thắp hoặc chưa đầy dầu" |
| `endgame.test` "bóng sát Mây lúc thắp đèn cuối → thắng" | Không thắng sớm | Giữ ý "bước 6 đẩy trước bước 9", chuyển sang tick bình minh |
| `ac14b-spawn-determinism` 6000 tick | L1 hao dầu, < 30 ở tick 4200 thì mất vùng an toàn | Rút còn 4000 tick (fuel 33.3, vẫn an toàn) |
| `shades.test` AC2-58 (5 tên trạng thái) | Thêm `drain` | Thêm `drain` vào tập hợp lệ |

## 6. Bằng chứng

`scripts/proof.sh 3` → `docs/proof/phase-3/` (README, JSONL mọi scenario, `npm-test.txt`, `perf.txt`), ảnh `npm run shot -- docs/proof/phase-3/screenshots` (`11-fuel-bars.png`, `12-fuel-blink.png`). Hiệu năng: với seed 1 không scenario, Đêm kết thúc ở bình minh trước 21.600 tick (14.400 / 16.200 / 9.431 tick); chạy thêm 21.600 tick đầy đủ (time_left_s 400, bất tử, có drain) ≈ 0.4 s.
