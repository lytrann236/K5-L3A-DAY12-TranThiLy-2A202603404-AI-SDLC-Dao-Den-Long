import { TICK_RATE } from '../sim/constants';

/** Thời lượng một tick (ms). */
export const TICK_MS = 1000 / TICK_RATE;

/** Số tick tối đa xử lý trong một khung hình (tránh "xoáy ốc" khi tab bị treo). */
export const MAX_TICKS_PER_FRAME = 5;

/**
 * Accumulator cho vòng lặp fixed timestep: cộng dt thật (ms), trả về số tick cần chạy
 * và phần dư còn lại. Nếu tồn đọng vượt `maxTicks` thì bỏ phần dư (không đuổi theo).
 */
export function advance(
  accMs: number,
  dtMs: number,
  maxTicks: number = MAX_TICKS_PER_FRAME,
): { ticks: number; accMs: number } {
  const acc = accMs + Math.max(0, dtMs);
  // 1e-9: tránh mất một tick do sai số số thực (60 khung × 16.666… ms).
  const due = Math.floor(acc / TICK_MS + 1e-9);
  if (due > maxTicks) return { ticks: maxTicks, accMs: 0 };
  return { ticks: due, accMs: Math.max(0, acc - due * TICK_MS) };
}
