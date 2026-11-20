# Phase 2 — Ticket-02 "Ba hòn đảo" + Test Contract v1.1

Nguồn: `docs/notes/ticket-02.md` (BẮT BUỘC chính xác). Tuning đọc từ `game.contract.json` (v1.1). Hằng số không có trong contract (bản đồ, nhảy, phát hiện, Gió Lạc, Bùa…) nằm ở `src/sim/constants.ts`. Mục 4 liệt kê mọi chỗ ticket không nói rõ. Mục 4.1 là các chỗ đã chốt với người dùng; mục 4.2 do agent tự đặt và cần người dùng soát lại.

## 1. Thay đổi so với Phase 1

| Luật / số | Phase 1 (v1.0) | Phase 2 (v1.1) |
|---|---|---|
| Tốc độ chạy | 6 m/s, tức thời | 6 m/s, tăng tốc/dừng tức thời (thỏa "≤ 0.1 s"); điều khiển trên không đầy đủ |
| Nhảy | 6 m/s, g = 20 | **7 m/s**, g = 20, chỉ khi chạm đất |
| Lướt (dash) | không có | **mới**: 14 m/s × 0.2 s (12 tick), hồi chiêu 1.5 s (90 tick) tính từ lúc bắt đầu |
| Nhặt đom đóm | XZ ≤ 1.5 m | XZ ≤ **1.0 m** **và** \|chân Mây − mặt đất đặt đom đóm\| ≤ 1.5 m |
| Số đom đóm | 30 ngẫu nhiên trong r 38, nhặt xong sinh lại ngay | **20** con trên 20 điểm cố định khác nhau (Đêm 1 có 24 điểm), trần **30**, sinh thêm 1 con ở tick 240, 480, … nếu < 30 |
| Điểm khi có đom đóm | +10 khi **nhặt** | +10 mỗi đom đóm **nạp** vào đèn; nhặt không cộng điểm |
| Đèn | 5 đèn trên vòng r 22 (L1 (0,0,22)), cần 5 | Vị trí chuẩn L1 (0,0,25) · L2 (23.8,0,7.7) · L3 (14.7,0,−20.2) · L4 (−14.7,0,−20.2) · L5 (−23.8,0,7.7); cần **10** |
| Tương tác đèn | ≤ 3 m | ≤ **2 m** (XZ); chỉ xét đèn chưa sáng; gần nhất, hòa thì id nhỏ hơn |
| Vùng an toàn | 5 m, đẩy tức thời ra mép | **6 m**; bóng ở ngoài bị chặn ở mép; bóng đang ở trong lúc đèn vừa thắp bị đẩy ra mép trong ≤ 30 tick, không gây sát thương trong lúc đó |
| Tỏa Sáng | 2 đom đóm, r 6 (XZ, tâm chân), choáng 3 s, đẩy 4 m tức thời, hồi 1.5 s, +20 | **3** đom đóm, r **5** đo **3D** từ chân Mây + 0.8 m tới tâm bóng, choáng **120 tick**, đẩy tổng 4 m trong **15 tick**, hồi **3 s**, **+5**/bóng trúng (kể cả bóng đang choáng) |
| Bóng Mực tốc độ | 3.5 | **4.0** (Đêm 3: 4.5) |
| Trạng thái Bóng Mực | `chase`, `stunned` | `spawning`, `wander`, `chase`, `recoil`, `stunned` (tên bắt buộc) |
| Phát hiện | luôn đuổi | đuổi khi ≤ 12 m, bỏ khi > 18 m |
| Chạm | XZ ≤ 1 | XZ ≤ 1 **và** chênh cao ≤ 1.5; bóng gây hit lùi 2 m trong 60 tick (`recoil`) |
| Lịch sinh bóng | 3 con lúc đầu (≥ 25 m), +1 mỗi 45 s (≥ 20 m), tối đa 6, vị trí ngẫu nhiên r ≤ 38 | **2 con ở tick 300**, rồi 1 con ở 300 + 480k (Đêm 1); trên 12 điểm r 37 (15°, 45°, …), cách Mây ≥ 15 m; tối đa 6 / 8 / 10 |
| Bị đánh | −1 lửa, mất floor(carried/2) (biến mất), bất tử 120 tick | −1 lửa, rơi floor(carried/2) ra vành 1.5–2.5 m (`dropped`, TTL 480 tick, nhặt lại từ tick sau), bất tử **90 tick** |
| Rơi khỏi đảo | `fall_enabled false`, kẹp mép đảo | **`fall_enabled true`**: Y < −10 → −1 lửa (bỏ qua bất tử), mất hết đom đóm, chờ 60 tick, hồi sinh ở điểm xuất phát, v = 0, bất tử 90 tick |
| Thời gian | Đêm 1 300 s | 300 / 330 / 360 s |
| Thắng/thua | thắng xét ở bước nạp; dawn xét ở bước 10 | xét **cuối tick (bước 11)**: hết lửa → thua `no_flames`; còn sống và đủ đèn → thắng (kể cả tick hết giờ); hết giờ → `dawn` |
| Thứ tự tick | 10 bước (Phase 1) | 12 bước theo ticket (xem 4.3) |
| Bản đồ | 1 đảo r 40 | Đêm 1 Đảo Bến chuẩn hóa, Đêm 2 Đảo Cau, Đêm 3 Đảo Chuông |
| Tính năng mới | — | Gió Lạc, Bùa Gió, gió mạnh (Đêm 3), tạm dừng, chuỗi 3 Đêm, cài đặt, âm thanh, HUD đầy đủ, bảng màu chuẩn |
| `--night` | chỉ 1 | 1, 2, 3 |

