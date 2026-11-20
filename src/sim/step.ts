import {
  GRAVITY,
  ISLAND_RADIUS,
  JUMP_SPEED,
  SHADE_MAX_COUNT,
  SHADE_SPAWN_INTERVAL_S,
  SHADE_SPAWN_MIN_DIST,
  TICK_RATE,
} from './constants';
import { TUNING } from './contract';
import { clampToDisk, dirXZ, distXZ } from './geom';
import type { GameState, InputState, SimEvent } from './types';
import { spawnRandomMote, spawnRandomShade } from './world';

const DT = 1 / TICK_RATE;
const ticksOf = (seconds: number) => Math.round(seconds * TICK_RATE);

const INVULN_TICKS = ticksOf(TUNING.invuln_s);
const PULSE_COOLDOWN_TICKS = ticksOf(TUNING.pulse_cooldown_s);
const STUN_TICKS = ticksOf(TUNING.pulse_stun_s);
const SHADE_SPAWN_INTERVAL_TICKS = ticksOf(SHADE_SPAWN_INTERVAL_S);
/** Số lần lặp tối đa khi đẩy Bóng Mực ra khỏi các vùng đèn chồng nhau. */
const SAFE_PUSH_PASSES = 4;

interface Edges {
  jump: boolean;
  interact: boolean;
  pulse: boolean;
}

/**
 * Chạy MỘT bước (tick k → k+1) theo "Thứ tự xử lý một bước" của phase-1.md.
 * `input` là input đã áp frame của tick k (bước 1 do bên gọi thực hiện).
 * Trả về các sự kiện của bước này (bên gọi ghi tick = k+1).
 * Game đã kết thúc thì không làm gì.
 */
export function step(s: GameState, input: InputState): SimEvent[] {
  if (s.status !== 'playing') return [];
  const events: SimEvent[] = [];

  // Sườn false→true của các nút.
  const edges: Edges = {
    jump: input.jump && !s.prevButtons.jump,
    interact: input.interact && !s.prevButtons.interact,
    pulse: input.pulse && !s.prevButtons.pulse,
  };
  s.prevButtons = { jump: input.jump, interact: input.interact, pulse: input.pulse };

  // Bước đang chạy luôn được tính vào time_left_s, kể cả khi game kết thúc giữa bước.
  s.tick += 1;
  s.timeLeft = s.durationS - s.tick / TICK_RATE;

  runPhases(s, input, edges, events);

  // 10. Kiểm tra thua dawn.
  if (s.status === 'playing' && s.timeLeft <= 0) {
    endGame(s, events, 'lost', 'dawn');
  }
  return events;
}

function runPhases(s: GameState, input: InputState, edges: Edges, events: SimEvent[]): void {
  tickTimers(s); // 2
  movePlayer(s, input, edges); // 3
  pickupMotes(s, events); // 4
  interact(s, edges, events); // 5
  if (s.status !== 'playing') return;
  pulse(s, edges, events); // 6
  moveShades(s); // 7
  collide(s, events); // 8
  if (s.status !== 'playing') return;
  spawnShades(s, events); // 9
}

function endGame(
  s: GameState,
  events: SimEvent[],
  result: 'won' | 'lost',
  reason: 'all_lit' | 'dawn' | 'no_flames',
): void {
  s.status = result;
  events.push({ name: 'game_over', data: { result, reason } });
}

// 2. Giảm các bộ đếm.
function tickTimers(s: GameState): void {
  const p = s.player;
  if (p.invuln > 0) p.invuln--;
  if (p.pulseCooldown > 0) p.pulseCooldown--;
  for (const sh of s.shades) {
    if (sh.state === 'stunned') {
      sh.stun--;
      if (sh.stun <= 0) {
        sh.stun = 0;
        sh.state = 'chase';
      }
    }
  }
}

// 3. Di chuyển người chơi, nhảy, kẹp mép đảo.
function movePlayer(s: GameState, input: InputState, edges: Edges): void {
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

  if (edges.jump && p.grounded) {
    p.vy = JUMP_SPEED;
    p.grounded = false;
  }
  if (!p.grounded) {
    p.vy -= GRAVITY * DT;
    p.pos[1] += p.vy * DT;
    if (p.pos[1] <= 0) {
      p.pos[1] = 0;
      p.vy = 0;
      p.grounded = true;
    }
  }

  // fall_enabled = false: chặn ở mép đảo, không rơi.
  clampToDisk(p.pos, ISLAND_RADIUS);
}

