import { SAFE_PUSH_TICKS } from './constants';
import { TUNING } from './contract';
import {
  FUEL_MAX_U,
  LOW_FUEL_U,
  REFUEL_U,
  fuelOut,
  hasSafeZone,
  isAccepting,
  lightCost,
  toWander,
} from './fuel';
import { dirXZ, distXZ } from './geom';
import { moveShade } from './shades';
import type { GameState, Lantern, SimEvent } from './types';

/** Bóng cách tâm đèn < safe_radius − EPS coi là ở trong vùng (tránh rung ở đúng mép). */
const INSIDE_EPS = 1e-6;

/**
 * Đèn nhận được (chưa sáng, hoặc sáng mà chưa đầy dầu) gần nhất trong interact_radius (XZ);
 * hòa thì id nhỏ hơn (thứ tự trong mảng). Phase 3: thay `nearestUnlit` (ticket-03 mục 1).
 */
export function nearestAccepting(s: GameState): Lantern | null {
  let best: Lantern | null = null;
  let bestD = Infinity;
  for (const l of s.lanterns) {
    if (!isAccepting(l)) continue;
    const d = distXZ(l.pos, s.player.pos);
    if (d <= TUNING.interact_radius && d < bestD) {
      best = l;
      bestD = d;
    }
  }
  return best;
}

/**
 * Bước 5: Tương tác với đèn nhận được gần nhất.
 * - Đèn tắt: nạp min(carried, giá thắp − deposited) (giá 10, hoặc 5 nếu `ever_lit`); đủ thì thắp,
 *   fuel 100, `lantern_lit {relight}`, +per_lantern (lần đầu) / +per_relight, successful_lights +1.
 * - Đèn sáng chưa đầy: châm used = min(carried, ceil((100 − fuel)/10)), fuel = min(100, fuel + 10·used),
 *   `refuel`. Châm lên ≥ 30: bóng đang hút đèn này về `wander` (bước 6 đẩy chúng ra mép).
 * Mỗi đom đóm nạp +per_mote. Trả về các đèn vừa thắp trong tick này.
 */
export function interact(s: GameState, pressed: boolean, events: SimEvent[]): Lantern[] {
  const p = s.player;
  if (!pressed || p.respawn > 0 || p.carried <= 0) return [];
  const best = nearestAccepting(s);
  if (!best) return [];

  if (best.lit) {
    const used = Math.min(p.carried, Math.ceil((FUEL_MAX_U - best.fuelU) / REFUEL_U));
    if (used <= 0) return [];
    p.carried -= used;
    best.fuelU = Math.min(FUEL_MAX_U, best.fuelU + REFUEL_U * used);
    s.score += TUNING.score.per_mote * used;
    events.push({ name: 'refuel', data: { lantern_id: best.id, amount: used, fuel: fuelOut(best) } });
    if (best.fuelU >= LOW_FUEL_U) {
      for (const sh of s.shades) if (sh.state === 'drain' && sh.targetLanternId === best.id) toWander(sh);
    }
    return [];
  }

  const cost = lightCost(best);
  const amount = Math.min(p.carried, cost - best.deposited);
  if (amount <= 0) return [];
  p.carried -= amount;
  best.deposited += amount;
  s.score += TUNING.score.per_mote * amount;
  events.push({ name: 'deposit', data: { lantern_id: best.id, amount, deposited: best.deposited } });
  if (best.deposited < cost) return [];
  const relight = best.everLit;
  best.lit = true;
  best.everLit = true;
  best.fuelU = FUEL_MAX_U;
  if (relight) best.relitCount++;
  p.successfulLights++;
  s.score += relight ? TUNING.score.per_relight : TUNING.score.per_lantern;
  events.push({ name: 'lantern_lit', data: { lantern_id: best.id, relight } });
  return [best];
}

// Bước 2 (phần vùng an toàn): đếm lùi thời gian đẩy ra.
export function tickSafeTimers(s: GameState): void {
  for (const sh of s.shades) if (sh.safeTicks > 0) sh.safeTicks--;
}

/**
 * Bước 6: vùng an toàn. Chỉ đèn sáng có fuel ≥ 30 (Phase 3). Bóng đang ở trong vùng (r 6) — lúc
 * đèn vừa thắp, hoặc vừa được châm lên ≥ 30 — bị đẩy tuyến tính ra mép trong đúng 30 tick (quãng
 * 6 − d chia đều, trùng tâm → +X), tính cả tick bắt đầu. Trong 30 tick đó bóng không tự di chuyển và
 * không gây hit. Bóng `drain` bị đẩy thì về `wander`. Bóng ở ngoài bị chặn ở mép khi di chuyển.
 */
export function updateSafeZones(s: GameState): void {
  for (const sh of s.shades) {
    if (sh.safeTicks === 0) {
      for (const l of s.lanterns) {
        if (!hasSafeZone(l)) continue;
        const d = distXZ(sh.pos, l.pos);
        if (d >= TUNING.safe_radius - INSIDE_EPS) continue;
        const [dx, dz] = dirXZ(l.pos, sh.pos);
        const step = (TUNING.safe_radius - d) / SAFE_PUSH_TICKS;
        sh.safeTicks = SAFE_PUSH_TICKS;
        sh.safeStep = [dx * step, dz * step];
        if (sh.state === 'drain') toWander(sh);
        break;
      }
    }
    if (sh.safeTicks > 0) moveShade(s, sh, sh.safeStep[0], sh.safeStep[1]);
  }
}
