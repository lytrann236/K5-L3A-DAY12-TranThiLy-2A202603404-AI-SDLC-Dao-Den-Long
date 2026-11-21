import { PULSE_CENTER_DY, PULSE_PUSH_TICKS, TICK_RATE } from './constants';
import { TUNING } from './contract';
import { pulseDrifters } from './drifters';
import { toWander } from './fuel';
import { dirXZ, dist3 } from './geom';
import type { GameState, SimEvent, Vec3 } from './types';

export const PULSE_COOLDOWN_TICKS = Math.round(TUNING.pulse_cooldown_s * TICK_RATE);
export const STUN_TICKS = Math.round(TUNING.pulse_stun_s * TICK_RATE);

/**
 * Bước 7: Tỏa Sáng. Cần hồi chiêu = 0 và carried ≥ pulse_cost (thiếu thì không có sự kiện).
 * Tâm = chân Mây + 0.8 m; mục tiêu chốt ngay tick kích hoạt: Bóng Mực có khoảng cách 3D tới tâm
 * ≤ pulse_radius (kể cả đang spawning / recoil / stunned). Mỗi con: stunned 120 tick (làm mới),
 * đẩy lùi tổng pulse_push_m trong 15 tick theo phương ngang Mây → bóng (trùng vị trí → +X), +per_stun
 * (+per_stun_drain nếu bóng đang `drain`, Phase 3).
 * Sau sự kiện `pulse` mới xét Gió Lạc (có thể sinh `drifter_drop`).
 */
export function pulse(s: GameState, pressed: boolean, events: SimEvent[]): void {
  const p = s.player;
  if (!pressed || p.respawn > 0 || p.pulseCooldown > 0 || p.carried < TUNING.pulse_cost) return;
  p.carried -= TUNING.pulse_cost;
  p.pulseCooldown = PULSE_COOLDOWN_TICKS;
  const center: Vec3 = [p.pos[0], p.pos[1] + PULSE_CENTER_DY, p.pos[2]];
  const stunned: string[] = [];
  for (const sh of s.shades) {
    if (dist3(center, sh.pos) > TUNING.pulse_radius) continue;
    const wasDrain = sh.state === 'drain';
    toWander(sh);
    sh.state = 'stunned';
    sh.stateTicks = STUN_TICKS;
    sh.pushTicks = PULSE_PUSH_TICKS;
    sh.pushDir = dirXZ(p.pos, sh.pos);
    stunned.push(sh.id);
    s.score += wasDrain ? TUNING.score.per_stun_drain : TUNING.score.per_stun;
  }
  events.push({ name: 'pulse', data: { stunned_ids: stunned } });
  pulseDrifters(s, center, events);
}
