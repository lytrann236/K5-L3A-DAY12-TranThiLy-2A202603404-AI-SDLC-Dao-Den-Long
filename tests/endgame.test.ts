import { describe, expect, it } from 'vitest';
import { FormatError, parseScenario } from '../src/headless/parse';
import { quiet, run } from './helpers';

describe('Thời gian và kết thúc', () => {
  it('time_left_s = thời lượng − bước/60, làm tròn 3 chữ số', () => {
    const r = run({ scenario: quiet(), ticks: 10 });
    expect(r.snap(0).time_left_s).toBe(300);
    expect(r.snap(1).time_left_s).toBe(299.983);
    expect(r.snap(10).time_left_s).toBe(299.833);
  });

  it('AC12: hết giờ → game_over lost dawn', () => {
    const r = run({ scenario: quiet({ time_left_s: 0.5 }), ticks: 100 });
    expect(r.snap(10).time_left_s).toBe(0.333);
    expect(r.events).toEqual([
      { type: 'event', tick: 30, name: 'game_over', data: { result: 'lost', reason: 'dawn' } },
    ]);
    expect(r.end).toEqual({ type: 'end', ticks: 30, state: 'lost', score: 0 });
    expect(r.snap(30)).toMatchObject({ state: 'lost', time_left_s: 0 });
  });

  it('game dừng ngay sau bước kết thúc: không có snapshot sau đó', () => {
    const r = run({ scenario: quiet({ time_left_s: 0.5 }), ticks: 100 });
    const ticks = r.lines.filter((l) => l.type === 'snapshot').map((l) => l.tick);
    expect(Math.max(...ticks)).toBe(30);
  });

  it('time_left_s = 0 hợp lệ → thua dawn ngay ở tick 1', () => {
    const r = run({ scenario: quiet({ time_left_s: 0 }), ticks: 100 });
    expect(r.events).toEqual([
      { type: 'event', tick: 1, name: 'game_over', data: { result: 'lost', reason: 'dawn' } },
    ]);
    expect(r.end).toEqual({ type: 'end', ticks: 1, state: 'lost', score: 0 });
  });

  it('parseScenario: time_left_s = 0 hợp lệ, số âm bị từ chối', () => {
    expect(parseScenario('{"time_left_s":0}').time_left_s).toBe(0);
    expect(() => parseScenario('{"time_left_s":-1}')).toThrow(FormatError);
  });
});

describe('Thời gian tính theo tick nguyên và thưởng thắng', () => {
  const winSetup = (time_left_s: number) =>
    quiet({
      time_left_s,
      player: { carried: 5 },
      lanterns: [
        { id: 'L1', lit: true },
        { id: 'L2', lit: true },
        { id: 'L3', lit: true },
        { id: 'L4', lit: true },
        { id: 'L5', pos: [0, 0, 2] },
      ],
    });

  it('thắng cùng tick hết giờ (time_left_s 0.016) → thưởng thời gian = 0, không âm', () => {
    const r = run({ scenario: winSetup(0.016), frames: [{ tick: 0, interact: true }], ticks: 10 });
    expect(r.snap(0).time_left_s).toBe(0.016);
    expect(r.events.map((e) => e.name)).toEqual(['deposit', 'lantern_lit', 'game_over']);
    expect(r.events[2].data).toEqual({ result: 'won', reason: 'all_lit' });
    // 100 (thắp) + 2 × 0 + 50 × 3 flames = 250 (trước khi sửa: 248 vì floor(−0.0007) = −1).
    expect(r.end).toEqual({ type: 'end', ticks: 1, state: 'won', score: 250 });
    expect(r.snap(1).time_left_s).toBe(0);
  });

  it('time_left_s 1.4, thắng ở tick 24 → còn đúng 60 tick → floor = 1 (không phải 0 do sai số float)', () => {
    // Số thực: 1.4 − 24/60 = 0.9999999999999999 → floor 0 (sai). Theo tick nguyên: 84 − 24 = 60 → 1 s.
    expect(1.4 - 24 / 60).toBeLessThan(1);
    const r = run({ scenario: winSetup(1.4), frames: [{ tick: 23, interact: true }], ticks: 100 });
    expect(r.events.find((e) => e.name === 'game_over')).toMatchObject({ tick: 24 });
    // 100 + 2 × 1 + 150 = 252.
    expect(r.end).toEqual({ type: 'end', ticks: 24, state: 'won', score: 252 });
    expect(r.snap(24).time_left_s).toBe(1);
  });

  it('thắng ở tick 25 với time_left_s 1.4 → còn 59 tick → floor = 0', () => {
    const r = run({ scenario: winSetup(1.4), frames: [{ tick: 24, interact: true }], ticks: 100 });
    expect(r.end).toEqual({ type: 'end', ticks: 25, state: 'won', score: 250 });
  });

  it('dawn đúng ở tick = round(time_left_s × 60), kể cả khi không phải bội của 1/60', () => {
    const r = run({ scenario: quiet({ time_left_s: 1.4 }), ticks: 200 });
    expect(r.events).toEqual([
      { type: 'event', tick: 84, name: 'game_over', data: { result: 'lost', reason: 'dawn' } },
    ]);
  });
});