### 1.1 Cách hiểu từng khóa tuning (game.contract.json v1.1)

| Khóa | Giá trị | Cách hiểu |
|---|---|---|
| `player_speed` | 6 | Tốc độ chạy ngang (m/s), = 0.1 m/tick. Bùa Gió nâng lên 7.2 (hằng số, không phải khóa contract) |
| `carry_capacity` | 10 | Số đom đóm mang tối đa |
| `lantern_cost` | 10 | Số đom đóm để thắp 1 đèn (nạp nhiều lần, đèn nhớ `deposited`) |
| `lantern_count_night1` | 5 | Số đèn Đêm 1. Đêm 2 (6) và Đêm 3 (7) lấy từ bản đồ |
| `pickup_radius` | 1 | Bán kính nhặt XZ (m). Điều kiện chênh cao ≤ 1.5 m là hằng số. Áp dụng cho đom đóm và Bùa |
| `interact_radius` | 2 | Bán kính nạp đèn, chỉ đo XZ (m) |
| `pulse_cost` | 3 | Số đom đóm mỗi lần Tỏa Sáng; thiếu thì không kích hoạt |
| `pulse_radius` | 5 | Khoảng cách **3D** từ (chân Mây + 0.8 m) tới tâm Bóng Mực / Gió Lạc |
| `pulse_cooldown_s` | 3 | 180 tick, tính từ tick kích hoạt |
| `pulse_stun_s` | 2 | 120 tick choáng; pulse lại làm mới |
| `pulse_push_m` | 4 | Tổng quãng đẩy lùi ngang, chia đều trong 15 tick đầu của choáng (4/15 m/tick) |
| `night1/2/3_duration_s` | 300 / 330 / 360 | Thời lượng mỗi Đêm |
| `flames` | 3 | Ngọn Lửa, hồi đầy đầu mỗi Đêm |
| `invuln_s` | 1.5 | 90 tick bất tử sau khi bị đánh và sau khi hồi sinh |
| `hit_drop_ratio` | 0.5 | Rơi floor(carried × 0.5) đom đóm khi bị Bóng Mực đánh (rơi khỏi đảo thì mất hết, không dùng tỉ lệ) |
| `safe_radius` | 6 | Bán kính vùng an toàn quanh đèn đã sáng |
| `shade_speed` | 4 | Tốc độ Bóng Mực ở Đêm 1 và 2. Đêm 3 dùng hằng số 4.5 |
| `shade_hit_radius` | 1 | Bán kính chạm XZ của Bóng Mực |
| `fall_enabled` | true | Có rơi khỏi đảo (Y < −10) và bị phạt |
| `dash_speed` | 14 | Tốc độ lướt (m/s) |
| `dash_duration_s` | 0.2 | 12 tick |
| `dash_cooldown_s` | 1.5 | 90 tick tính từ lúc bắt đầu lướt; Bùa Gió đưa về 0 |
| `score.per_mote` | 10 | Mỗi đom đóm **NẠP** vào đèn (không phải nhặt) |
| `score.per_lantern` | 100 | Mỗi đèn thắp trong lúc chơi (đèn đặt sẵn `lit` trong scenario không tính) |
| `score.per_stun` | 5 | Mỗi Bóng Mực trúng Tỏa Sáng, mỗi con mỗi lần, kể cả con đang choáng hoặc `spawning` |
| `score.per_second_left` | 2 | × floor(giây còn lại) khi thắng |
| `score.per_flame_left` | 50 | × Ngọn Lửa còn lại khi thắng |

## 2. Test Phase 1 bị thay thế

Từ Việc 2 trở đi, test Phase 1 nào còn đúng với số chuẩn thì giữ nguyên để làm regression. Test nào dựa vào luật hay số cũ thì sửa kỳ vọng theo ticket, không xóa.

