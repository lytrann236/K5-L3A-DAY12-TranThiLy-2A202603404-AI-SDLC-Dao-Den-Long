// Gió Lạc (ticket-02 Phần 3; phase-2.md 4.1 / 4.2): idle → chase → flee → removed.
import {
  DRIFTER_CHASE_MIN_CARRIED,
  DRIFTER_CHASE_RADIUS,
  DRIFTER_DROP_VANISH_TICKS,
  DRIFTER_FLEE_TICKS,
  DRIFTER_IDLE_RADIUS,
  DRIFTER_IDLE_SPEED,
  DRIFTER_MAX,
  DRIFTER_SPAWN_INTERVAL_TICKS,
  DRIFTER_SPEED,
  DRIFTER_STEAL_MAX,
  DRIFTER_TOUCH_RADIUS,
  DRIFTER_Y,
  TICK_RATE,
} from './constants';
import { TUNING } from './contract';
import { dirXZ, dist3, distXZ } from './geom';
import { getMap } from './maps';
import { releaseMotes } from './motes';
import type { Drifter, DrifterState, GameState, SimEvent, Vec3 } from './types';

const DT = 1 / TICK_RATE;
const STEP = DRIFTER_SPEED * DT;
/** Tốc độ góc khi lượn: 2 m/s trên vòng r 4 m. */
const IDLE_OMEGA = (DRIFTER_IDLE_SPEED / DRIFTER_IDLE_RADIUS) * DT;

export function drifterNum(id: string): number {
  const m = /^D(\d+)$/.exec(id);
  return m ? Number(m[1]) : 0;
}
const byDrifterId = (a: Drifter, b: Drifter) =>
  drifterNum(a.id) - drifterNum(b.id) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

/** Gió Lạc bay ở Y = mặt đất + 1 (không có mặt đất thì coi mặt đất ở Y = 0). */
function setY(s: GameState, d: Drifter): void {
  d.pos[1] = (getMap(s.night).groundAt(d.pos[0], d.pos[2]) ?? 0) + DRIFTER_Y;
}

/**
 * Vào `idle` tại vị trí hiện tại: vòng lượn r 4 m đi qua vị trí này ở góc 0
 * (tâm = vị trí − (4, 0, 0)), bay ngược chiều kim đồng hồ.
 */
function enterIdleHere(d: Drifter): void {
  d.state = 'idle';
  d.center = [d.pos[0] - DRIFTER_IDLE_RADIUS, d.pos[2]];
  d.angle = 0;
}

export function newDrifter(
  s: GameState,
  id: string,
  pos: Vec3,
  state: DrifterState,
  stolen: number,
): Drifter {
  const d: Drifter = {
    id,
    pos: [pos[0], 0, pos[2]],
    state,
    stolen,
    center: [pos[0] - DRIFTER_IDLE_RADIUS, pos[2]],
    angle: 0,
    fleeTicks: state === 'flee' ? DRIFTER_FLEE_TICKS : 0,
  };
  setY(s, d);
  return d;
}

/** Điều kiện đuổi: Mây mang ≥ 5 đom đóm, cách ≤ 15 m (XZ) và không đang chờ hồi sinh. */
function wantsChase(s: GameState, d: Drifter): boolean {
  const p = s.player;
  return (
    p.respawn === 0 &&
    p.carried >= DRIFTER_CHASE_MIN_CARRIED &&
    distXZ(d.pos, p.pos) <= DRIFTER_CHASE_RADIUS
  );
}

function moveXZ(s: GameState, d: Drifter, dx: number, dz: number): void {
  d.pos[0] += dx;
  d.pos[2] += dz;
  setY(s, d);
}

// Bước 8 (phần Gió Lạc). Không bị vùng an toàn hay mép đảo chặn (bay).
export function moveDrifters(s: GameState): void {
  const p = s.player;
  for (const d of s.drifters) {
    switch (d.state) {
      case 'idle':
        if (wantsChase(s, d)) {
          d.state = 'chase';
          chase(s, d);
        } else {
          d.angle += IDLE_OMEGA;
          d.pos[0] = d.center[0] + DRIFTER_IDLE_RADIUS * Math.cos(d.angle);
          d.pos[2] = d.center[1] + DRIFTER_IDLE_RADIUS * Math.sin(d.angle);
          setY(s, d);
        }
        break;
      case 'chase':
        if (wantsChase(s, d)) chase(s, d);
        else enterIdleHere(d);
        break;
      case 'flee': {
        const [dx, dz] = dirXZ(p.pos, d.pos);
        moveXZ(s, d, dx * STEP, dz * STEP);
        d.fleeTicks--;
        if (d.fleeTicks <= 0) {
          d.fleeTicks = 0;
          d.state = 'removed'; // biến mất cùng số đã cướp
        }
        break;
      }
      case 'removed':
        break;
    }
  }
}

