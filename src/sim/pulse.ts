import { ISLAND_RADIUS, TICK_RATE } from './constants';
import { TUNING } from './contract';
import { clampToDisk, dirXZ, distXZ } from './geom';
import type { GameState, SimEvent } from './types';

const PULSE_COOLDOWN_TICKS = Math.round(TUNING.pulse_cooldown_s * TICK_RATE);
const STUN_TICKS = Math.round(TUNING.pulse_stun_s * TICK_RATE);

// Bước 7 (tạm, logic Phase 1).
export function pulse(s: GameState, pressed: boolean, events: SimEvent[]): void {
  const p = s.player;
  if (!pressed || p.pulseCooldown > 0 || p.carried < TUNING.pulse_cost) return;
  p.carried -= TUNING.pulse_cost;
  p.pulseCooldown = PULSE_COOLDOWN_TICKS;
  const stunned: string[] = [];
  for (const sh of s.shades) {
    if (distXZ(sh.pos, p.pos) > TUNING.pulse_radius) continue;
    const [dx, dz] = dirXZ(p.pos, sh.pos);
    sh.pos[0] += dx * TUNING.pulse_push_m;
    sh.pos[2] += dz * TUNING.pulse_push_m;
    clampToDisk(sh.pos, ISLAND_RADIUS);
    sh.state = 'stunned';
    sh.stateTicks = STUN_TICKS;
    stunned.push(sh.id);
    s.score += TUNING.score.per_stun;
  }
  events.push({ name: 'pulse', data: { stunned_ids: stunned } });
}