| Test / scenario | Hành động | Lý do (trích ticket) |
|---|---|---|
| `motes.test` "AC4 … +10 điểm", `ac04-pickup-mote` | Sửa: nhặt không cộng điểm; đom đóm đặt trong 1.0 m | "+10 mỗi đom đóm **nạp**"; "Nhặt … khoảng cách XZ ≤ 1.0 m" |
| `motes.test` "ngoài 1.6 m không nhặt, đúng 1.5 m thì được" | Sửa: biên 1.0 / 1.1 m; thêm biên chênh cao 1.5 m | "XZ ≤ 1.0 m và chênh cao … ≤ 1.5 m" |
| `motes.test` "random_motes: 30 con, nhặt thì sinh lại" | Thay: 20 con trên 20 điểm khác nhau, sinh ở tick 240k, trần 30 | "20 lúc bắt đầu tại 20 điểm khác nhau; trần 30; tại các tick 240, 480, …" |
| `motes.test` AC5 (túi 10), `ac05-bag-full` | Giữ (số không đổi); chỉ đổi kỳ vọng điểm/snapshot nếu cần | Sức chứa vẫn 10 |
| `lanterns.test` "vị trí mặc định vòng 22 m" | Sửa: 5 tọa độ chuẩn | Phần 2, Đêm 1: "L1 (0,0,25) · L2 (23.8,0,7.7) …" |
| `lanterns.test` AC6, `ac06-deposit-lit` | Sửa: carried 10, deposit 10, điểm 100 + 10×10 = 200 | "Chi phí thắp 10"; "+10 mỗi đom đóm nạp" |
| `lanterns.test` "nạp một phần, không cộng điểm; ngoài 3 m" | Sửa: nạp một phần **có** cộng 10/đom đóm; biên 2 m | "+10 mỗi đom đóm nạp"; "Trong bán kính 2.0 m" |
| `lanterns.test` AC7, `ac07-win-all-lit` (848 điểm, thắng ở tick 1) | Sửa điểm: thêm 10 × số nạp; giờ thắng xét ở bước 11 | "+10 mỗi đom đóm nạp"; thứ tự tick bước 11 |
| `pulse.test` AC8, `ac08-pulse-stun` (carried 4, đẩy 3 → 7 tức thời, +20) | Sửa: cần 3, đẩy dần 15 tick, +5; đo 3D từ chân + 0.8 | "3 đom đóm / 5 m / 3 s"; "trong 15 tick đầu bị đẩy lùi tổng 4 m"; "+5 mỗi Bóng Mực trúng" |
| `pulse.test` "trùng vị trí đẩy theo +X", "kẹp mép đảo R 40" | Sửa: đẩy theo +X giữ; "dừng nếu gặp vật cản" thay cho kẹp | "dừng nếu gặp vật cản; trùng vị trí thì đẩy theo +X" |
| `pulse.test` AC9 (carried < 2, cooldown 90 tick), `ac09a`, `ac09b` | Sửa: carried < 3; cooldown 180 tick | "3 đom đóm / … / 3 s" |
| `pulse.test` "pulse không trúng vẫn ghi sự kiện" | Giữ | v1.1 không đổi sự kiện `pulse` |
| `feedback.test` thông báo "Cần ≥ 2 đom đóm" | Sửa chữ thành "≥ 3"; tách theo thứ tự xử lý mới | `pulse_cost` 3 |
| `shades.test` "đuổi 3.5 m/s, Y = 1" | Sửa: 4.0 m/s, chỉ đuổi khi ≤ 12 m | "Tốc độ 4.0 m/s"; "Phát hiện / bỏ đuổi 12 m / 18 m" |
| `shades.test` AC10, `ac10-shade-hit` (trúng lại ở tick 121, rơi biến mất) | Sửa: bất tử 90 tick; bóng `recoil` lùi 2 m; đom đóm rơi thành `dropped` | "bất tử 90 tick"; "lùi 2 m trong 60 tick"; "rơi … ra vành 1.5–2.5 m" |
| `shades.test` AC11, `ac11-lose-no-flames`, "3 lần trúng cách 120 tick → tick 241" | Sửa thời điểm theo 90 tick + recoil | "bất tử 90 tick" |
| `shades.test` AC13, `ac13-safe-zone` (dừng ở (0,1,5)) | Sửa: mép 6 m | "Vùng an toàn bán kính 6 m" |
| `shades.test` "pulse đẩy vào vùng đèn bị đẩy ra" | Sửa: đẩy dừng ở mép vùng (vật cản) | "chặn ở mép 6 m" |
| `shades.test` "random_shades: 3 con ≥ 25 m, mỗi 45 s", "tối đa 6", `ac14b-spawn-determinism` (S4 @ 2700, S5 @ 5400) | Thay: S1, S2 @ 300; S3 @ 780; … ≥ 15 m trên 12 điểm r 37 | "2 con tại tick 300, sau đó 1 con mỗi khoảng sinh (tick 300 + 480k ở Đêm 1)" |
| `shades.test` "đèn (36,0,0) / shade (39,0,0) kẹp đảo" | Bỏ hoặc sửa theo bản đồ chuẩn (đèn cố định, mép đảo 40) | Đèn có vị trí chuẩn; bóng sinh tại r 37 |
| `movement.test` "bị chặn ở mép đảo, không có fall" | Thay: đi quá 40 m thì rơi, `player_hit` `by:"fall"` có `lost` | "`fall_enabled` true"; "Rơi khỏi đảo (Y < −10)" |
| `movement.test` "nhảy chỉ khi chạm đất" | Sửa đỉnh nhảy theo 7 m/s (≈ 1.225 m) | "Nhảy: Vận tốc 7.0 m/s" |
| `endgame.test` thắng cùng tick hết giờ, thưởng thời gian theo tick nguyên | Giữ kết quả (vẫn thắng); sửa cách dựng nếu cần vì thắng xét ở bước 11 | "còn sống và tất cả đèn sáng → thắng (kể cả đúng tick hết giờ)" |
| `headless.test` parser: `--night` ≠ 1 → mã 2; `deposited` ngoài [0, 5]; id đèn L1…L5 | Sửa: `--night` 1/2/3 hợp lệ; `deposited` ∈ [0, 10]; id theo số đèn của Đêm | "`--night` nhận 1, 2, 3"; "Chi phí thắp 10" |
| `headless.test` AC16 (snapshot tick 0/10/20, dòng cuối `end`) | Sửa: thêm dòng `night_start` tick 0; kiểm thêm trường v1.1 | Phần 4: snapshot mới, sự kiện `night_start` |
| Không đổi | AC1–AC3 (`ac01`–`ac03`), AC12 (`ac12-lose-dawn`), AC14 (`ac14-random-determinism`), AC15 (`ac15a`, `ac15b`), `render.test` | Tốc độ 6 m/s tăng tốc tức thời; luật dawn, tính tất định và định dạng lỗi không đổi |