// 4. Nhặt đom đóm tự động.
function pickupMotes(s: GameState, events: SimEvent[]): void {
  const p = s.player;
  const remaining = [];
  let spawned = 0;
  for (const m of s.motes) {
    if (p.carried < TUNING.carry_capacity && distXZ(m.pos, p.pos) <= TUNING.pickup_radius) {
      p.carried++;
      s.score += TUNING.score.per_mote;
      events.push({ name: 'mote_picked', data: { carried: p.carried } });
      if (s.randomMotes) spawned++;
    } else {
      remaining.push(m);
    }
  }
  s.motes = remaining;
  for (let i = 0; i < spawned; i++) s.motes.push(spawnRandomMote(s));
}

// 5. Interact → nạp đèn → kiểm tra thắng.
function interact(s: GameState, edges: Edges, events: SimEvent[]): void {
  const p = s.player;
  if (edges.interact) {
    let best = null;
    let bestD = Infinity;
    for (const l of s.lanterns) {
      if (l.lit) continue;
      const d = distXZ(l.pos, p.pos);
      if (d <= TUNING.interact_radius && d < bestD) {
        best = l;
        bestD = d;
      }
    }
    if (best) {
      const amount = Math.min(p.carried, TUNING.lantern_cost - best.deposited);
      if (amount > 0) {
        p.carried -= amount;
        best.deposited += amount;
        events.push({
          name: 'deposit',
          data: { lantern_id: best.id, amount, deposited: best.deposited },
        });
        if (best.deposited === TUNING.lantern_cost) {
          best.lit = true;
          s.score += TUNING.score.per_lantern;
          events.push({ name: 'lantern_lit', data: { lantern_id: best.id } });
        }
      }
    }
  }

  if (s.lanterns.every((l) => l.lit)) {
    s.score +=
      TUNING.score.per_second_left * Math.floor(s.timeLeft) +
      TUNING.score.per_flame_left * p.flames;
    endGame(s, events, 'won', 'all_lit');
  }
}

// 6. Pulse.
function pulse(s: GameState, edges: Edges, events: SimEvent[]): void {
  const p = s.player;
  if (!edges.pulse || p.pulseCooldown > 0 || p.carried < TUNING.pulse_cost) return;
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
    sh.stun = STUN_TICKS;
    stunned.push(sh.id);
    s.score += TUNING.score.per_stun;
  }
  events.push({ name: 'pulse', data: { stunned_ids: stunned } });
}

// 7. Bóng Mực di chuyển, rồi bị đẩy ra khỏi vùng an toàn của đèn đã thắp.
function moveShades(s: GameState): void {
  const p = s.player;
  const d = TUNING.shade_speed * DT;
  for (const sh of s.shades) {
    if (sh.state === 'chase') {
      const dist = distXZ(sh.pos, p.pos);
      if (dist <= d) {
        sh.pos[0] = p.pos[0];
        sh.pos[2] = p.pos[2];
      } else {
        const [dx, dz] = dirXZ(sh.pos, p.pos);
        sh.pos[0] += dx * d;
        sh.pos[2] += dz * d;
      }
    }
    // Áp cho mọi Bóng Mực, kể cả đang choáng (đã chốt với người dùng).
    const lit = s.lanterns.filter((l) => l.lit);
    for (let pass = 0; pass < SAFE_PUSH_PASSES; pass++) {
      let moved = false;
      for (const l of lit) {
        if (distXZ(sh.pos, l.pos) < TUNING.safe_radius) {
          const [dx, dz] = dirXZ(l.pos, sh.pos);
          sh.pos[0] = l.pos[0] + dx * TUNING.safe_radius;
          sh.pos[2] = l.pos[2] + dz * TUNING.safe_radius;
          moved = true;
        }
      }
      if (!moved) break;
    }
  }
}

// 8. Va chạm → kiểm tra thua no_flames. Mỗi tick tối đa 1 lần trúng.
function collide(s: GameState, events: SimEvent[]): void {
  const p = s.player;
  if (p.invuln > 0) return;
  const hitter = s.shades.find(
    (sh) => sh.state === 'chase' && distXZ(sh.pos, p.pos) <= TUNING.shade_hit_radius,
  );
  if (!hitter) return;
  p.flames--;
  const dropped = Math.floor(p.carried * TUNING.hit_drop_ratio);
  p.carried -= dropped;
  p.invuln = INVULN_TICKS;
  events.push({ name: 'player_hit', data: { by: 'shade', flames: p.flames, dropped } });
  if (p.flames <= 0) endGame(s, events, 'lost', 'no_flames');
}

// 9. Sinh Bóng Mực mới mỗi 45 s (tối đa 6).
function spawnShades(s: GameState, events: SimEvent[]): void {
  if (!s.randomShades) return;
  if (s.tick % SHADE_SPAWN_INTERVAL_TICKS !== 0) return;
  if (s.shades.length >= SHADE_MAX_COUNT) return;
  const sh = spawnRandomShade(s, SHADE_SPAWN_MIN_DIST);
  s.shades.push(sh);
  events.push({ name: 'shade_spawned', data: { id: sh.id } });
}
