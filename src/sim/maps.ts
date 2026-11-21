// Bản đồ chuẩn từng Đêm (ticket-02 Phần 2). Góc đo từ trục +X, ngược chiều kim đồng hồ
// khi nhìn từ trên xuống: điểm ở góc θ, bán kính r là (r·cosθ, y, r·sinθ).
import {
  ISLAND_RADIUS,
  N2_BRIDGE_HALF_W,
  N2_BRIDGE_X,
  N2_ISLAND_B_X,
  N2_ISLAND_RADIUS,
  N2_PAD_VH,
  N2_PAD_VY,
  PAD_RADIUS,
} from './constants';
import { TUNING } from './contract';
import { clampToDisk, exitDiskT } from './geom';
import type { Vec3 } from './types';

/** Bục nhảy: chân Mây chạm đĩa bán kính `radius` quanh `pos` thì bị bắn với vận tốc `vel`. */
export interface JumpPad {
  pos: Vec3;
  radius: number;
  /** Vận tốc phóng [vx, vy, vz] (m/s), giữ nguyên phần ngang tới khi chạm đất. */
  vel: Vec3;
}

export interface NightMap {
  night: number;
  durationS: number;
  /** Điểm xuất phát / hồi sinh (chân Mây) và hướng quay mặt ban đầu (XZ). */
  start: Vec3;
  startFacing: [number, number];
  lanterns: { id: string; pos: Vec3 }[];
  moteSpawns: Vec3[];
  shadeSpawns: Vec3[];
  /** Lịch sinh Bóng Mực: 2 con ở `firstTick`, sau đó 1 con mỗi `intervalTicks`; tối đa `max` con tồn tại. */
  shadeFirstTick: number;
  shadeIntervalTicks: number;
  shadeMax: number;
  shadeSpeed: number;
  /** Bục nhảy của Đêm (Đêm 1 không có). */
  pads: JumpPad[];
  /** Bùa Gió mặc định (id, vị trí). Đêm 1 không có. */
  charms: { id: string; pos: Vec3 }[];
  /** Đêm có Gió Lạc (Đêm 2, 3). Điểm sương = điểm sinh Bóng Mực (phase-2.md 4.1). */
  drifters: boolean;
  /** Độ cao mặt đất tại (x, z); null = không có mặt đất (biển mây). */
  groundAt(x: number, z: number): number | null;
  /**
   * Bóng Mực bị kẹp trong phạm vi đảo của Đêm: tham số t ∈ [0, 1] mà đoạn p + t·(dx, dz) ra khỏi
   * phạm vi; null nếu không ra.
   */
  shadeExitT(p: Vec3, dx: number, dz: number): number | null;
  /** Điểm có mặt đất gần (x, z) nhất (XZ) — dùng khi đom đóm rơi / được thả ra ngoài đảo. */
  nearestGround(x: number, z: number): [number, number];
}

/** Các điểm trên vòng tròn bán kính r, bắt đầu ở `startDeg`, cách nhau `stepDeg`. */
export function ring(r: number, count: number, startDeg: number, stepDeg: number, y = 0, cx = 0, cz = 0): Vec3[] {
  return Array.from({ length: count }, (_, k) => {
    const a = ((startDeg + stepDeg * k) * Math.PI) / 180;
    return [cx + r * Math.cos(a), y, cz + r * Math.sin(a)] as Vec3;
  });
}

const NIGHT1: NightMap = {
  night: 1,
  durationS: TUNING.night1_duration_s,
  start: [0, 0, 0],
  startFacing: [0, 1],
  lanterns: [
    { id: 'L1', pos: [0, 0, 25] },
    { id: 'L2', pos: [23.8, 0, 7.7] },
    { id: 'L3', pos: [14.7, 0, -20.2] },
    { id: 'L4', pos: [-14.7, 0, -20.2] },
    { id: 'L5', pos: [-23.8, 0, 7.7] },
  ],
  // 8 điểm r 12 (mỗi 45°) + 16 điểm r 33 (mỗi 22.5°), bắt đầu ở 0° (phase-2.md 4.2).
  moteSpawns: [...ring(12, 8, 0, 45), ...ring(33, 16, 0, 22.5)],
  // 12 điểm r 37: 15°, 45°, …
  shadeSpawns: ring(37, 12, 15, 30),
  shadeFirstTick: 300,
  shadeIntervalTicks: 480,
  shadeMax: 6,
  shadeSpeed: TUNING.shade_speed,
  pads: [],
  charms: [],
  drifters: false,
  groundAt: (x, z) => (x * x + z * z <= ISLAND_RADIUS * ISLAND_RADIUS ? 0 : null),
  shadeExitT: (p, dx, dz) => exitDiskT(p, dx, dz, ISLAND_RADIUS),
  nearestGround: (x, z) => {
    const v: Vec3 = [x, 0, z];
    clampToDisk(v, ISLAND_RADIUS);
    return [v[0], v[2]];
  },
};