## 3. Đầu ra headless v1.1 (tóm tắt để đối chiếu)
- Snapshot: thêm `night`, `wind {active, dir_deg}`. `player` thêm `vel`, `grounded`, `invuln`, `dash_cd_s`, `pulse_cd_s`, `charm_s`. Thêm các mảng `motes` [{id, pos, kind, ttl_s}], `drifters` [{id, pos, state, stolen}], `charms` [{id, available, respawn_s}]. Giữ `motes_active`.
- Sự kiện mới: `dash`, `charm_picked`, `drifter_steal`, `drifter_drop`, `night_start`, `paused`, `resumed`. `player_hit` do rơi có thêm `lost`.

## 4. Giả định

### 4.1 Đã chốt với người dùng
- **Tăng tốc/dừng tức thời**: vận tốc ngang đạt giá trị mục tiêu ngay trong tick, tức 0 tick, thỏa "≤ 0.1 s". Nhờ vậy AC1–AC3 giữ nguyên: 60 tick đi đúng 6 m.
- **Bóng Mực `spawning`**: kéo dài 30 tick, đứng yên, không gây sát thương, nhưng **vẫn bị Tỏa Sáng trúng** (+5). Ticket không nói spawning miễn nhiễm và có ghi "+5 mỗi Bóng Mực trúng… kể cả con đang choáng".
- **`wander`**: trong sim, bóng đứng yên lơ lửng tại chỗ. Bản render được cho nhấp nhô, không làm đổi đầu ra headless. Mây cách ≤ 12 m thì chuyển `chase`; đang `chase` mà > 18 m thì về `wander`.
- **Shade trong scenario** không ghi `state` thì bắt đầu ở `wander` và xét phát hiện ngay từ tick đầu.
- **Chọn điểm đom đóm**: xáo danh sách điểm sinh của Đêm bằng RNG có seed rồi lấy 20 điểm đầu. Mỗi lần sinh thêm (tick 240k) chọn ngẫu nhiên theo seed trong các điểm trống; không còn điểm trống thì bỏ lượt.
- **Điểm sương** của Gió Lạc = các điểm sinh Bóng Mực của Đêm đó, chọn ngẫu nhiên theo seed, không ràng buộc khoảng cách tới Mây.
- **Gió mạnh Đêm 3**:
  - Cơn thứ k (k ≥ 1) thổi trong `sim_tick` [1800k, 1800k + 300). Báo trước (lá bay, âm thanh) từ `sim_tick` 1800k − 120.
  - Lịch gió tính theo **`sim_tick`** nên đứng yên khi tạm dừng.
  - `dir_deg` là số nguyên phân bố đều trong [0, 360) theo seed, chốt lúc bắt đầu báo trước. Góc đo **cùng quy ước bản đồ**: từ trục +X, ngược chiều kim đồng hồ khi nhìn từ trên xuống, tức hướng (cos θ, 0, sin θ) giống cách đặt đèn (90° = +Z). Đây là hướng gió **thổi TỚI** (Mây bị đẩy theo hướng này).
  - `wind.active` chỉ `true` trong 5 s gió thổi, **không** tính 2 s báo trước. Khi không có gió, `dir_deg` giữ giá trị của cơn gần nhất (0 nếu chưa có cơn nào).
  - Gió chỉ đẩy Mây: cộng 2 m/s theo hướng gió vào vận tốc ngang, kể cả khi đang trên không, đang lướt hoặc đang bay từ bục nhảy. Đêm 1/2 và scenario có `wind_enabled: false` thì không có gió.
- **`night_start {night}`** ghi ở **tick 0, ngay sau snapshot tick 0**, với mọi `--night` (kể cả khi chạy scenario). `--night 2|3` bắt đầu thẳng Đêm đó với 3 Ngọn Lửa và điểm 0.
- **Va chạm Đêm 3**: Mây **trượt theo** vách tầng và tháp chuông (bỏ thành phần vận tốc đi vào vách, giữ thành phần tiếp tuyến). Bóng Mực bay qua vách tầng (Y = mặt đất bên dưới + 1) nhưng bị tháp chặn và trượt quanh tháp.
- **Gió Lạc `idle`**: bay vòng tròn bán kính 4 m quanh điểm sinh, tốc độ 2 m/s, ngược chiều kim đồng hồ, không dùng RNG. Bỏ `chase` về `idle` thì lượn vòng quanh vị trí hiện tại.
- **Xuất phát Đêm 3**: (0,0,−30), quay mặt về +Z. Điểm (0,0,0) nằm trong tháp. Đây cũng là điểm hồi sinh sau khi rơi. Đêm 1 và Đêm 2 xuất phát tại (0,0,0), quay về +Z.
- **Nạp đèn chỉ đo XZ ≤ 2 m**, đúng quy ước v1.0. Ở Đêm 3, đứng tầng dưới sát vách vẫn nạp được đèn tầng trên nếu XZ ≤ 2 m.

