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
