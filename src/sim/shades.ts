import { ISLAND_RADIUS, TICK_RATE } from './constants';
import { TUNING } from './contract';
import { clampToDisk, dirXZ, distXZ } from './geom';
import type { GameState, SimEvent } from './types';

const DT = 1 / TICK_RATE;
const INVULN_TICKS = Math.round(TUNING.invuln_s * TICK_RATE);

// Bước 2 (phần Bóng Mực).
export function tickShadeTimers(s: GameState): void {
  for (const sh of s.shades) {
    if (sh.stateTicks > 0) {
      sh.stateTicks--;
      if (sh.stateTicks === 0) sh.state = 'chase';
    }
  }
}

// Bước 8 (tạm, logic Phase 1).
export function moveShades(s: GameState): void {
  const p = s.player;
  const d = TUNING.shade_speed * DT;
  for (const sh of s.shades) {
    if (sh.state === 'wander') sh.state = 'chase';
    if (sh.state !== 'chase') continue;
    const dist = distXZ(sh.pos, p.pos);
    if (dist <= d) {
      sh.pos[0] = p.pos[0];
      sh.pos[2] = p.pos[2];
    } else {
      const [dx, dz] = dirXZ(sh.pos, p.pos);
      sh.pos[0] += dx * d;
      sh.pos[2] += dz * d;
    }
    clampToDisk(sh.pos, ISLAND_RADIUS);
  }
}

// Bước 9 (tạm, logic Phase 1).
export function collideShades(s: GameState, events: SimEvent[]): void {
  const p = s.player;
  if (p.invuln > 0 || p.flames <= 0) return;
  const hitter = s.shades.find((sh) => sh.state === 'chase' && distXZ(sh.pos, p.pos) <= TUNING.shade_hit_radius);
  if (!hitter) return;
  p.flames--;
  const dropped = Math.floor(p.carried * TUNING.hit_drop_ratio);
  p.carried -= dropped;
  p.invuln = INVULN_TICKS;
  events.push({ name: 'player_hit', data: { by: 'shade', flames: p.flames, dropped } });
}

// Bước 10 (tạm): chưa có lịch sinh.
export function spawnShades(_s: GameState, _events: SimEvent[]): void {}