### 4.2 Agent tự đặt (người dùng soát lại)
- **Giới hạn số lượng** ("tối đa 2 Gió Lạc", "tối đa 6/8/10 Bóng Mực") tính theo số con **đang tồn tại**. Gió Lạc đã `removed` không tính.
- **Lịch Bóng Mực**: 2 con ở tick 300, sau đó 1 con ở tick 300 + 480k / 420k / 360k cho Đêm 1/2/3. Mọi Đêm đều sinh cách Mây ≥ 15 m (ticket chỉ ghi cho Đêm 1). Chọn điểm hợp lệ ngẫu nhiên theo seed; không có điểm hợp lệ thì bỏ lượt.
- **Góc bắt đầu của các vòng điểm** khi ticket không ghi là 0°: đom đóm Đêm 1 (r 12 mỗi 45°, r 33 mỗi 22.5°), đom đóm Đêm 2 (r 22 mỗi 45°) và Bóng Mực Đêm 3 (r 43 mỗi 22.5°). Điểm của Đêm 2 tính quanh tâm từng đảo, đảo A trước rồi tới đảo B.
- **Điểm trống** (khi sinh thêm đom đóm) là điểm không có đom đóm `random` đang nằm ở đó. Đom đóm `dropped` không chiếm điểm.
- **Đom đóm rơi** khi bị đánh: mỗi con nhận góc ngẫu nhiên theo seed và bán kính đều trong [1.5, 2.5] quanh Mây. Nếu điểm rơi không có mặt đất (biển mây, ngoài cầu) thì kéo về điểm đứng được gần nhất theo hướng về Mây. Đặt trên mặt đất tại điểm đó. `ttl_s` của đom đóm `random` là `null`.
- **Gió Lạc cướp và thả**: đom đóm bị cướp nằm trong `stolen` cho tới khi Gió Lạc biến mất (mất hẳn) hoặc bị Tỏa Sáng lúc `flee` (thả thành `dropped` tại vị trí XZ của nó).
- **Rơi khỏi đảo**:
  - Áp dụng ở mép đảo, mép cầu tre (Đêm 2) và biển mây.
  - Sự kiện `player_hit` `{by:"fall", flames, dropped: 0, lost: carried}` ghi đúng 1 lần ở tick Y < −10.
  - Trong 60 tick chờ, Mây không di chuyển, không nhặt và không bị chạm (cả Bóng Mực lẫn Gió Lạc).
  - Bóng Mực bị kẹp trong phạm vi đảo của Đêm.
  - Gió Lạc bay nên có thể ra ngoài đảo khi `flee`. Chạm Gió Lạc chỉ xét XZ ≤ 1.2.
- **Chạm Bóng Mực, chênh cao**: so chân Mây với mặt đất dưới tâm bóng (tâm bóng − 1).
- **Recoil**: bóng lùi theo phương ngang từ Mây ra (trùng vị trí thì theo +X), 2/60 m mỗi tick, dừng nếu gặp vật cản. Trong `recoil` bóng không gây sát thương; hết recoil thì xét lại phát hiện.
- **Vùng an toàn vừa thắp**: mỗi bóng đang ở trong vùng được đẩy tuyến tính ra mép trong đúng 30 tick, quãng (6 − d) chia đều; trùng tâm thì đẩy theo +X. Trong thời gian đó bóng giữ tên trạng thái hiện có (5 tên bắt buộc) và không gây sát thương.
- **Choáng**: hết choáng thì bóng về `wander` rồi xét phát hiện ngay. Pulse trúng bóng đang `recoil` thì bóng chuyển sang `stunned`.
- **Tỏa Sáng trúng Gió Lạc** dùng cùng điều kiện 3D ≤ 5 m tới tâm Gió Lạc. Gió Lạc bay ở Y = mặt đất + 1. Không cộng điểm và không có trong `stunned_ids`; mảng này chỉ chứa Bóng Mực.
- **Lướt**:
  - Hướng lướt là hướng `move` sau khi xoay theo camera. Đứng yên thì dùng hướng quay mặt (hướng di chuyển gần nhất; lúc đầu là +Z).
  - Trong 12 tick lướt, vận tốc ngang = 14 m/s theo hướng đó (cộng gió), vy = 0 và không có trọng lực.
  - Nhấn lướt khi đang lướt thì bị bỏ qua. Đang chờ hồi sinh thì không lướt được.
  - Lướt lúc đang bay từ bục nhảy: hết lướt thì trả lại vận tốc phóng.
- **Bùa Gió**: Đêm 1 không có bùa. `charm_s` là thời gian hiệu lực còn lại (giây, 3 chữ số). `respawn_s` của bùa đang `available` là 0. Bùa nhặt lúc túi đầy vẫn được, vì nó không chiếm sức chứa.
- **Điểm khi thua**: `end.score` là điểm của Đêm đó tới lúc thua (nạp, thắp, pulse), không có thưởng thắng. "Tổng điểm game" (chỉ cộng các Đêm đã thắng) chỉ dùng ở UI, vì headless chạy 1 Đêm.
- **Tạm dừng**: `pause` (sườn false → true) bật/tắt. Ở tick bật pause: ghi `paused` rồi dừng xử lý. Ở tick bỏ pause: ghi `resumed` rồi chạy bước 2–12 bình thường. Khi tạm dừng, input khác chỉ được ghi nhận làm trạng thái nút (để bắt sườn), không gây hành động.
- **Hằng số ngoài contract** đặt trong `src/sim/constants.ts` ở Việc 2: nhảy 7 / −20, chênh cao 1.5, phát hiện 12 / 18, recoil 2 m / 60 tick, spawning 30 tick, bóng Đêm 3 4.5 m/s, bản đồ 3 Đêm, bục nhảy, Gió Lạc (7 / 2 m/s, 1.2 m, cướp 3, ngưỡng 5 đom đóm / 15 m, flee 240 tick, thả 120 tick, sinh tick 1200k), Bùa (600 tick, 7.2 m/s, hồi 2700 tick), gió (1800 / 300 / 120 tick, 2 m/s), rơi (Y −10, chờ 60 tick).

