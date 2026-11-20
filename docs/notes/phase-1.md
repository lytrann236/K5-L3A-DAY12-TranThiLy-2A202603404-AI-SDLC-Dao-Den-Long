# Phase 1 — PRD-0 + Test Contract v1.0

Nguồn: PRD-0 trên lab board. Mọi con số ở đây khớp `game.contract.json` (nguồn duy nhất của tuning).

## 1. Giả định cho chỗ mơ hồ

### Đảo và đèn
- Đảo tròn bán kính **40 m**, tâm (0,0,0). `fall_enabled = false`: người chơi bị chặn ở mép đảo (kẹp vào bán kính 40), không rơi, không có sự kiện `fall`.
- 5 đèn L1…L5 mặc định nằm trên vòng tròn bán kính 22 m, góc 90° + 72°·k (k = 0…4): L1 ở (0,0,22).
- Mỗi đèn cần `lantern_cost = 5` đom đóm để thắp.

### Người chơi
- Xuất phát (0,0,0), `flames = 3` là "máu", `carried = 0`.
- Tốc độ `player_speed = 6 m/s` → mỗi tick đi 6/60 = 0.1 m khi `move` có độ dài 1.
- Nhảy: vận tốc đầu 6 m/s, trọng lực 20 m/s², chỉ nhảy khi đang chạm đất. Nhảy **không** né được Bóng Mực (khoảng cách đo theo XZ).

### Đom đóm (motes)
- `random_motes = true` (mặc định): sinh 30 con ngẫu nhiên theo seed, trong bán kính 38 m, cách gốc ≥ 3 m. Nhặt một con thì sinh con mới ở vị trí ngẫu nhiên (luôn có 30 con).
- `random_motes = false`: chỉ có các con trong scenario, không sinh lại.
- Nhặt **tự động** khi trong `pickup_radius = 1.5 m` và `carried < carry_capacity (10)`. Mỗi con: sự kiện `mote_picked`, +`per_mote` điểm. Đầy túi thì đom đóm nằm yên.

### Nạp đèn
- `interact` (sườn false→true): chọn đèn **chưa thắp** gần nhất trong `interact_radius = 3 m`.
- `amount = min(carried, lantern_cost − deposited)`. Nếu amount > 0: sự kiện `deposit`. Không cộng điểm khi nạp.
- Khi `deposited == lantern_cost`: đèn thắp, sự kiện `lantern_lit`, +`per_lantern`.

### Tỏa sáng (pulse)
- `pulse` (sườn false→true), cần cooldown = 0 **và** `carried ≥ pulse_cost (2)`. Không đủ thì không có gì xảy ra (không sự kiện).
- Trừ `pulse_cost` đom đóm đang mang. Mọi Bóng Mực trong `pulse_radius = 6 m` bị choáng `pulse_stun_s = 3 s` và bị đẩy ra xa `pulse_push_m = 4 m` theo hướng người chơi → Bóng Mực (trùng vị trí thì đẩy theo +X).
- Sự kiện `pulse` luôn ghi (kể cả `stunned_ids` rỗng). +`per_stun` cho mỗi con bị choáng. Cooldown `1.5 s`.

### Bóng Mực (shades)
- `random_shades = true` (mặc định): 3 con lúc đầu, cách người chơi ≥ 25 m; thêm 1 con mỗi 45 s, tối đa 6 con, sinh cách người chơi ≥ 20 m → sự kiện `shade_spawned`. Id S1, S2… tăng dần.
- Bóng Mực lơ lửng ở Y = 1.0. Trạng thái: `chase` (luôn đuổi người chơi với `shade_speed = 3.5 m/s`) hoặc `stunned` (đứng yên, không gây sát thương).
- **Sợ đèn:** không vào được vùng `safe_radius = 5 m` quanh **đèn đã thắp**; nếu bước đi vào vùng đó thì bị đẩy ra mép vùng.
- Chạm: khoảng cách XZ ≤ `shade_hit_radius = 1 m`, Bóng Mực không choáng, người chơi không bất tử → `flames − 1`, rơi `floor(carried × 0.5)` đom đóm (biến mất), bất tử `invuln_s = 2 s`. Sự kiện `player_hit` `by: "shade"`. Mỗi tick tối đa 1 lần trúng.

