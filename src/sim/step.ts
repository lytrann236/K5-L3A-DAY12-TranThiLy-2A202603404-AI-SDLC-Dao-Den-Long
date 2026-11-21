import { TICK_RATE } from './constants';
import { TUNING } from './contract';
import { pickupCharms, tickCharms } from './charms';
import { collideDrifters, moveDrifters, spawnDrifters } from './drifters';
import { interact, tickSafeTimers, updateSafeZones } from './lanterns';
import { pickupMotes, spawnMotes, tickMoteTtl } from './motes';
import { movePlayer, tickPlayerTimers } from './player';
import { pulse } from './pulse';
import { FUEL_UNIT, tickFuel } from './fuel';
import { collideShades, moveShades, spawnShades, tickShadeTimers } from './shades';
import { tickWind } from './wind';
import type { Buttons, EndReason, GameState, InputState, SimEvent } from './types';

/** Số tick gameplay còn lại, tính bằng số nguyên (không trừ số thực). */
const ticksLeft = (s: GameState) => s.durationTicks - s.simTick;

/**
 * Chạy MỘT bước (tick k → k+1) theo thứ tự 12 bước của ticket-02 / phase-2.md mục 4.3.
 * `input` là input đã áp frame của tick k. Trả về các sự kiện của bước này (bên gọi ghi tick = k+1).
 * Game đã kết thúc thì không làm gì.
 */
export function step(s: GameState, input: InputState): SimEvent[] {
  if (s.status !== 'playing') return [];
  const events: SimEvent[] = [];
  s.tick += 1;

  // 1. Đọc input: bắt sườn false→true (kể cả khi đang tạm dừng, để không bấm "ăn theo").
  const prev = s.prevButtons;
  const edge = (k: keyof Buttons) => input[k] && !prev[k];
  const edges: Buttons = {
    jump: edge('jump'),
    interact: edge('interact'),
    pulse: edge('pulse'),
    dash: edge('dash'),
    pause: edge('pause'),
  };
  s.prevButtons = {
    jump: input.jump,
    interact: input.interact,
    pulse: input.pulse,
    dash: input.dash,
    pause: input.pause,
  };
  if (edges.pause) {
    s.paused = !s.paused;
    events.push(s.paused ? { name: 'paused', data: {} } : { name: 'resumed', data: {} });
  }
  if (s.paused) return events;

  s.simTick += 1;
  s.timeLeft = Math.max(0, s.durationS - s.simTick / TICK_RATE);

  // 2. Giảm các bộ đếm.
  tickPlayerTimers(s);
  tickShadeTimers(s);
  tickSafeTimers(s);
  tickMoteTtl(s);
  tickCharms(s);
  tickWind(s);
  // 2b. Trừ dầu (hao + bị hút), rồi đèn fuel ≤ 0 tắt (ticket-03 mục 3).
  tickFuel(s, events);
  // 3. Di chuyển Mây (nhảy, lướt, bục nhảy, gió) rồi kiểm tra rơi khỏi đảo.
  movePlayer(s, input, edges.jump, edges.dash, events);
  // 4. Nhặt đom đóm và bùa.
  pickupMotes(s, events);
  pickupCharms(s, events);
  // 5. Tương tác với đèn.
  interact(s, edges.interact, events);
  // 6. Cập nhật vùng an toàn.
  updateSafeZones(s);
  // 7. Tỏa Sáng.
  pulse(s, edges.pulse, events);
  // 8. Bóng Mực và Gió Lạc di chuyển.
  moveShades(s);
  moveDrifters(s);
  // 9. Chạm: Gió Lạc cướp trước, rồi Bóng Mực gây hit.
  collideDrifters(s, events);
  collideShades(s, events);
  // 10. Sinh theo lịch.
  spawnMotes(s);
  spawnShades(s, events);
  spawnDrifters(s);
  // 11. Thắng / thua.
  checkEnd(s, events);
  return events;
}

function endGame(s: GameState, events: SimEvent[], result: 'won' | 'lost', reason: EndReason): void {
  s.status = result;
  events.push({ name: 'game_over', data: { result, reason } });
}

/** Số đèn sáng cần ở bình minh = ceil(win_ratio × tổng) (trừ EPS chống sai số 0.6 × n). */
export const lanternsNeeded = (total: number) => Math.ceil(TUNING.win_ratio * total - 1e-9);

// 11 (Phase 3). Sau mọi cập nhật của tick. Hết lửa → luôn thua no_flames (kể cả tick bình minh).
// Hết giờ → đèn sáng ≥ ceil(0.6 × tổng) thì thắng dawn_survived (+50 + floor(fuel) mỗi đèn sáng,
// +50 mỗi lửa), không thì thua dawn. Không còn thắng sớm.
function checkEnd(s: GameState, events: SimEvent[]): void {
  const p = s.player;
  if (p.flames <= 0) {
    endGame(s, events, 'lost', 'no_flames');
    return;
  }
  if (ticksLeft(s) > 0) return;
  const lit = s.lanterns.filter((l) => l.lit);
  if (lit.length >= lanternsNeeded(s.lanterns.length)) {
    for (const l of lit) s.score += TUNING.score.per_lit_at_dawn + Math.floor(l.fuelU / FUEL_UNIT);
    s.score += TUNING.score.per_flame_left * p.flames;
    endGame(s, events, 'won', 'dawn_survived');
  } else {
    endGame(s, events, 'lost', 'dawn');
  }
}
