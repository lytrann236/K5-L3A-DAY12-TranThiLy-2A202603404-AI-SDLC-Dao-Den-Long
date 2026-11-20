import { TICK_RATE } from './constants';
import { TUNING } from './contract';
import { interact } from './lanterns';
import { pickupMotes, spawnMotes, tickMoteTtl } from './motes';
import { movePlayer, tickPlayerTimers } from './player';
import { pulse } from './pulse';
import { collideShades, moveShades, spawnShades, tickShadeTimers } from './shades';
import type { Buttons, GameState, InputState, SimEvent } from './types';

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
  tickMoteTtl(s);
  // 3. Di chuyển Mây (nhảy, lướt) rồi kiểm tra rơi khỏi đảo.
  movePlayer(s, input, edges.jump, edges.dash, events);
  // 4. Nhặt đom đóm.
  pickupMotes(s, events);
  // 5. Tương tác với đèn.
  interact(s, edges.interact, events);
  // 7. Tỏa Sáng.
  pulse(s, edges.pulse, events);
  // 8. Bóng Mực di chuyển.
  moveShades(s);
  // 9. Chạm.
  collideShades(s, events);
  // 10. Sinh theo lịch.
  spawnMotes(s);
  spawnShades(s, events);
  // 11. Thắng / thua.
  checkEnd(s, events);
  return events;
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

// 11. Hết lửa → luôn thua; còn sống và đủ đèn → thắng (kể cả đúng tick hết giờ); hết giờ → dawn.
function checkEnd(s: GameState, events: SimEvent[]): void {
  const p = s.player;
  if (p.flames <= 0) {
    endGame(s, events, 'lost', 'no_flames');
  } else if (s.lanterns.every((l) => l.lit)) {
    s.score +=
      TUNING.score.per_second_left * Math.max(0, Math.floor(ticksLeft(s) / TICK_RATE)) +
      TUNING.score.per_flame_left * p.flames;
    endGame(s, events, 'won', 'all_lit');
  } else if (ticksLeft(s) <= 0) {
    endGame(s, events, 'lost', 'dawn');
  }
}