### Thời gian, thắng, thua, điểm
- `time_left_s = thời lượng − số bước / 60`. Thời lượng = `night1_duration_s (300)` hoặc `time_left_s` của scenario.
- **Thắng** `all_lit`: cả 5 đèn đã thắp. Thưởng thêm `per_second_left × floor(time_left_s)` + `per_flame_left × flames`.
- **Thua** `no_flames`: flames = 0. **Thua** `dawn`: time_left_s ≤ 0 mà chưa thắng.
- Điểm = per_mote × số đom đóm nhặt + per_lantern × số đèn thắp (trong game) + per_stun × số lần choáng + thưởng khi thắng.

### Thứ tự xử lý một bước (tất định)
1. Áp frame input của tick k (trường vắng giữ giá trị cũ).
2. Giảm các bộ đếm (bất tử, cooldown, choáng; hết choáng → `chase`).
3. Di chuyển người chơi (đổi hướng theo cam_yaw_deg, chuẩn hóa move > 1), nhảy, kẹp mép đảo.
4. Nhặt đom đóm.
5. Interact → nạp đèn → kiểm tra thắng.
6. Pulse.
7. Bóng Mực di chuyển (tôn trọng safe_radius).
8. Va chạm → kiểm tra thua no_flames.
9. Sinh Bóng Mực mới (nếu random_shades).
10. Cập nhật thời gian → kiểm tra thua dawn.
Sự kiện trong bước k ghi `tick = k+1`. Game kết thúc thì dừng ngay sau bước đó.

### Headless
- Snapshot ở tick 0 và mỗi `--snapshot-every` tick (chỉ bội số). Dòng cuối luôn là `end`.
- Sai tham số, file inputs/scenario không đọc được hoặc sai định dạng → stderr + mã thoát 2.
- Tọa độ và time_left_s làm tròn 3 chữ số. RNG có seed (mulberry32), không dùng `Math.random` trong logic.
- Khi headless: tắt mọi phần sáng tạo thêm (không đổi đầu ra).

### Giả định bổ sung khi code
- **Thưởng thắng** dùng `floor(time_left_s)` của trạng thái SAU bước thắng (bước đó vẫn được tính vào thời gian). Ví dụ: thắp đèn cuối ở tick 1, flames 3 → time_left_s = 299.983, thưởng = 2×299 + 50×3 = 748, cộng 100 điểm thắp đèn = **848 điểm**.
- **Id đom đóm** là `M1, M2…` tăng dần, kể cả con sinh lại. Snapshot có thêm mảng `motes` [{id, pos}] (khuyến nghị v1.0).
- Shade trong scenario không có `id` được gán `S1, S2…`; id tự sinh tiếp theo = số lớn nhất hiện có + 1.
- Pulse đẩy Bóng Mực bị kẹp vào mép đảo (R = 40); bước 7 đẩy mọi Bóng Mực (kể cả đang choáng) ra khỏi vùng `safe_radius` của đèn đã thắp. Trùng tâm đèn thì đẩy theo +X.
- Bóng Mực ngẫu nhiên sinh trong bán kính 38 m; thêm con mới ở tick 2700, 5400… khi tổng < 6.
- Đèn scenario `lit: true` → `deposited = lantern_cost`, không cộng điểm.
- **Thoát mã 2** khi: thiếu `--seed/--ticks/--out/--night`; `--night` ≠ 1; tham số lạ hoặc bị lặp; số không phải số nguyên (`--seed`, `--ticks` ≥ 0, `--snapshot-every` ≥ 1); không đọc được file inputs/scenario; JSON hỏng; `inputs` không phải `{frames: [...]}`, `tick` không phải số nguyên ≥ 0 hoặc không tăng nghiêm ngặt; `move` không phải [x, z] trong [−1, 1]; `cam_yaw_deg` không phải số; `jump/interact/pulse/dash` không phải boolean; scenario sai kiểu (`pos` không phải 3 số, `carried`/`flames` sai, `deposited` ngoài [0, 5], id đèn ngoài L1…L5, id shade trùng, `time_left_s` < 0). `time_left_s = 0` hợp lệ (thua `dawn` ở tick 1).
- **Hằng số** không có trong `game.contract.json` nằm ở `src/sim/constants.ts`: `TICK_RATE` 60, `ISLAND_RADIUS` 40, `LANTERN_RING_RADIUS` 22, `MOTE_COUNT` 30 / `MOTE_SPAWN_RADIUS` 38 / `MOTE_MIN_ORIGIN_DIST` 3, `JUMP_SPEED` 6, `GRAVITY` 20, `SHADE_Y` 1, shade: 3 ban đầu, tối đa 6, mỗi 45 s, cách ≥ 25 m (đầu) / ≥ 20 m (thêm), vùng sinh 38 m.

