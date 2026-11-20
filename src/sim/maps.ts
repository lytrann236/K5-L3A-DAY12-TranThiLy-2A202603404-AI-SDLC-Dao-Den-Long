// Bản đồ chuẩn từng Đêm (ticket-02 Phần 2). Góc đo từ trục +X, ngược chiều kim đồng hồ
// khi nhìn từ trên xuống: điểm ở góc θ, bán kính r là (r·cosθ, y, r·sinθ).
import { ISLAND_RADIUS } from './constants';
import { TUNING } from './contract';
import type { Vec3 } from './types';

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
  /** Bóng Mực bị kẹp trong đĩa bán kính này quanh gốc (phạm vi đảo của Đêm). */
  shadeBound: number;
  /** Độ cao mặt đất tại (x, z); null = không có mặt đất (biển mây). */
  groundAt(x: number, z: number): number | null;
}

/** Các điểm trên vòng tròn bán kính r, bắt đầu ở `startDeg`, cách nhau `stepDeg`. */
export function ring(r: number, count: number, startDeg: number, stepDeg: number, y = 0): Vec3[] {
  return Array.from({ length: count }, (_, k) => {
    const a = ((startDeg + stepDeg * k) * Math.PI) / 180;
    return [r * Math.cos(a), y, r * Math.sin(a)] as Vec3;
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
  shadeBound: ISLAND_RADIUS,
  groundAt: (x, z) => (x * x + z * z <= ISLAND_RADIUS * ISLAND_RADIUS ? 0 : null),
};

/** Các Đêm đã cài đặt. Đêm 2/3 thuộc Việc 3/4. */
export const SUPPORTED_NIGHTS = [1];

export function getMap(night: number): NightMap {
  if (night === 1) return NIGHT1;
  throw new Error(`--night ${night} chưa hỗ trợ`);
}
