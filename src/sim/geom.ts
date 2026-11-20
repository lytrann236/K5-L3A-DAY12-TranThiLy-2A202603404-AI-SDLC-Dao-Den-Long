import type { Vec3 } from './types';

/** Khoảng cách theo mặt phẳng ngang XZ. */
export function distXZ(a: Vec3, b: Vec3): number {
  return Math.hypot(a[0] - b[0], a[2] - b[2]);
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

/** Điểm ngẫu nhiên đều trong đĩa bán kính r (Y = y), thỏa `accept`. */
export function randomPointInDisk(
  rng: () => number,
  r: number,
  y: number,
  accept: (p: Vec3) => boolean,
): Vec3 {
  for (;;) {
    const rad = r * Math.sqrt(rng());
    const theta = 2 * Math.PI * rng();
    const p: Vec3 = [rad * Math.cos(theta), y, rad * Math.sin(theta)];
    if (accept(p)) return p;
  }
}
