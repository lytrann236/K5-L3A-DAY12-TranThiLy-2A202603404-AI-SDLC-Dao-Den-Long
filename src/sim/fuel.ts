// Nhiên liệu đèn (ticket-03 mục 1–2). Dầu lưu bằng số nguyên đơn vị 1/60 fuel (ADR 0001).
import { CAPACITY_PER_LIGHT, DRAIN_RADIUS, FUEL_DRAIN_EVENT_TICKS, TICK_RATE } from './constants';
import { TUNING } from './contract';
import { distXZ } from './geom';
import type { GameState, Lantern, Player, Shade, SimEvent } from './types';

/** Số đơn vị mỗi 1 fuel. */
export const FUEL_UNIT = TICK_RATE;
export const FUEL_MAX_U = TUNING.fuel_max * FUEL_UNIT;
/** Đơn vị trừ mỗi tick: hao (1/s → 1/60 mỗi tick = 1 đơn vị) và hút (5/s → 5 đơn vị). */
export const DECAY_U = Math.round((TUNING.fuel_decay_per_s * FUEL_UNIT) / TICK_RATE);
export const DRAIN_U = Math.round((TUNING.drain_per_s * FUEL_UNIT) / TICK_RATE);
export const REFUEL_U = TUNING.fuel_per_mote * FUEL_UNIT;
export const LOW_FUEL_U = TUNING.low_fuel_threshold * FUEL_UNIT;
/** Dung sai so khoảng cách 2 m (bóng dừng đúng 2 m có thể lệch vài ulp). */
const R_EPS = 1e-9;

/** fuel xuất ra: 1 chữ số thập phân; đèn tắt = 0. */
export const fuelOut = (l: Lantern): number => (l.lit ? Math.round(Math.max(0, l.fuelU) / 6) / 10 : 0);

/** Đèn có vùng an toàn: sáng và fuel ≥ 30. */
export const hasSafeZone = (l: Lantern): boolean => l.lit && l.fuelU >= LOW_FUEL_U;
/** Đèn yếu (Bóng Mực nhắm tới): sáng và fuel < 30. */
export const isWeak = (l: Lantern): boolean => l.lit && l.fuelU < LOW_FUEL_U;
/** Đèn nhận được đom đóm: chưa sáng, hoặc sáng mà chưa đầy dầu. */
export const isAccepting = (l: Lantern): boolean => !l.lit || l.fuelU < FUEL_MAX_U;
/** Giá thắp: đèn từng sáng chỉ cần relight_cost. */
export const lightCost = (l: Lantern): number => (l.everLit ? TUNING.relight_cost : TUNING.lantern_cost);
/** Sức chứa = min(capacity_max, carry_capacity + 2 × successful_lights). */
export const capacity = (p: Player): number =>
  Math.min(TUNING.capacity_max, TUNING.carry_capacity + CAPACITY_PER_LIGHT * p.successfulLights);

export const withinDrain = (sh: Shade, l: Lantern): boolean => distXZ(sh.pos, l.pos) <= DRAIN_RADIUS + R_EPS;

/** Đưa bóng về `wander` (bỏ mục tiêu hút). */
export function toWander(sh: Shade): void {
  sh.state = 'wander';
  sh.targetLanternId = null;
  sh.drainTicks = 0;
}

/**
 * Bước 2 (phần dầu): mọi đèn sáng hao DECAY_U; mỗi bóng `drain` (không đang bị đẩy) hút DRAIN_U từ
 * đèn mục tiêu, đếm tick hút và phát `fuel_drain` ở tick hút thứ 60, 120, … (fuel sau khi trừ cả tick).
 * Ngay sau đó đèn fuelU ≤ 0 tắt: deposited 0, `lantern_out`, các bóng hút đèn đó về `wander`.
 */
export function tickFuel(s: GameState, events: SimEvent[]): void {
  for (const l of s.lanterns) if (l.lit) l.fuelU -= DECAY_U;
  const report: Shade[] = [];
  for (const sh of s.shades) {
    if (sh.state !== 'drain' || sh.safeTicks > 0) continue;
    const l = s.lanterns.find((x) => x.id === sh.targetLanternId);
    if (!l || !l.lit) continue;
    l.fuelU -= DRAIN_U;
    sh.drainTicks++;
    if (sh.drainTicks % FUEL_DRAIN_EVENT_TICKS === 0) report.push(sh);
  }
  for (const sh of report) {
    const l = s.lanterns.find((x) => x.id === sh.targetLanternId)!;
    events.push({ name: 'fuel_drain', data: { lantern_id: l.id, shade_id: sh.id, fuel: fuelOut(l) } });
  }
  for (const l of s.lanterns) {
    if (!l.lit || l.fuelU > 0) continue;
    l.lit = false;
    l.fuelU = 0;
    l.deposited = 0;
    events.push({ name: 'lantern_out', data: { lantern_id: l.id } });
    for (const sh of s.shades) if (sh.state === 'drain' && sh.targetLanternId === l.id) toWander(sh);
  }
}
