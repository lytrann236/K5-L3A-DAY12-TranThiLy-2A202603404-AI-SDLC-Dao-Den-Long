// Hình học Đêm 3 — Đảo Chuông (ticket-02 Phần 2; phase-2.md 4.1 "Va chạm Đêm 3").
// - Tầng 0 (Y 0): toàn đảo r 45. Tầng 1 (Y 3): vành khăn r 12–24, z > 0. Tầng 2 (Y 6): đĩa r 8.
// - 2 dốc rộng 3 m ở 30° và 150°: chân r 30 (Y 0) → đỉnh r 24 (Y 3), nối liền tầng 1.
// - Tháp chuông trụ r 2 ở tâm (chặn Mây và Bóng Mực).
// Vách tầng: Mây không đi lên được chỗ có mặt đất cao hơn chân quá STEP_HEIGHT, bị đẩy về điểm tự do
// gần nhất trên mép vách (bỏ thành phần đi vào vách, giữ thành phần tiếp tuyến = trượt theo vách).
import {
  N3_ISLAND_RADIUS,
  N3_RAMP_DEG,
  N3_RAMP_HALF_W,
  N3_RAMP_R,
  N3_TIER1_R,
  N3_TIER1_Y,
  N3_TIER2_R,
  N3_TIER2_Y,
  N3_TOWER_R,
} from './constants';

const R = N3_ISLAND_RADIUS;
const [T1_IN, T1_OUT] = N3_TIER1_R;
const [RAMP_TOP, RAMP_FOOT] = N3_RAMP_R;
const RAMPS = N3_RAMP_DEG.map((d) => [Math.cos((d * Math.PI) / 180), Math.sin((d * Math.PI) / 180)] as const);
/** Lùi ra khỏi vách một chút khi đẩy Mây về mép, để điểm mới chắc chắn ở phía tự do. */
const WALL_EPS = 1e-9;
/** Quãng đẩy lớn nhất được chấp nhận khi trượt theo vách (lớn hơn quãng đi tối đa mỗi tick). */
const MAX_PUSH = 1;

/** Độ cao mặt đất tại (x, z) ở Đêm 3; null = biển mây. Trong tháp trả về Y tầng 2 (chân tháp). */
export function n3Ground(x: number, z: number): number | null {
  const r2 = x * x + z * z;
  if (r2 > R * R) return null;
  if (r2 <= N3_TIER2_R * N3_TIER2_R) return N3_TIER2_Y;
  if (z > 0 && r2 >= T1_IN * T1_IN && r2 <= T1_OUT * T1_OUT) return N3_TIER1_Y;
  if (r2 > T1_OUT * T1_OUT) {
    for (const [ax, az] of RAMPS) {
      const u = x * ax + z * az;
      const w = -x * az + z * ax;
      if (u > 0 && u <= RAMP_FOOT && Math.abs(w) <= N3_RAMP_HALF_W) {
        return Math.min(N3_TIER1_Y, (N3_TIER1_Y * (RAMP_FOOT - u)) / (RAMP_FOOT - RAMP_TOP));
      }
    }
  }
  return 0;
}

/** Điểm (x, z) nằm trong tháp chuông (trụ r 2 ở tâm). */
export const inTower = (x: number, z: number) => x * x + z * z < N3_TOWER_R * N3_TOWER_R;

/** Mây có chân cao tối đa `maxY` không vào được (x, z): trong tháp, hoặc mặt đất cao hơn `maxY`. */
function blocked(x: number, z: number, maxY: number): boolean {
  if (inTower(x, z)) return true;
  const g = n3Ground(x, z);
  return g !== null && g > maxY;
}

/** Điểm chiếu của (x, z) lên đường tròn tâm gốc bán kính `r` (lệch `eps` theo bán kính). */
function onCircle(x: number, z: number, r: number, eps: number, fx: number, fz: number): [number, number] {
  let d = Math.hypot(x, z);
  if (d === 0) {
    // Trùng tâm: đẩy theo hướng từ tâm tới vị trí cũ.
    x = fx;
    z = fz;
    d = Math.hypot(x, z) || 1;
  }
  const k = (r + eps) / d;
  return [x * k, z * k];
}

/** Các điểm ứng viên trên mép mọi vách (chiếu vuông góc), để chọn điểm tự do gần nhất. */
function wallCandidates(x: number, z: number, x0: number, z0: number): [number, number][] {
  const c: [number, number][] = [
    onCircle(x, z, N3_TOWER_R, WALL_EPS, x0, z0),
    onCircle(x, z, N3_TIER2_R, WALL_EPS, x0, z0),
    onCircle(x, z, T1_IN, -WALL_EPS, x0, z0),
    onCircle(x, z, T1_OUT, WALL_EPS, x0, z0),
    [x, 0], // mép z = 0 của tầng 1 (z > 0 mới là tầng 1)
  ];
  for (const [ax, az] of RAMPS) {
    const w = -x * az + z * ax;
    for (const side of [1, -1]) {
      const dw = side * (N3_RAMP_HALF_W + WALL_EPS) - w;
      c.push([x - az * dw, z + ax * dw]);
    }
  }
  return c;
}

/**
 * Di chuyển ngang của Mây từ (x0, z0) tới (x1, z1) khi chân cao tối đa `maxY` (đã cộng bậc cho phép).
 * Không vướng thì đi tới đích. Vướng vách tầng / dốc / tháp thì về điểm tự do gần đích nhất trên mép
 * vách (trượt theo vách). Kẹt ở góc (không có điểm tự do trong 1 m) thì đứng yên.
 */
export function n3ResolveMove(x0: number, z0: number, x1: number, z1: number, maxY: number): [number, number] {
  if (!blocked(x1, z1, maxY)) return [x1, z1];
  let best: [number, number] | null = null;
  let bestD = MAX_PUSH;
  for (const p of wallCandidates(x1, z1, x0, z0)) {
    const d = Math.hypot(p[0] - x1, p[1] - z1);
    if (d <= bestD && !blocked(p[0], p[1], maxY)) {
      best = p;
      bestD = d;
    }
  }
  return best ?? [x0, z0];
}

/**
 * Bóng Mực trượt quanh tháp: điểm trong tháp được đẩy ra mép r 2 theo bán kính (giữ thành phần tiếp
 * tuyến). Trả về null nếu không chạm tháp.
 */
export function n3TowerPush(x: number, z: number, fromX: number, fromZ: number): [number, number] | null {
  return inTower(x, z) ? onCircle(x, z, N3_TOWER_R, WALL_EPS, fromX, fromZ) : null;
}

/** Điểm đứng được (có mặt đất, ngoài tháp) gần (x, z) nhất. */
export function n3NearestGround(x: number, z: number): [number, number] {
  const d = Math.hypot(x, z);
  if (d > R) return [(x / d) * (R - WALL_EPS), (z / d) * (R - WALL_EPS)];
  if (inTower(x, z)) return onCircle(x, z, N3_TOWER_R, WALL_EPS, 1, 0);
  return [x, z];
}
