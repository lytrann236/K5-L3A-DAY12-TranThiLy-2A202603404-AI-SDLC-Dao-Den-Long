import {
  DRAIN_CHASE_RADIUS,
  DRAIN_RADIUS,
  PULSE_PUSH_TICKS,
  SHADE_DETECT_RADIUS,
  SHADE_HIT_MAX_DY,
  SHADE_LOSE_RADIUS,
  SHADE_RECOIL_M,
  SHADE_RECOIL_TICKS,
  SHADE_SPAWNING_TICKS,
  SHADE_SPAWN_MIN_DIST,
  SHADE_Y,
  TICK_RATE,
} from './constants';
import { TUNING } from './contract';
import { hasSafeZone, isWeak, toWander, withinDrain } from './fuel';
import { dirXZ, distXZ, enterCircleT } from './geom';
import { getMap } from './maps';
import { dropMotes } from './motes';
import { INVULN_TICKS } from './player';
import type { GameState, Lantern, Shade, SimEvent } from './types';
import { newShade, shadeNum } from './world';

const DT = 1 / TICK_RATE;
const PUSH_STEP = TUNING.pulse_push_m / PULSE_PUSH_TICKS;
const RECOIL_STEP = SHADE_RECOIL_M / SHADE_RECOIL_TICKS;
/** Điểm sinh coi là đang có bóng nếu có bóng cách < 1 m (tránh 2 con sinh chồng lên nhau). */
const SPAWN_OCCUPIED_RADIUS = 1;

/** Thứ tự id tăng dần: S1 < S2 < … < S10 (theo số), id không dạng S<n> xếp theo chuỗi. */
export const byShadeId = (a: Shade, b: Shade) =>
  shadeNum(a.id) - shadeNum(b.id) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

// Bước 2 (phần Bóng Mực): spawning / stunned đếm lùi; hết thì về wander (bước 8 xét phát hiện ngay).
export function tickShadeTimers(s: GameState): void {
  for (const sh of s.shades) {
    if ((sh.state === 'spawning' || sh.state === 'stunned') && sh.stateTicks > 0) {
      sh.stateTicks--;
      if (sh.stateTicks === 0) {
        toWander(sh);
        sh.pushTicks = 0;
      }
    }
  }
}

/**
 * Dời bóng (dx, dz) theo XZ, dừng ở vật cản đầu tiên: mép phạm vi đảo của Đêm và mép vùng an toàn
 * của đèn đã sáng (chỉ chặn khi đi từ ngoài vào). Tháp chuông (Đêm 3) đẩy bóng ra mép (trượt quanh).
 * Vách tầng không chặn: bóng bay qua, Y theo mặt đất bên dưới. Trả về true nếu bị chặn.
 */
export function moveShade(s: GameState, sh: Shade, dx: number, dz: number): boolean {
  let t = 1;
  const map = getMap(s.night);
  const te = map.shadeExitT(sh.pos, dx, dz);
  if (te !== null) t = Math.min(t, te);
  for (const l of s.lanterns) {
    if (!hasSafeZone(l)) continue;
    const ti = enterCircleT(sh.pos, dx, dz, l.pos, TUNING.safe_radius);
    if (ti !== null) t = Math.min(t, ti);
  }
  const fromX = sh.pos[0];
  const fromZ = sh.pos[2];
  sh.pos[0] += dx * t;
  sh.pos[2] += dz * t;
  // Tháp chuông (Đêm 3): bóng bị đẩy ra mép tháp theo bán kính, tức trượt quanh tháp.
  const pushed = map.solidPush?.(sh.pos[0], sh.pos[2], fromX, fromZ) ?? null;
  if (pushed) [sh.pos[0], sh.pos[2]] = pushed;
  setShadeY(s, sh);
  return t < 1 || pushed !== null;
}

/** Bóng Mực bay ở Y = mặt đất bên dưới + 1 (bay qua vách tầng); không có mặt đất thì coi là 0. */
export function setShadeY(s: GameState, sh: Shade): void {
  sh.pos[1] = (getMap(s.night).groundAt(sh.pos[0], sh.pos[2]) ?? 0) + SHADE_Y;
}

// Bước 8: Bóng Mực di chuyển theo trạng thái.
export function moveShades(s: GameState): void {
  const p = s.player;
  const speed = getMap(s.night).shadeSpeed * DT;
  for (const sh of s.shades) {
    if (sh.safeTicks > 0) continue; // đang bị đẩy ra khỏi vùng an toàn (bước 6)
    switch (sh.state) {
      case 'spawning':
        break;
      case 'stunned':
        if (sh.pushTicks > 0) {
          const blocked = moveShade(s, sh, sh.pushDir[0] * PUSH_STEP, sh.pushDir[1] * PUSH_STEP);
          sh.pushTicks = blocked ? 0 : sh.pushTicks - 1;
        }
        break;
      case 'recoil':
        moveShade(s, sh, sh.recoilDir[0] * RECOIL_STEP, sh.recoilDir[1] * RECOIL_STEP);
        sh.stateTicks--;
        if (sh.stateTicks <= 0) {
          sh.stateTicks = 0;
          sh.state = 'wander';
        }
        break;
      case 'wander':
        if (distXZ(sh.pos, p.pos) <= SHADE_DETECT_RADIUS) {
          sh.state = 'chase';
          chase(s, sh, speed);
        } else {
          wander(s, sh, speed);
        }
        break;
      case 'drain': {
        const l = s.lanterns.find((x) => x.id === sh.targetLanternId);
        if (distXZ(sh.pos, p.pos) <= DRAIN_CHASE_RADIUS) {
          toWander(sh);
          sh.state = 'chase';
          chase(s, sh, speed);
        } else if (!l || !isWeak(l) || !withinDrain(sh, l)) {
          toWander(sh);
        }
        break;
      }
      case 'chase':
        if (distXZ(sh.pos, p.pos) > SHADE_LOSE_RADIUS) sh.state = 'wander';
        else chase(s, sh, speed);
        break;
    }
  }
}