// ---- Đêm 2 — Đảo Cau ----
const R2 = N2_ISLAND_RADIUS;
const BX = N2_ISLAND_B_X;
const [BRIDGE_X0, BRIDGE_X1] = N2_BRIDGE_X;
const BW = N2_BRIDGE_HALF_W;
/** Lùi vào trong một chút khi chiếu lên mép, để điểm chiếu chắc chắn "có mặt đất". */
const EDGE_IN = 1e-9;

const n2Ground = (x: number, z: number): number | null =>
  x * x + z * z <= R2 * R2 ||
  (x - BX) * (x - BX) + z * z <= R2 * R2 ||
  (x >= BRIDGE_X0 && x <= BRIDGE_X1 && z >= -BW && z <= BW)
    ? 0
    : null;

/** Số lần chia đôi khi tìm điểm bóng chạm mép phạm vi (sai số ≤ 2^-30 quãng đi). */
const EXIT_BISECT_STEPS = 30;

/** Bục nhảy Đêm 2: vận tốc ngang 24 m/s hướng về tâm đảo kia. */
function padToward(pos: Vec3, target: Vec3): JumpPad {
  const dx = target[0] - pos[0];
  const dz = target[2] - pos[2];
  const d = Math.hypot(dx, dz);
  return { pos, radius: PAD_RADIUS, vel: [(dx / d) * N2_PAD_VH, N2_PAD_VY, (dz / d) * N2_PAD_VH] };
}

const NIGHT2: NightMap = {
  night: 2,
  durationS: TUNING.night2_duration_s,
  start: [0, 0, 0],
  startFacing: [0, 1],
  lanterns: [
    { id: 'L1', pos: [0, 0, 20] },
    { id: 'L2', pos: [17, 0, -10] },
    { id: 'L3', pos: [-17, 0, -10] },
    { id: 'L4', pos: [70, 0, 20] },
    { id: 'L5', pos: [87, 0, -10] },
    { id: 'L6', pos: [53, 0, -10] },
  ],
  // Mỗi đảo: 4 điểm r 10 (0°, 90°, 180°, 270°) + 8 điểm r 22 (mỗi 45° từ 0°); đảo A trước, rồi B.
  moteSpawns: [
    ...ring(10, 4, 0, 90),
    ...ring(22, 8, 0, 45),
    ...ring(10, 4, 0, 90, 0, BX),
    ...ring(22, 8, 0, 45, 0, BX),
  ],
  // Mỗi đảo 8 điểm r 26: 22.5°, 67.5°, …
  shadeSpawns: [...ring(26, 8, 22.5, 45), ...ring(26, 8, 22.5, 45, 0, BX)],
  shadeFirstTick: 300,
  shadeIntervalTicks: 420,
  shadeMax: 8,
  shadeSpeed: TUNING.shade_speed,
  pads: [padToward([20, 0, 18], [BX, 0, 0]), padToward([50, 0, -18], [0, 0, 0])],
  charms: [{ id: 'C1', pos: [35, 0, 0] }],
  drifters: true,
  groundAt: n2Ground,
  shadeExitT: (p, dx, dz) => {
    if (n2Ground(p[0] + dx, p[2] + dz) !== null) return null;
    if (n2Ground(p[0], p[2]) === null) return 0; // đã ở ngoài: không cho đi tiếp ra ngoài
    let lo = 0;
    let hi = 1;
    for (let i = 0; i < EXIT_BISECT_STEPS; i++) {
      const mid = (lo + hi) / 2;
      if (n2Ground(p[0] + dx * mid, p[2] + dz * mid) !== null) lo = mid;
      else hi = mid;
    }
    return lo;
  },
  nearestGround: (x, z) => {
    const onDisk = (cx: number): [number, number] => {
      const d = Math.hypot(x - cx, z);
      if (d <= R2) return [x, z];
      const k = (R2 - EDGE_IN) / d;
      return [cx + (x - cx) * k, z * k];
    };
    const cands: [number, number][] = [
      onDisk(0),
      onDisk(BX),
      [Math.min(BRIDGE_X1, Math.max(BRIDGE_X0, x)), Math.min(BW, Math.max(-BW, z))],
    ];
    let best = cands[0];
    for (const c of cands) {
      if (Math.hypot(c[0] - x, c[1] - z) < Math.hypot(best[0] - x, best[1] - z)) best = c;
    }
    return best;
  },
};

/** Các Đêm đã cài đặt. Đêm 3 thuộc Việc 4. */
export const SUPPORTED_NIGHTS = [1, 2];

export function getMap(night: number): NightMap {
  if (night === 1) return NIGHT1;
  if (night === 2) return NIGHT2;
  throw new Error(`--night ${night} chưa hỗ trợ`);
}
