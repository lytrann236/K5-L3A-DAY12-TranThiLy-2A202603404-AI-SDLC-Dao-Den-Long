import {
  MOTE_MAX_COUNT,
  MOTE_SPAWN_INTERVAL_TICKS,
  PICKUP_MAX_DY,
} from './constants';
import { TUNING } from './contract';
import { distXZ } from './geom';
import { getMap } from './maps';
import type { GameState, SimEvent } from './types';

/** Một điểm sinh coi là "đang có" đom đóm `random` nếu có con nằm cách nó < 1 mm. */
const SAME_POINT_EPS = 1e-3;

// Bước 2: TTL đom đóm rơi; hết TTL thì biến mất.
export function tickMoteTtl(s: GameState): void {
  let expired = false;
  for (const m of s.motes) {
    if (m.ttl !== null && m.ttl > 0) {
      m.ttl--;
      if (m.ttl === 0) expired = true;
    }
  }
  if (expired) s.motes = s.motes.filter((m) => m.ttl === null || m.ttl > 0);
}

// Bước 4: nhặt tự động khi XZ ≤ pickup_radius và chênh cao ≤ 1.5 m. Nhặt không cộng điểm.
export function pickupMotes(s: GameState, events: SimEvent[]): void {
  const p = s.player;
  if (p.respawn > 0) return;
  const kept = [];
  for (const m of s.motes) {
    if (
      p.carried < TUNING.carry_capacity &&
      distXZ(m.pos, p.pos) <= TUNING.pickup_radius &&
      Math.abs(p.pos[1] - m.pos[1]) <= PICKUP_MAX_DY
    ) {
      p.carried++;
      events.push({ name: 'mote_picked', data: { carried: p.carried } });
    } else {
      kept.push(m);
    }
  }
  if (kept.length !== s.motes.length) s.motes = kept;
}

// Bước 10: tại sim_tick 240, 480, … sinh 1 con ở một điểm trống (chọn theo seed) nếu < 30.
export function spawnMotes(s: GameState): void {
  if (!s.randomMotes) return;
  if (s.simTick % MOTE_SPAWN_INTERVAL_TICKS !== 0) return;
  if (s.motes.length >= MOTE_MAX_COUNT) return;
  const free = getMap(s.night).moteSpawns.filter(
    (pt) => !s.motes.some((m) => m.kind === 'random' && distXZ(m.pos, pt) < SAME_POINT_EPS),
  );
  if (free.length === 0) return; // hết điểm trống thì bỏ lượt
  const pt = free[Math.floor(s.rng() * free.length)];
  s.motes.push({ id: `M${s.nextMoteId++}`, pos: [...pt], kind: 'random', ttl: null });
}