### 4.3 Thứ tự xử lý một tick (theo ticket, bắt buộc)
1. Đọc input. Xử lý `pause` trước; nếu vừa tạm dừng (hoặc đang tạm dừng) thì dừng ở đây.
2. Giảm bộ đếm: thời gian, hồi chiêu, bất tử, choáng, bùa, TTL đom đóm rơi, hồi bùa.
3. Di chuyển Mây (nhảy, lướt, bục nhảy, gió), rồi kiểm tra rơi khỏi đảo.
4. Nhặt đom đóm và bùa.
5. Tương tác với đèn.
6. Cập nhật vùng an toàn.
7. Tỏa Sáng.
8. Di chuyển Bóng Mực và Gió Lạc.
9. Chạm: Gió Lạc cướp trước, rồi Bóng Mực gây hit (theo id tăng dần).
10. Sinh đom đóm, Bóng Mực, Gió Lạc theo lịch; thực thể mới chỉ tương tác được từ tick sau.
11. Xét thắng/thua.
12. Ghi snapshot nếu tới lượt.

Sự kiện trong bước k ghi `tick = k+1`, riêng `night_start` ghi ở tick 0. Khi tạm dừng, `tick` vẫn tăng nhưng `sim_tick` và mọi bộ đếm đứng yên; snapshot ghi `state: "paused"`.

## 5. Tiêu chí nghiệm thu (AC2-xx)

Cách kiểm: **U** = unit test Vitest · **S** = scenario headless (`scenarios/` + `inputs/`, chạy bằng `scripts/proof.sh 2`) · **P** = chơi thật (ảnh `npm run shot` / ghi chú chơi thử) · **Đ** = đo (`time`, FPS).

### Phần 1 — Số liệu chuẩn
| ID | Tiêu chí | Kiểm |
|---|---|---|
| AC2-01 | move [0,1], yaw 0, 60 tick → (0,0,6); dừng input thì vận tốc 0 ngay tick sau (tức thời ≤ 0.1 s); `vel` trong snapshot = [0,0,6] khi chạy | U + S |
| AC2-02 | Đổi hướng trên không có hiệu lực đầy đủ (điều khiển trên không) | U |
| AC2-03 | Nhảy: vy 7, g −20, đỉnh ≈ 1.225 m, chạm đất sau 42 tick; nhảy trên không bị bỏ qua | U + S |
| AC2-04 | Lướt: event `dash`, 12 tick × 14 m/s = 2.8 m (cộng phần chạy nếu có), hồi 90 tick từ lúc bắt đầu; đứng yên thì lướt theo hướng quay mặt; lướt trên không giữ Y; không bất tử khi lướt | U + S |
| AC2-05 | Nhặt: XZ ≤ 1.0 và chênh cao ≤ 1.5 thì nhặt; 1.01 m hoặc chênh 1.6 m thì không; túi 10 thì không nhặt | U + S |
| AC2-06 | 20 đom đóm ban đầu ở 20 điểm khác nhau thuộc danh sách điểm của Đêm; sinh thêm ở tick 240k nếu < 30; hết điểm trống thì bỏ lượt; tất định theo seed | U + S |
| AC2-07 | Nạp: mỗi lần `interact` nạp min(carried, còn thiếu) vào đèn chưa sáng gần nhất trong 2 m XZ (hòa → id nhỏ); đèn nhớ tiến độ; 10 thì thắp (`lantern_lit`) | U + S |
| AC2-08 | Vùng an toàn: bóng ngoài bị chặn ở mép 6 m; bóng trong lúc đèn thắp bị đẩy ra mép trong ≤ 30 tick và không gây hit trong lúc đó | U + S |
| AC2-09 | Tỏa Sáng: cần 3 đom đóm và hồi = 0; tâm chân + 0.8; trúng nếu 3D ≤ 5 m; choáng 120 tick; đẩy 4 m trong 15 tick (dừng ở vật cản, trùng vị trí → +X); pulse lại làm mới; thiếu thì không có sự kiện; hồi 180 tick | U + S |
| AC2-10 | Bóng Mực: `spawning` 30 tick → `wander`; ≤ 12 m → `chase` 4.0 m/s (Đêm 3 4.5); > 18 m → `wander` | U + S |
| AC2-11 | Chạm: XZ ≤ 1 và chênh cao ≤ 1.5 → `player_hit` `by:"shade"`; tối đa 1 hit/tick (id nhỏ nhất trước); bóng gây hit → `recoil` lùi 2 m trong 60 tick; chạm lúc bất tử không làm gì | U + S |
| AC2-12 | Lịch sinh bóng: S1, S2 ở tick 300; S3 ở 780 (Đêm 1); trên điểm sinh chuẩn, cách Mây ≥ 15 m; tối đa 6; hết điểm hợp lệ thì bỏ lượt | U + S |
| AC2-13 | Bị đánh: −1 lửa; floor(carried/2) đom đóm `dropped` ở vành 1.5–2.5 m, TTL 480 tick, nhặt lại được từ tick sau; bất tử 90 tick | U + S |
| AC2-14 | Rơi khỏi đảo: Y < −10 → 1 sự kiện `player_hit` `by:"fall"` có `lost`, bỏ qua bất tử, mất hết đom đóm; chờ 60 tick; hồi sinh ở điểm xuất phát, v = 0, bất tử 90; hết lửa → thua ngay, không hồi sinh | U + S |
| AC2-15 | Ngọn Lửa 3 đầu mỗi Đêm; thời lượng 300 / 330 / 360 s theo `--night` | S |
| AC2-16 | Thắng/thua xét cuối tick: hết lửa → `no_flames` (kể cả khi cùng tick đủ đèn); đủ đèn cùng tick hết giờ → thắng; hết giờ → `dawn` | U + S |
| AC2-17 | Điểm: +10/đom đóm nạp, +100/đèn, +5/bóng trúng pulse (kể cả đang choáng), thắng + 2 × floor(giây còn) + 50 × lửa | U + S |
| AC2-18 | Thứ tự tick đúng 12 bước (ví dụ: rơi ở bước 3 trước nhặt; cướp trước hit; thực thể mới sinh không tương tác cùng tick) | U |
| AC2-19 | Tạm dừng: `tick` tăng, `sim_tick` / thời gian / hồi chiêu / spawn / TTL / gió đứng yên; snapshot `state:"paused"`; sự kiện `paused` / `resumed` | U + S |