function chase(s: GameState, d: Drifter): void {
  const p = s.player;
  const step = Math.min(STEP, distXZ(d.pos, p.pos));
  if (step === 0) return;
  const [dx, dz] = dirXZ(d.pos, p.pos);
  moveXZ(s, d, dx * step, dz * step);
}

/**
 * Bước 9, phần Gió Lạc (chạy TRƯỚC Bóng Mực): con đang `chase` chạm Mây (XZ ≤ 1.2) cướp
 * min(3, carried) rồi `flee` 240 tick. Xét theo id tăng dần. Bất tử không ngăn bị cướp;
 * không làm mất Ngọn Lửa. Đang chờ hồi sinh hoặc túi rỗng thì không cướp.
 */
export function collideDrifters(s: GameState, events: SimEvent[]): void {
  const p = s.player;
  if (p.respawn > 0 || s.drifters.length === 0) return;
  for (const d of [...s.drifters].sort(byDrifterId)) {
    if (p.carried <= 0) return;
    if (d.state !== 'chase' || distXZ(d.pos, p.pos) > DRIFTER_TOUCH_RADIUS) continue;
    const amount = Math.min(DRIFTER_STEAL_MAX, p.carried);
    p.carried -= amount;
    d.stolen += amount;
    d.state = 'flee';
    d.fleeTicks = DRIFTER_FLEE_TICKS;
    events.push({ name: 'drifter_steal', data: { drifter_id: d.id, amount, carried: p.carried } });
  }
}

/**
 * Bước 7, phần Gió Lạc: Tỏa Sáng (3D ≤ pulse_radius từ tâm `center`) trúng con `chase` → `flee`
 * không cướp (240 tick); trúng con `flee` đang mang đồ → thả toàn bộ thành đom đóm `dropped` tại
 * chỗ (`drifter_drop`), biến mất sau 120 tick. Không cộng điểm, không vào `stunned_ids`.
 */
export function pulseDrifters(s: GameState, center: Vec3, events: SimEvent[]): void {
  for (const d of [...s.drifters].sort(byDrifterId)) {
    if (dist3(center, d.pos) > TUNING.pulse_radius) continue;
    if (d.state === 'chase') {
      d.state = 'flee';
      d.fleeTicks = DRIFTER_FLEE_TICKS;
    } else if (d.state === 'flee' && d.stolen > 0) {
      const amount = d.stolen;
      releaseMotes(s, d.pos[0], d.pos[2], amount);
      d.stolen = 0;
      d.fleeTicks = DRIFTER_DROP_VANISH_TICKS;
      events.push({ name: 'drifter_drop', data: { drifter_id: d.id, amount } });
    }
  }
}

/**
 * Bước 10, phần Gió Lạc (Đêm 2, 3): tại sim_tick 1200, 2400, … sinh 1 con trên một điểm sương
 * (= điểm sinh Bóng Mực) chọn theo seed, nếu đang có < 2 con chưa `removed`. Con mới ở `idle`,
 * lượn quanh điểm sương (vị trí đầu = điểm sương + (4, 0, 0)).
 */
export function spawnDrifters(s: GameState): void {
  const map = getMap(s.night);
  if (!s.randomDrifters || !map.drifters) return;
  if (s.simTick === 0 || s.simTick % DRIFTER_SPAWN_INTERVAL_TICKS !== 0) return;
  if (s.drifters.filter((d) => d.state !== 'removed').length >= DRIFTER_MAX) return;
  const pt = map.shadeSpawns[Math.floor(s.rng() * map.shadeSpawns.length)];
  const d = newDrifter(s, `D${s.nextDrifterId++}`, [pt[0] + DRIFTER_IDLE_RADIUS, 0, pt[2]], 'idle', 0);
  d.center = [pt[0], pt[2]];
  s.drifters.push(d);
}
