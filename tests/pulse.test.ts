import { describe, expect, it } from 'vitest';
import { quiet, run } from './helpers';

describe('Pulse', () => {
  it('AC8: carried 4, shade cách 3 m → stunned, đẩy ra 7 m, carried 2, +20', () => {
    const r = run({
      scenario: quiet({
        player: { carried: 4 },
        shades: [{ pos: [3, 0, 0] }, { pos: [10, 0, 0] }],
      }),
      frames: [{ tick: 0, pulse: true }],
      ticks: 181,
    });
    expect(r.events[0]).toEqual({ type: 'event', tick: 1, name: 'pulse', data: { stunned_ids: ['S1'] } });
    const s1 = r.snap(1);
    expect(s1.player.carried).toBe(2);
    expect(s1.score).toBe(20);
    expect(s1.shades[0]).toEqual({ id: 'S1', pos: [7, 1, 0], state: 'stunned' });
    expect(s1.shades[1].state).toBe('chase');
    // Choáng 3 s: tick 180 vẫn đứng yên, tick 181 đuổi tiếp.
    expect(r.snap(180).shades[0]).toEqual({ id: 'S1', pos: [7, 1, 0], state: 'stunned' });
    expect(r.snap(181).shades[0].state).toBe('chase');
    expect(r.snap(181).shades[0].pos).toEqual([6.942, 1, 0]);
  });

  it('pulse không trúng ai vẫn ghi sự kiện với stunned_ids rỗng', () => {
    const r = run({ scenario: quiet({ player: { carried: 2 } }), frames: [{ tick: 0, pulse: true }], ticks: 1 });
    expect(r.events).toEqual([{ type: 'event', tick: 1, name: 'pulse', data: { stunned_ids: [] } }]);
    expect(r.snap(1).player.carried).toBe(0);
  });

  it('shade trùng vị trí người chơi bị đẩy theo +X', () => {
    const r = run({
      scenario: quiet({ player: { carried: 2 }, shades: [{ id: 'S9', pos: [0, 0, 0] }] }),
      frames: [{ tick: 0, pulse: true }],
      ticks: 1,
    });
    expect(r.events).toEqual([{ type: 'event', tick: 1, name: 'pulse', data: { stunned_ids: ['S9'] } }]);
    expect(r.snap(1).shades[0].pos).toEqual([4, 1, 0]);
  });

  it('đẩy bị kẹp ở mép đảo (R = 40)', () => {
    const r = run({
      scenario: quiet({ player: { pos: [38, 0, 0], carried: 2 }, shades: [{ pos: [39, 0, 0] }] }),
      frames: [{ tick: 0, pulse: true }],
      ticks: 1,
    });
    expect(r.snap(1).shades[0].pos).toEqual([40, 1, 0]);
  });

  it('AC9: carried < 2 → không có sự kiện, không trừ', () => {
    const r = run({
      scenario: quiet({ player: { carried: 1 }, shades: [{ pos: [5, 0, 0] }] }),
      frames: [{ tick: 0, pulse: true }],
      ticks: 1,
    });
    expect(r.events).toEqual([]);
    expect(r.snap(1).player.carried).toBe(1);
    expect(r.snap(1).shades[0].state).toBe('chase');
  });

  it('AC9: đang cooldown (1.5 s = 90 tick) → không có sự kiện', () => {
    const base = quiet({ player: { carried: 6 } });
    const early = run({
      scenario: base,
      frames: [
        { tick: 0, pulse: true },
        { tick: 1, pulse: false },
        { tick: 2, pulse: true },
        { tick: 3, pulse: false },
        { tick: 89, pulse: true },
      ],
      ticks: 100,
    });
    expect(early.events.map((e) => [e.tick, e.name])).toEqual([[1, 'pulse']]);
    expect(early.snap(100).player.carried).toBe(4);

    const ready = run({
      scenario: base,
      frames: [
        { tick: 0, pulse: true },
        { tick: 1, pulse: false },
        { tick: 90, pulse: true },
      ],
      ticks: 100,
    });
    expect(ready.events.map((e) => [e.tick, e.name])).toEqual([
      [1, 'pulse'],
      [91, 'pulse'],
    ]);
    expect(ready.snap(100).player.carried).toBe(2);
  });

  it('giữ nút pulse không kích hoạt lại (chỉ sườn false→true)', () => {
    const r = run({ scenario: quiet({ player: { carried: 6 } }), frames: [{ tick: 0, pulse: true }], ticks: 200 });
    expect(r.events.map((e) => e.tick)).toEqual([1]);
  });
});