### Phần 2 — Bản đồ chuẩn
| ID | Tiêu chí | Kiểm |
|---|---|---|
| AC2-20 | Đêm 1: đảo r 40, xuất phát (0,0,0) quay +Z, 5 đèn đúng tọa độ, 24 điểm đom đóm, 12 điểm sinh bóng r 37, bóng sinh tick 300 rồi mỗi 8 s, tối đa 6 | U + S |
| AC2-21 | Đêm 2: hai đảo r 28 tâm (0,0,0) và (70,0,0); cầu x ∈ [26,44], z ∈ [−2,2] đi qua được, ra ngoài cầu thì rơi; 6 đèn L1…L6 đúng thứ tự; 24 điểm đom đóm; 16 điểm sinh bóng r 26; sinh mỗi 7 s, tối đa 8 | U + S |
| AC2-22 | Bục nhảy Đêm 2: chân Mây chạm bục r 1 → vy 14, vận tốc ngang 24 m/s về tâm đảo kia, giữ tới khi chạm đất (move không ghi đè, vẫn lướt được), bay ≈ 1.4 s, đáp trong đảo đích | U + S |
| AC2-23 | Đêm 3 hình học: đảo r 45; tầng 1 Y=3 vành 12–24 ở z > 0; tầng 2 Y=6 đĩa r 8; vách đứng không lên được, bước ra thì rơi xuống tầng dưới; Mây trượt theo vách | U + S |
| AC2-24 | Đêm 3 dốc: 2 dốc rộng 3 m ở 30° và 150°, chân r 30 (Y 0) → đỉnh r 24 (Y 3), đi lên được | U + S |
| AC2-25 | Đêm 3 bục (0,3,13): vy 12, ngang 8 m/s về −Z → đáp lên tầng 2 | U + S |
| AC2-26 | Đêm 3 tháp chuông r 2 cao 8 ở tâm: không đi xuyên, không leo; Mây và Bóng Mực trượt quanh | U |
| AC2-27 | Đêm 3: xuất phát (0,0,−30) quay +Z; 30 điểm đom đóm (18 / 8 / 4) đúng tầng; 16 điểm sinh bóng r 43; 7 đèn đúng tọa độ; sinh mỗi 6 s, tối đa 10, tốc độ 4.5 | U + S |
| AC2-28 | Gió Đêm 3: cơn k ≥ 1 thổi `sim_tick` [1800k, 1800k+300), `wind.active` chỉ true lúc thổi, `dir_deg` nguyên theo seed (quy ước bản đồ, hướng thổi tới), đẩy Mây 2 m/s; báo trước 2 s bằng lá bay + âm thanh (UI); đứng yên khi pause | U + S + P |

### Phần 3 — Tính năng mới
| ID | Tiêu chí | Kiểm |
|---|---|---|
| AC2-30 | Gió Lạc sinh ở tick 1200, 2400, … (Đêm 2, 3) trên điểm sương theo seed, id D1, D2…, tối đa 2 con tồn tại; Đêm 1 không có | U + S |
| AC2-31 | `idle` bay vòng r 4 m, 2 m/s; `idle` → `chase` khi carried ≥ 5 và ≤ 15 m (xét mỗi tick); mất điều kiện → `idle`; chase 7 m/s | U + S |
| AC2-32 | Chạm XZ ≤ 1.2: cướp min(3, carried), sự kiện `drifter_steal {drifter_id, amount, carried}`, → `flee` 7 m/s ra xa Mây trong 240 tick rồi `removed` cùng số đã cướp; mỗi con cướp 1 lần | U + S |
| AC2-33 | Tỏa Sáng trúng Gió Lạc `chase` → `flee` không cướp; trúng lúc `flee` có mang → `drifter_drop {drifter_id, amount}`, đom đóm thành `dropped` tại chỗ, Gió Lạc biến mất sau 120 tick | U + S |
| AC2-34 | Gió Lạc không làm mất lửa; vùng an toàn không chặn; bất tử không ngăn bị cướp | U + S |
| AC2-35 | Bùa Gió: C1 (35,0,0) Đêm 2; C1 (30,0,25), C2 (−30,0,25) Đêm 3; nhặt theo luật đom đóm → `charm_picked {charm_id, charm_ticks}` | U + S |
| AC2-36 | Bùa hiệu lực 600 tick (nhặt lại làm mới): chạy 7.2 m/s; lướt không hồi chiêu (vẫn cần nhấn lại, nhấn khi đang lướt bị bỏ qua, lướt vẫn 14 m/s × 12 tick); bùa xuất hiện lại sau 2700 tick | U + S |
| AC2-37 | Chuỗi 3 Đêm: menu → giới thiệu Đêm (tên đảo, lời Ông Đăng) → chơi → kết quả → Đêm kế; thắng Đêm 3 → màn Bình Minh có tổng điểm (tổng các Đêm thắng); thua → chơi lại Đêm đó | P |
| AC2-38 | Tạm dừng Esc/P: logic dừng hoàn toàn; menu Tiếp tục / Chơi lại Đêm / Cài đặt / Về menu | P + U (sim) |
| AC2-39 | Cài đặt âm lượng + độ nhạy chuột lưu giữa các lần mở (localStorage) | P + U |
| AC2-40 | Âm thanh: nhạc nền đêm + hiệu ứng nhặt, thắp, tỏa sáng, bị đánh, nhảy, lướt, thắng, thua, Bóng Mực xuất hiện, đếm ngược 10 s cuối | P |
| AC2-41 | HUD: lửa (trên trái); mm:ss (trên giữa, đỏ + nhấp nháy khi ≤ 30 s); đèn k/n + điểm (trên phải); thanh 10 ô (dưới giữa); biểu tượng hồi Lướt + Tỏa Sáng (dưới phải); nhắc "E — Nạp ánh sáng (x/10)" gần đèn; mũi tên tới đèn chưa sáng gần nhất khi ngoài màn hình | P + U (hàm định dạng) |
| AC2-42 | Bảng màu chuẩn: các thành phần liệt kê lệch ≤ 10%/kênh RGB so với hex ticket | U (so hằng màu) + P |
| AC2-43 | Ánh sáng môi trường = 0.15 + 0.55 × (đèn sáng / tổng đèn) | U + P |
| AC2-44 | Phần sáng tạo thêm tắt khi headless, không đổi đầu ra | S (so output có/không bật) |

