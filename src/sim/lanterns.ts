import { TUNING } from './contract';
import { distXZ } from './geom';
import type { GameState, Lantern, SimEvent } from './types';

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