/** Gần nhất theo XZ; hòa thì đứng trước trong mảng (id nhỏ hơn). */
function nearest(sh: Shade, ls: Lantern[]): Lantern | null {
  let best: Lantern | null = null;
  let bestD = Infinity;
  for (const l of ls) {
    const d = distXZ(sh.pos, l.pos);
    if (d < bestD) {
      best = l;
      bestD = d;
    }
  }
  return best;
}

/** Mục tiêu của `wander`: đèn sáng fuel < 30 gần nhất; không có thì đèn tắt gần nhất (ticket-03 mục 2). */
export function wanderTarget(s: GameState, sh: Shade): Lantern | null {
  return nearest(sh, s.lanterns.filter(isWeak)) ?? nearest(sh, s.lanterns.filter((l) => !l.lit));
}

/**
 * `wander` (Phase 3, đổi so với Phase 2 đứng yên): đi về mục tiêu, dừng cách 2 m. Tới đèn yếu
 * (≤ 2 m) thì chuyển `drain`; bắt đầu hút ở bước 2 của tick sau.
 */
function wander(s: GameState, sh: Shade, speed: number): void {
  const l = wanderTarget(s, sh);
  if (!l) return;
  const d = Math.min(speed, distXZ(sh.pos, l.pos) - DRAIN_RADIUS);
  if (d > 0) {
    const [dx, dz] = dirXZ(sh.pos, l.pos);
    moveShade(s, sh, dx * d, dz * d);
  }
  if (isWeak(l) && withinDrain(sh, l)) {
    sh.state = 'drain';
    sh.targetLanternId = l.id;
    sh.drainTicks = 0;
  }
}

function chase(s: GameState, sh: Shade, speed: number): void {
  const p = s.player;
  const d = Math.min(speed, distXZ(sh.pos, p.pos));
  if (d === 0) return;
  const [dx, dz] = dirXZ(sh.pos, p.pos);
  moveShade(s, sh, dx * d, dz * d);
}

/** Bóng có thể gây hit: wander/chase và không đang bị đẩy khỏi vùng an toàn. */
const canHit = (sh: Shade) => (sh.state === 'chase' || sh.state === 'wander') && sh.safeTicks === 0;

// Bước 9 (phần Bóng Mực): xét theo id tăng dần, tối đa 1 hit mỗi tick.
export function collideShades(s: GameState, events: SimEvent[]): void {
  const p = s.player;
  if (p.respawn > 0 || p.invuln > 0 || p.flames <= 0) return;
  const hitter = [...s.shades]
    .sort(byShadeId)
    .find(
      (sh) =>
        canHit(sh) &&
        distXZ(sh.pos, p.pos) <= TUNING.shade_hit_radius &&
        Math.abs(p.pos[1] - (sh.pos[1] - SHADE_Y)) <= SHADE_HIT_MAX_DY,
    );
  if (!hitter) return;
  p.flames--;
  const dropped = Math.floor(p.carried * TUNING.hit_drop_ratio);
  p.carried -= dropped;
  dropMotes(s, dropped);
  p.invuln = INVULN_TICKS;
  hitter.state = 'recoil';
  hitter.stateTicks = SHADE_RECOIL_TICKS;
  hitter.recoilDir = dirXZ(p.pos, hitter.pos);
  hitter.pushTicks = 0;
  events.push({ name: 'player_hit', data: { by: 'shade', flames: p.flames, dropped } });
}

// Bước 10 (phần Bóng Mực): 2 con ở shadeFirstTick, sau đó 1 con mỗi shadeIntervalTicks;
// điểm hợp lệ cách Mây ≥ 15 m (và chưa có bóng đứng đó), chọn theo seed; tối đa shadeMax con.
export function spawnShades(s: GameState, events: SimEvent[]): void {
  if (!s.randomShades) return;
  const map = getMap(s.night);
  const t = s.simTick;
  let n = 0;
  if (t === map.shadeFirstTick) n = 2;
  else if (t > map.shadeFirstTick && (t - map.shadeFirstTick) % map.shadeIntervalTicks === 0) n = 1;
  for (let i = 0; i < n; i++) {
    if (s.shades.length >= map.shadeMax) return;
    const valid = map.shadeSpawns.filter(
      (pt) =>
        distXZ(pt, s.player.pos) >= SHADE_SPAWN_MIN_DIST &&
        !s.shades.some((sh) => distXZ(sh.pos, pt) < SPAWN_OCCUPIED_RADIUS),
    );
    if (valid.length === 0) return; // hết điểm hợp lệ thì bỏ lượt
    const pt = valid[Math.floor(s.rng() * valid.length)];
    const sh = newShade(`S${s.nextShadeId++}`, pt[0], pt[2], 'spawning', SHADE_SPAWNING_TICKS);
    s.shades.push(sh);
    events.push({ name: 'shade_spawned', data: { id: sh.id } });
  }
}
