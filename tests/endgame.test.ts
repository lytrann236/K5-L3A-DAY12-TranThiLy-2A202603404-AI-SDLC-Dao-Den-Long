import { describe, expect, it } from 'vitest';
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
});
