// Ánh xạ phím → input của sim (thuần, không phụ thuộc DOM/three để test được).

/** Tốc độ xoay camera bằng phím mũi tên (độ/giây). */
export const KEY_YAW_RATE_DEG = 120;
export const MOUSE_YAW_DEG_PER_PX = 0.3;
export const MOUSE_PITCH_DEG_PER_PX = 0.2;
export const MIN_PITCH_DEG = 12;
export const MAX_PITCH_DEG = 70;

/**
 * move = [x, z] theo quy ước Test Contract (trước khi xoay theo cam_yaw_deg):
 * W → z +1, S → z −1. Camera nhìn về +Z khi yaw = 0 và three.js là hệ tay phải,
 * nên "phải màn hình" là −X: D → x −1, A → x +1.
 */
export function moveFromKeys(down: ReadonlySet<string>): [number, number] {
  const x = (down.has('KeyA') ? 1 : 0) - (down.has('KeyD') ? 1 : 0);
  const z = (down.has('KeyW') ? 1 : 0) - (down.has('KeyS') ? 1 : 0);
  return [x, z];
}

/** Hướng nhìn ngang của camera trong thế giới ứng với cam_yaw_deg (= hướng của move [0,1]). */
export function cameraForward(yawDeg: number): [number, number] {
  const t = (yawDeg * Math.PI) / 180;
  return [Math.sin(t), Math.cos(t)];
}

/** ← xoay tầm nhìn sang trái (yaw tăng), → sang phải (yaw giảm). */
export function yawDeltaFromKeys(down: ReadonlySet<string>, dtSec: number): number {
  const dir = (down.has('ArrowLeft') ? 1 : 0) - (down.has('ArrowRight') ? 1 : 0);
  return dir * KEY_YAW_RATE_DEG * dtSec;
}

export const normalizeYaw = (deg: number): number => ((deg % 360) + 360) % 360;
export const clampPitch = (deg: number): number =>
  Math.min(MAX_PITCH_DEG, Math.max(MIN_PITCH_DEG, deg));
