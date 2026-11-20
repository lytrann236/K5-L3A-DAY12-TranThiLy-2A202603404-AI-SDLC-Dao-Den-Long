import { GRAVITY, ISLAND_RADIUS, JUMP_SPEED, TICK_RATE } from './constants';
import { TUNING } from './contract';
import { clampToDisk } from './geom';
import type { GameState, InputState, SimEvent } from './types';

const DT = 1 / TICK_RATE;

// Bước 2 (phần người chơi).
export function tickPlayerTimers(s: GameState): void {
  const p = s.player;
  if (p.invuln > 0) p.invuln--;
  if (p.pulseCooldown > 0) p.pulseCooldown--;
}

// Bước 3 (tạm, logic Phase 1): di chuyển, nhảy, kẹp mép đảo.
export function movePlayer(s: GameState, input: InputState, jump: boolean, _dash: boolean, _events: SimEvent[]): void {
  const p = s.player;
  let [x, z] = input.move;
  const len = Math.hypot(x, z);
  if (len > 1) {
    x /= len;
    z /= len;
  }
  const th = (input.cam_yaw_deg * Math.PI) / 180;
  const wx = x * Math.cos(th) + z * Math.sin(th);
  const wz = -x * Math.sin(th) + z * Math.cos(th);
  const d = TUNING.player_speed * DT;
  p.pos[0] += wx * d;
  p.pos[2] += wz * d;
  if (jump && p.grounded) {
    p.vel[1] = JUMP_SPEED;
    p.grounded = false;
  }
  if (!p.grounded) {
    p.vel[1] -= GRAVITY * DT;
    p.pos[1] += p.vel[1] * DT;
    if (p.pos[1] <= 0) {
      p.pos[1] = 0;
      p.vel[1] = 0;
      p.grounded = true;
    }
  }
  clampToDisk(p.pos, ISLAND_RADIUS);
}
