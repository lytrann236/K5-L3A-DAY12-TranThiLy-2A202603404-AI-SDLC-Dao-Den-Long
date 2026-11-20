// Hằng số KHÔNG có trong game.contract.json — lấy từ mục "Giả định"
// của docs/notes/phase-1.md. Tuning gameplay đọc từ ./contract.ts.

/** Số tick mỗi giây (Test Contract: 60 tick/giây cố định). */
export const TICK_RATE = 60;

/** Đảo tròn bán kính 40 m, tâm (0,0,0). */
export const ISLAND_RADIUS = 40;

/** Đèn nằm trên vòng tròn bán kính 22 m, góc 90° + (360/n)·k. */
export const LANTERN_RING_RADIUS = 22;
export const LANTERN_START_ANGLE_DEG = 90;

/** Đom đóm ngẫu nhiên: 30 con, trong bán kính 38 m, cách gốc ≥ 3 m. */
export const MOTE_COUNT = 30;
export const MOTE_SPAWN_RADIUS = 38;
export const MOTE_MIN_ORIGIN_DIST = 3;

/** Nhảy: vận tốc đầu 6 m/s, trọng lực 20 m/s². */
export const JUMP_SPEED = 6;
export const GRAVITY = 20;

/** Bóng Mực lơ lửng ở Y = 1.0. */
export const SHADE_Y = 1;
/** Bóng Mực ngẫu nhiên: 3 con lúc đầu (cách người chơi ≥ 25 m), thêm 1 con mỗi 45 s
 *  (cách ≥ 20 m), tối đa 6. Vùng sinh: bán kính 38 m (đã chốt với người dùng). */
export const SHADE_INITIAL_COUNT = 3;
export const SHADE_MAX_COUNT = 6;
export const SHADE_SPAWN_INTERVAL_S = 45;
export const SHADE_INITIAL_MIN_DIST = 25;
export const SHADE_SPAWN_MIN_DIST = 20;
export const SHADE_SPAWN_RADIUS = 38;
