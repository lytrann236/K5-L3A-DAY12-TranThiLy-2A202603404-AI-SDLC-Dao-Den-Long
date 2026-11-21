// Hằng số KHÔNG có trong game.contract.json — lấy từ ticket-02.md (số chuẩn) và
// mục 4 "Giả định" của docs/notes/phase-2.md. Tuning gameplay đọc từ ./contract.ts.
// Bản đồ từng Đêm nằm ở ./maps.ts.

/** Số tick mỗi giây (Test Contract: 60 tick/giây cố định). */
export const TICK_RATE = 60;

/** Bán kính đảo Đêm 1 (dùng cho render và bản đồ Đêm 1). */
export const ISLAND_RADIUS = 40;

/** Nhảy: vận tốc đầu 7 m/s, trọng lực 20 m/s² (ticket-02 Phần 1). */
export const JUMP_SPEED = 7;
export const GRAVITY = 20;

/** Bùa Gió: tốc độ chạy khi có hiệu lực (m/s). */
export const CHARM_RUN_SPEED = 7.2;

/** Nhặt đom đóm / bùa: chênh cao tối đa giữa chân Mây và mặt đất nơi đặt (m). */
export const PICKUP_MAX_DY = 1.5;

/** Đom đóm: 20 con lúc đầu, trần 30, sinh thêm 1 con ở tick 240, 480, … */
export const MOTE_INITIAL_COUNT = 20;
export const MOTE_MAX_COUNT = 30;
export const MOTE_SPAWN_INTERVAL_TICKS = 240;
/** Đom đóm rơi khi bị đánh: vành 1.5–2.5 m quanh Mây, tồn tại 480 tick. */
export const DROP_RING_MIN = 1.5;
export const DROP_RING_MAX = 2.5;
export const DROP_TTL_TICKS = 480;

/** Tỏa Sáng: tâm = chân Mây + 0.8 m; đẩy lùi chia đều trong 15 tick đầu của choáng. */
export const PULSE_CENTER_DY = 0.8;
export const PULSE_PUSH_TICKS = 15;

/** Bóng Mực lơ lửng cao hơn mặt đất 1.0 m (tâm). */
export const SHADE_Y = 1;
/** Chạm Bóng Mực: chênh cao tối đa giữa chân Mây và mặt đất dưới tâm bóng (m). */
export const SHADE_HIT_MAX_DY = 1.5;
/** Phát hiện ≤ 12 m (wander → chase), bỏ đuổi > 18 m (chase → wander). Đo XZ. */
export const SHADE_DETECT_RADIUS = 12;
export const SHADE_LOSE_RADIUS = 18;
/** Trạng thái `spawning` kéo dài 30 tick (đứng yên, không gây hit, vẫn trúng Tỏa Sáng). */
export const SHADE_SPAWNING_TICKS = 30;
/** Bóng gây hit lùi 2 m trong 60 tick (`recoil`). */
export const SHADE_RECOIL_M = 2;
export const SHADE_RECOIL_TICKS = 60;
/** Bóng ở trong vùng lúc đèn vừa thắp bị đẩy ra mép trong 30 tick. */
export const SAFE_PUSH_TICKS = 30;
/** Bóng Mực mới sinh cách Mây ≥ 15 m. */
export const SHADE_SPAWN_MIN_DIST = 15;

/** Rơi khỏi đảo: Y < −10; chờ 60 tick rồi hồi sinh. */
export const FALL_Y = -10;
export const RESPAWN_WAIT_TICKS = 60;

/** Đêm 2 — Đảo Cau: hai đảo r 28 tâm (0,0,0) và (70,0,0), cầu tre x ∈ [26, 44], z ∈ [−2, 2]. */
export const N2_ISLAND_RADIUS = 28;
export const N2_ISLAND_B_X = 70;
export const N2_BRIDGE_X: readonly [number, number] = [26, 44];
export const N2_BRIDGE_HALF_W = 2;

/** Bục nhảy: hình tròn bán kính 1 m. Đêm 2: vy 14 m/s, ngang 24 m/s về tâm đảo kia. */
export const PAD_RADIUS = 1;
export const N2_PAD_VY = 14;
export const N2_PAD_VH = 24;

