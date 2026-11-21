import {
  CHARM_RUN_SPEED,
  FALL_Y,
  GRAVITY,
  ISLAND_RADIUS,
  JUMP_SPEED,
  RESPAWN_WAIT_TICKS,
  TICK_RATE,
} from './constants';
import { TUNING } from './contract';
import { clampToDisk, distXZ } from './geom';
import { getMap } from './maps';
import type { GameState, InputState, SimEvent } from './types';

const DT = 1 / TICK_RATE;
/** Dung sai so sánh độ cao (cộng dồn số thực qua nhiều tick lệch ~1e-15). */
const EPS = 1e-9;
const ticksOf = (seconds: number) => Math.round(seconds * TICK_RATE);
export const INVULN_TICKS = ticksOf(TUNING.invuln_s);
export const DASH_TICKS = ticksOf(TUNING.dash_duration_s);
export const DASH_COOLDOWN_TICKS = ticksOf(TUNING.dash_cooldown_s);

// Bước 2 (phần người chơi): bất tử, hồi chiêu, bùa.
export function tickPlayerTimers(s: GameState): void {
  const p = s.player;
  if (p.invuln > 0) p.invuln--;
  if (p.pulseCooldown > 0) p.pulseCooldown--;
  if (p.dashCooldown > 0) p.dashCooldown--;
  if (p.charm > 0) p.charm--;
}

/** Hướng `move` sau khi xoay theo camera (Test Contract mục C), độ dài ≤ 1. */
export function worldMove(input: InputState): [number, number] {
  let [x, z] = input.move;
  const len = Math.hypot(x, z);
  if (len > 1) {
    x /= len;
    z /= len;
  }
  const th = (input.cam_yaw_deg * Math.PI) / 180;
  return [x * Math.cos(th) + z * Math.sin(th), -x * Math.sin(th) + z * Math.cos(th)];
}

/**
 * Bước 3: di chuyển Mây (chạy tức thời, nhảy, lướt) rồi kiểm tra rơi khỏi đảo.
 * - Chạy: vận tốc ngang đạt mục tiêu ngay trong tick (≤ 0.1 s), điều khiển trên không đầy đủ.
 * - Nhảy: chỉ khi chạm đất; quỹ đạo tích phân chính xác với g không đổi (đỉnh 1.225 m, 42 tick).
 * - Lướt: 12 tick × 14 m/s theo hướng move (đứng yên → hướng quay mặt); vy = 0, không trọng lực;
 *   bấm khi đang lướt bị bỏ qua; nhảy trong lúc lướt bị bỏ qua. Có Bùa Gió thì không hồi chiêu.
 * - Bục nhảy: đầu bước, chân Mây đứng trên bục (chạm đất, XZ ≤ 1 m, không đang lướt) → bắn lên với
 *   vận tốc phóng ngay tick này. Phần ngang giữ tới khi chạm đất, `move` không ghi đè; vẫn lướt được
 *   (lướt giữ độ cao, hết lướt thì bay tiếp với vận tốc phóng và vy lúc bắt đầu lướt).
 * - Rơi: Y < −10 → player_hit fall (đúng 1 lần, bỏ qua bất tử), chờ 60 tick rồi hồi sinh.
 */
export function movePlayer(
  s: GameState,
  input: InputState,
  jump: boolean,
  dash: boolean,
  events: SimEvent[],
): void {
  const map = getMap(s.night);
  const p = s.player;

  if (p.respawn > 0) {
    p.respawn--;
    if (p.respawn === 0) {
      p.pos = [...map.start];
      p.vel = [0, 0, 0];
      p.grounded = true;
      p.facing = [...map.startFacing];
      p.invuln = INVULN_TICKS;
    }
    return;
  }

  const [wx, wz] = worldMove(input);
  const wl = Math.hypot(wx, wz);
  if (wl > 0) p.facing = [wx / wl, wz / wl];

  // Bục nhảy: phóng ngay tick này (giống nhảy), ưu tiên hơn nút nhảy.
  let launchVy: number | null = null;
  if (p.grounded && p.dashTicks === 0) {
    for (const pad of map.pads) {
      if (Math.abs(p.pos[1] - pad.pos[1]) <= EPS && distXZ(p.pos, pad.pos) <= pad.radius) {
        p.launch = [pad.vel[0], pad.vel[2]];
        launchVy = pad.vel[1];
        p.grounded = false;
        break;
      }
    }
  }

  if (dash && p.dashTicks === 0 && (p.dashCooldown === 0 || p.charm > 0)) {
    p.dashTicks = DASH_TICKS;
    p.dashDir = [...p.facing];
    p.dashCooldown = p.charm > 0 ? 0 : DASH_COOLDOWN_TICKS;
    if (p.launch) p.heldVy = launchVy ?? p.vel[1];
    events.push({ name: 'dash', data: {} });
  }

  const y0 = p.pos[1];
  if (p.dashTicks > 0) {
    p.dashTicks--;
    p.vel = [p.dashDir[0] * TUNING.dash_speed, 0, p.dashDir[1] * TUNING.dash_speed];
  } else {
    const speed = p.charm > 0 ? CHARM_RUN_SPEED : TUNING.player_speed;
    let vy = p.grounded ? 0 : p.vel[1];
    if (launchVy !== null) vy = launchVy;
    else if (p.heldVy !== null) vy = p.heldVy;
    p.heldVy = null;
    if (jump && p.grounded) {
      vy = JUMP_SPEED;
      p.grounded = false;
    }
    if (!p.grounded) {
      p.pos[1] += vy * DT - 0.5 * GRAVITY * DT * DT;
      vy -= GRAVITY * DT;
    }
    p.vel = p.launch ? [p.launch[0], vy, p.launch[1]] : [wx * speed, vy, wz * speed];
  }
  p.pos[0] += p.vel[0] * DT;
  p.pos[2] += p.vel[2] * DT;
  if (!TUNING.fall_enabled) clampToDisk(p.pos, ISLAND_RADIUS);

  const g = map.groundAt(p.pos[0], p.pos[2]);
  if (p.grounded) {
    if (g === null) p.grounded = false; // bước ra khỏi mép: bắt đầu rơi từ tick sau
    else p.pos[1] = g;
  } else if (g !== null && p.pos[1] <= g + EPS && y0 >= g - EPS) {
    p.pos[1] = g;
    p.vel[1] = 0;
    p.grounded = true;
    p.launch = null;
    p.heldVy = null;
  }

  if (TUNING.fall_enabled && p.pos[1] < FALL_Y - EPS) {
    p.flames--;
    const lost = p.carried;
    p.carried = 0;
    p.vel = [0, 0, 0];
    p.dashTicks = 0;
    p.launch = null;
    p.heldVy = null;
    p.respawn = RESPAWN_WAIT_TICKS;
    events.push({ name: 'player_hit', data: { by: 'fall', flames: p.flames, dropped: 0, lost } });
  }
}
