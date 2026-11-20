import { describe, expect, it } from 'vitest';
import {
  MSG_DEPOSIT_NEED_LANTERN,
  MSG_DEPOSIT_NEED_MOTES,
  MSG_PULSE_COOLDOWN,
  MSG_PULSE_NEED_MOTES,
  failureMessage,
} from '../src/render/feedback';
import { step } from '../src/sim/step';
import { DEFAULT_INPUT } from '../src/sim/types';
import type { GameState, InputState, Scenario } from '../src/sim/types';
import { createGame } from '../src/sim/world';

// Sửa theo phase-2.md mục 2: Mây đứng ở (0,0,24) cạnh L1 chuẩn (0,0,25) thay cho (0,0,20).
const quiet = (sc: Scenario = {}): Scenario => ({
  random_motes: false,
  random_shades: false,
  motes: [],
  shades: [],
  ...sc,
});

/** Chạy một tick với các nút cho trước, trả về thông báo (đúng như main.ts làm). */
function tick(s: GameState, btn: Partial<InputState>): string | null {
  const prev = { interact: s.prevButtons.interact, pulse: s.prevButtons.pulse };
  const input: InputState = { ...DEFAULT_INPUT, move: [0, 0], ...btn };
  const events = step(s, input);
  return failureMessage(prev, input, events, s);
}

// Sửa theo phase-2.md mục 2: pulse_cost 3 ("Cần ≥ 3"), hồi chiêu 3 s = 180 tick.
describe('Thông báo khi bấm không đủ điều kiện', () => {
  it('tỏa sáng khi carried < 3 → "Cần ≥ 3 đom đóm để tỏa sáng"', () => {
    const s = createGame(1, quiet({ player: { carried: 2 } }));
    expect(tick(s, { pulse: true })).toBe('Cần ≥ 3 đom đóm để tỏa sáng');
    expect(MSG_PULSE_NEED_MOTES).toBe('Cần ≥ 3 đom đóm để tỏa sáng');
    expect(s.player.carried).toBe(2); // sim không đổi
  });

  it('tỏa sáng khi đang cooldown → "Đang hồi chiêu"; hết cooldown (180 tick) thì bấm được', () => {
    const s = createGame(1, quiet({ player: { carried: 6 } }));
    expect(tick(s, { pulse: true })).toBeNull(); // thành công
    expect(tick(s, { pulse: false })).toBeNull();
    expect(tick(s, { pulse: true })).toBe(MSG_PULSE_COOLDOWN);
    expect(s.player.carried).toBe(3);
    for (let i = 0; i < 180; i++) tick(s, { pulse: false });
    expect(tick(s, { pulse: true })).toBeNull();
    expect(s.player.carried).toBe(0);
  });

  it('cooldown được báo trước khi thiếu đom đóm (cùng thứ tự với sim)', () => {
    const s = createGame(1, quiet({ player: { carried: 3 } }));
    expect(tick(s, { pulse: true })).toBeNull(); // carried 3 → 0, bắt đầu cooldown
    expect(tick(s, { pulse: false })).toBeNull();
    expect(tick(s, { pulse: true })).toBe(MSG_PULSE_COOLDOWN);
  });

  it('nạp đèn khi không mang đom đóm → "Cần mang đom đóm để nạp đèn"', () => {
    const s = createGame(1, quiet({ player: { pos: [0, 0, 24], carried: 0 } }));
    expect(tick(s, { interact: true })).toBe(MSG_DEPOSIT_NEED_MOTES);
    expect(MSG_DEPOSIT_NEED_MOTES).toBe('Cần mang đom đóm để nạp đèn');
  });

  it('nạp đèn khi đứng xa đèn → "Đứng gần đèn chưa thắp để nạp"', () => {
    const s = createGame(1, quiet({ player: { pos: [0, 0, 0], carried: 5 } }));
    expect(tick(s, { interact: true })).toBe(MSG_DEPOSIT_NEED_LANTERN);
    expect(MSG_DEPOSIT_NEED_LANTERN).toBe('Đứng gần đèn chưa thắp để nạp');
  });

  it('đứng cạnh đèn ĐÃ thắp cũng bị coi là không có đèn chưa thắp để nạp', () => {
    const s = createGame(
      1,
      quiet({ player: { pos: [0, 0, 24], carried: 5 }, lanterns: [{ id: 'L1', lit: true }] }),
    );
    expect(tick(s, { interact: true })).toBe(MSG_DEPOSIT_NEED_LANTERN);
  });

  it('bấm hợp lệ thì không có thông báo (nạp đèn, tỏa sáng)', () => {
    const s = createGame(1, quiet({ player: { pos: [0, 0, 24], carried: 12 } }));
    expect(tick(s, { interact: true })).toBeNull(); // deposit 10 + lantern_lit
    const s2 = createGame(1, quiet({ player: { carried: 3 } }));
    expect(tick(s2, { pulse: true })).toBeNull();
  });

  it('giữ nút (không có sườn lên) thì không báo lại mỗi tick', () => {
    const s = createGame(1, quiet({ player: { carried: 0 } }));
    expect(tick(s, { pulse: true })).toBe(MSG_PULSE_NEED_MOTES);
    expect(tick(s, { pulse: true })).toBeNull();
    expect(tick(s, { pulse: true })).toBeNull();
    expect(tick(s, { pulse: false })).toBeNull();
    expect(tick(s, { pulse: true })).toBe(MSG_PULSE_NEED_MOTES); // nhấn lại thì báo lại
  });

  it('không báo khi game đã kết thúc', () => {
    const s = createGame(1, quiet({ time_left_s: 0 }));
    expect(tick(s, { pulse: true })).toBeNull();
    expect(s.status).toBe('lost');
  });
});