### Phần 4 — Test Contract v1.1
| ID | Tiêu chí | Kiểm |
|---|---|---|
| AC2-50 | `contract_version` "1.1"; tuning khớp Phần 1; có `dash_speed`, `dash_duration_s`, `dash_cooldown_s`, `night2_duration_s`, `night3_duration_s` | U (đọc file) |
| AC2-51 | `--night` 1/2/3 hợp lệ; khác → mã thoát 2 | U + S |
| AC2-52 | Snapshot có `night`, `wind {active, dir_deg}`; `player` có `vel`, `grounded`, `invuln`, `dash_cd_s`, `pulse_cd_s`, `charm_s` | U + S |
| AC2-53 | Snapshot có mảng `motes` (`id`, `pos`, `kind` random/dropped, `ttl_s`), `drifters` (`id`, `pos`, `state`, `stolen`), `charms` (`id`, `available`, `respawn_s`) | U + S |
| AC2-54 | Scenario nhận `player.{invuln_ticks, dash_cd_ticks, pulse_cd_ticks, charm_ticks}`, `shades[].{state, state_ticks_left}`, `drifters`, `charms` (thay danh sách mặc định), cờ `random_drifters`, `wind_enabled`; sai kiểu → mã 2 | U + S |
| AC2-55 | Input `dash`, `pause` kích hoạt ở sườn false → true; sai kiểu → mã 2 | U + S |
| AC2-56 | Đủ 7 sự kiện mới đúng `data`: `dash`, `charm_picked`, `drifter_steal`, `drifter_drop`, `night_start`, `paused`, `resumed` | S |
| AC2-57 | `player_hit` do rơi có `lost` | S |
| AC2-58 | Trạng thái Bóng Mực chỉ dùng `spawning`, `wander`, `chase`, `recoil`, `stunned` | U + S |
| AC2-59 | 21.600 tick một Đêm (mỗi Đêm 1/2/3, random bật) chạy xong ≤ 30 s | Đ (`time`, lưu `perf.txt`) |
| AC2-60 | Tất định: cùng seed + scenario + inputs → output giống hệt từng byte ở cả 3 Đêm; tọa độ làm tròn 3 chữ số | S (chạy 2 lần + `diff`) |
| AC2-61 | Regression: mọi test Phase 1 vẫn đạt sau khi chỉnh theo số chuẩn (mục 2) | U + S |
| AC2-62 | Bản thường ≥ 30 FPS trung bình ở 1280×720 | Đ (đo trong trình duyệt, ghi số) |

## 6. Kế hoạch chia việc

| Việc | Nội dung | AC đóng |
|---|---|---|
| 1 | Tài liệu (file này), contract v1.1, CLAUDE.md, skill verify-proof | AC2-50 |
| 2 | Đêm 1 chuẩn hóa: số chuẩn, bản đồ Đêm 1, nhảy/lướt, đom đóm theo điểm + `dropped`, đèn nạp nhiều lần, vùng an toàn mới, Tỏa Sáng 3D + đẩy 15 tick, Bóng Mực 5 trạng thái + recoil + lịch mới, rơi khỏi đảo, điểm mới, thứ tự 12 bước, pause, định dạng output/scenario/input v1.1; sửa test cũ theo mục 2 | AC2-01…19, 20, 51…58, 60, 61 |
| 3 | Đêm 2 (2 đảo, cầu, bục nhảy) + Gió Lạc + Bùa Gió | AC2-21, 22, 30…36 |
| 4 | Đêm 3 (tầng, dốc, vách, tháp, bục) + gió mạnh + tối ưu hiệu năng 21.600 tick | AC2-23…28, 59 |
| 5 | Bằng chứng: scenario cho mỗi tính năng mới, `scripts/proof.sh 2`, `docs/proof/phase-2/README.md`, đo hiệu năng | tổng hợp mọi AC S/Đ |
| 6 | Giao diện: chuỗi 3 Đêm, pause menu, cài đặt, âm thanh, HUD đầy đủ, bảng màu, ánh sáng theo tiến độ, gió (lá bay), FPS ≥ 30 | AC2-37…44, 62 |

Sau Việc 1, test Phase 1 sẽ đỏ vì contract đổi số. Đây là dự kiến: Việc 1 không sửa code. Việc 2 sửa code và test theo mục 2.
