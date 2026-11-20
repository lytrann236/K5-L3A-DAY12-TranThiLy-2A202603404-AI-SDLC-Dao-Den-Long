import { SAFE_PUSH_TICKS } from './constants';
import { TUNING } from './contract';
import { dirXZ, distXZ } from './geom';
import { moveShade } from './shades';
import type { GameState, Lantern, SimEvent } from './types';

/** Bóng cách tâm đèn < safe_radius − EPS coi là ở trong vùng (tránh rung ở đúng mép). */
const INSIDE_EPS = 1e-6;

/** Đèn chưa sáng gần nhất trong interact_radius (XZ); hòa thì id nhỏ hơn (thứ tự trong mảng). */
export function nearestUnlit(s: GameState): Lantern | null {
  let best: Lantern | null = null;
  let bestD = Infinity;
  for (const l of s.lanterns) {
    if (l.lit) continue;
    const d = distXZ(l.pos, s.player.pos);
    if (d <= TUNING.interact_radius && d < bestD) {
      best = l;
      bestD = d;
    }
  }
  return best;
}

// Bước 5: mỗi lần bấm interact nạp min(carried, còn thiếu); +per_mote mỗi đom đóm nạp,
// +per_lantern khi thắp. Trả về các đèn vừa thắp trong tick này.
export function interact(s: GameState, pressed: boolean, events: SimEvent[]): Lantern[] {
  const p = s.player;
  if (!pressed || p.respawn > 0) return [];
  const best = nearestUnlit(s);
  if (!best) return [];
  const amount = Math.min(p.carried, TUNING.lantern_cost - best.deposited);
  if (amount <= 0) return [];
  p.carried -= amount;
  best.deposited += amount;
  s.score += TUNING.score.per_mote * amount;
  events.push({ name: 'deposit', data: { lantern_id: best.id, amount, deposited: best.deposited } });
  if (best.deposited < TUNING.lantern_cost) return [];
  best.lit = true;
  s.score += TUNING.score.per_lantern;
  events.push({ name: 'lantern_lit', data: { lantern_id: best.id } });
  return [best];
}

// Bước 2 (phần vùng an toàn): đếm lùi thời gian đẩy ra.
export function tickSafeTimers(s: GameState): void {
  for (const sh of s.shades) if (sh.safeTicks > 0) sh.safeTicks--;
}

/**
 * Bước 6: vùng an toàn. Bóng đang ở trong vùng (r 6) của một đèn đã sáng — thường là lúc đèn vừa
 * thắp — bị đẩy tuyến tính ra mép trong đúng 30 tick (quãng 6 − d chia đều, trùng tâm → +X), tính cả
 * tick bắt đầu. Trong 30 tick đó bóng không tự di chuyển và không gây hit (giữ tên trạng thái).
 * Bóng ở ngoài bị chặn ở mép khi di chuyển (moveShade).
 */
export function updateSafeZones(s: GameState): void {
  for (const sh of s.shades) {
    if (sh.safeTicks === 0) {
      for (const l of s.lanterns) {
        if (!l.lit) continue;
        const d = distXZ(sh.pos, l.pos);
        if (d >= TUNING.safe_radius - INSIDE_EPS) continue;
        const [dx, dz] = dirXZ(l.pos, sh.pos);
        const step = (TUNING.safe_radius - d) / SAFE_PUSH_TICKS;
        sh.safeTicks = SAFE_PUSH_TICKS;
        sh.safeStep = [dx * step, dz * step];
        break;
      }
    }
    if (sh.safeTicks > 0) moveShade(s, sh, sh.safeStep[0], sh.safeStep[1]);
  }
}