## 2. Tiêu chí nghiệm thu (làm A thì thấy B)

| ID | Tiêu chí | Cách kiểm chứng |
|---|---|---|
| AC1 | move [0,1], yaw 0, 60 tick → player ở (0,0,6) | scenario + test |
| AC2 | move [0,1], yaw 90, 60 tick → player ở (6,0,0) | scenario + test |
| AC3 | move [1,1] được chuẩn hóa (60 tick đi đúng 6 m) | test |
| AC4 | Đom đóm tại (0,0,1) → `mote_picked` ở tick 1, carried 1, +10 điểm | scenario |
| AC5 | Đầy túi (10) thì không nhặt thêm | test |
| AC6 | carried 5 cạnh L1, interact → `deposit` amount 5 + `lantern_lit` + 100 điểm | scenario |
| AC7 | Thắp đủ 5 đèn → `game_over won all_lit`, có thưởng thời gian + flames | scenario |
| AC8 | Pulse với carried ≥ 2 → shade trong 6 m `stunned`, bị đẩy 4 m, carried −2 | scenario |
| AC9 | Pulse khi carried < 2 hoặc đang cooldown → không có sự kiện | test |
| AC10 | Shade chạm → `player_hit`, flames −1, rơi floor(carried/2), bất tử 2 s | scenario |
| AC11 | flames về 0 → `game_over lost no_flames` | scenario |
| AC12 | Hết giờ → `game_over lost dawn` | scenario (time_left_s nhỏ) |
| AC13 | Shade không vào được 5 m quanh đèn đã thắp | scenario |
| AC14 | Cùng seed + input → output giống hệt (so 2 lần chạy) | script |
| AC15 | File inputs sai (tick không tăng / JSON hỏng) → mã thoát 2 | test |
| AC16 | Dòng cuối là `end`, mã thoát 0 | test |
| AC17 | Bản có giao diện: chơi được từ đầu đến thắng/thua, HUD (flames, carried, đèn, giờ, điểm), chơi lại | chơi thật + ảnh/video |

## 3. Kế hoạch kiểm chứng
- Logic thuần trong `src/sim/` → unit test bằng Vitest (`npm test`).
- Scenario headless trong `scenarios/` + `inputs/`, chạy bằng script, lưu output vào `docs/proof/phase-1/`.
- Tất định: chạy 2 lần, so sánh bằng `diff`.
- Giao diện: ảnh chụp HUD, thắng/thua.

## 4. Đánh giá Phase 1 (điền khi xong)
- Đạt:
- Chưa đạt (lý do):
- AI sai ở đâu / đã chỉnh harness gì:
- Token / chi phí ước tính:
