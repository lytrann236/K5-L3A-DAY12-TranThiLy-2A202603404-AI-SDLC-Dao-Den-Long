import type { Vec3 } from './types';

/** Khoảng cách theo mặt phẳng ngang XZ. */
export function distXZ(a: Vec3, b: Vec3): number {
  return Math.hypot(a[0] - b[0], a[2] - b[2]);
}

/** Khoảng cách 3D. */
export function dist3(a: Vec3, b: Vec3): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

/** Kẹp điểm vào trong đĩa bán kính r quanh gốc (theo XZ), giữ nguyên Y. */
export function clampToDisk(p: Vec3, r: number): void {
  const d = Math.hypot(p[0], p[2]);
  if (d > r) {
    p[0] = (p[0] / d) * r;
    p[2] = (p[2] / d) * r;
  }
}

/** Hướng đơn vị XZ từ `from` tới `to`; trùng vị trí thì trả về +X. */
export function dirXZ(from: Vec3, to: Vec3): [number, number] {
  const dx = to[0] - from[0];
  const dz = to[2] - from[2];
  const d = Math.hypot(dx, dz);
  if (d === 0) return [1, 0];
  return [dx / d, dz / d];
}

/**
 * Tham số t ∈ [0, 1] nhỏ nhất mà đoạn p + t·(dx, dz) chạm đường tròn tâm c bán kính r
 * khi đi từ NGOÀI vào trong; null nếu không chạm. Chỉ dùng XZ.
 */
export function enterCircleT(p: Vec3, dx: number, dz: number, c: Vec3, r: number): number | null {
  const fx = p[0] - c[0];
  const fz = p[2] - c[2];
  const a = dx * dx + dz * dz;
  if (a === 0) return null;
  const b = 2 * (fx * dx + fz * dz);
  const cc = fx * fx + fz * fz - r * r;
  if (cc < 0) return null; // đang ở trong: không coi là "đi vào"
  const disc = b * b - 4 * a * cc;
  if (disc < 0) return null;
  const t = (-b - Math.sqrt(disc)) / (2 * a);
  return t >= 0 && t <= 1 ? t : null;
}

/** Tham số t ∈ [0, 1] mà đoạn p + t·(dx, dz) ra khỏi đĩa tâm gốc bán kính r; null nếu không ra. */
export function exitDiskT(p: Vec3, dx: number, dz: number, r: number): number | null {
  const ex = p[0] + dx;
  const ez = p[2] + dz;
  if (ex * ex + ez * ez <= r * r) return null;
  const a = dx * dx + dz * dz;
  const b = 2 * (p[0] * dx + p[2] * dz);
  const cc = p[0] * p[0] + p[2] * p[2] - r * r;
  if (cc >= 0) return 0; // đã ở trên / ngoài mép
  const t = (-b + Math.sqrt(b * b - 4 * a * cc)) / (2 * a);
  return Math.max(0, Math.min(1, t));
}