/** Gió Lạc (ticket-02 Phần 3). */
export const DRIFTER_SPEED = 7;
export const DRIFTER_IDLE_SPEED = 2;
export const DRIFTER_IDLE_RADIUS = 4;
export const DRIFTER_Y = 1;
export const DRIFTER_TOUCH_RADIUS = 1.2;
export const DRIFTER_STEAL_MAX = 3;
export const DRIFTER_CHASE_MIN_CARRIED = 5;
export const DRIFTER_CHASE_RADIUS = 15;
export const DRIFTER_FLEE_TICKS = 240;
export const DRIFTER_DROP_VANISH_TICKS = 120;
export const DRIFTER_SPAWN_INTERVAL_TICKS = 1200;
export const DRIFTER_MAX = 2;

/** Bùa Gió: hiệu lực 600 tick, xuất hiện lại sau 2700 tick. */
export const CHARM_TICKS = 600;
export const CHARM_RESPAWN_TICKS = 2700;

/** Đêm 3 — Đảo Chuông (ticket-02 Phần 2). */
export const N3_ISLAND_RADIUS = 45;
/** Tầng 1 (Y = 3): vành khăn r 12–24 ở nửa z > 0. Tầng 2 (Y = 6): đĩa r 8 ở tâm. */
export const N3_TIER1_Y = 3;
export const N3_TIER1_R: readonly [number, number] = [12, 24];
export const N3_TIER2_Y = 6;
export const N3_TIER2_R = 8;
/** 2 dốc thẳng rộng 3 m dọc bán kính ở 30° và 150°: chân r 30 (Y 0), đỉnh r 24 (Y 3). */
export const N3_RAMP_DEG: readonly number[] = [30, 150];
export const N3_RAMP_HALF_W = 1.5;
export const N3_RAMP_R: readonly [number, number] = [24, 30];
/** Tháp chuông: trụ r 2, cao 8 m trên tầng 2, ở tâm. Chặn Mây và Bóng Mực. */
export const N3_TOWER_R = 2;
export const N3_TOWER_H = 8;
/** Bục nhảy (0,3,13): vy 12 m/s, ngang 8 m/s hướng −Z. */
export const N3_PAD_POS: readonly [number, number, number] = [0, 3, 13];
export const N3_PAD_VY = 12;
export const N3_PAD_VH = 8;
/** Bóng Mực Đêm 3: 4.5 m/s. */
export const N3_SHADE_SPEED = 4.5;
/**
 * Bậc tối đa Mây tự bước lên / xuống mà vẫn bám đất (m), dùng cho dốc Đêm 3. Lớn hơn độ dâng
 * mỗi tick trên dốc (≤ 0.134 m khi lướt + gió) và nhỏ hơn mọi vách tầng (3 m).
 */
export const STEP_HEIGHT = 0.3;

/** Gió mạnh Đêm 3: cơn k ≥ 1 thổi sim_tick [1800k, 1800k + 300), báo trước 120 tick, đẩy 2 m/s. */
export const WIND_PERIOD_TICKS = 1800;
export const WIND_GUST_TICKS = 300;
export const WIND_WARN_TICKS = 120;
export const WIND_SPEED = 2;
/** Gió dùng luồng RNG riêng sinh từ seed (seed XOR hằng này), để bật/tắt gió không đổi lịch sinh. */
export const WIND_SEED_SALT = 0x5f3759df;

/** Phase 3 (ticket-03): sức chứa +2 mỗi lần thắp thành công. */
export const CAPACITY_PER_LIGHT = 2;
/** Bóng Mực `wander` cách đèn yếu ≤ 2 m (XZ) thì `drain`; `drain` mà Mây ≤ 6 m thì `chase`. */
export const DRAIN_RADIUS = 2;
export const DRAIN_CHASE_RADIUS = 6;
/** `fuel_drain` phát mỗi 60 tick hút. */
export const FUEL_DRAIN_EVENT_TICKS = 60;
