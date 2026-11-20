import { describe, expect, it } from 'vitest';
import { quiet, run } from './helpers';

describe('Đom đóm', () => {
  it('AC4: đom đóm tại (0,0,1) → mote_picked tick 1, carried 1, +10 điểm', () => {
    const r = run({ scenario: quiet({ motes: [[0, 0, 1]] }), ticks: 5 });
    expect(r.events).toEqual([{ type: 'event', tick: 1, name: 'mote_picked', data: { carried: 1 } }]);
    expect(r.snap(1).player.carried).toBe(1);
    expect(r.snap(1).score).toBe(10);
    expect(r.snap(1).motes_active).toBe(0);
  });

  it('đom đóm ngoài pickup_radius (1.6 m) không được nhặt, đúng 1.5 m thì được', () => {
    const r = run({ scenario: quiet({ motes: [[0, 0, 1.6], [1.5, 0, 0]] }), ticks: 1 });
    expect(r.events).toEqual([{ type: 'event', tick: 1, name: 'mote_picked', data: { carried: 1 } }]);
    expect(r.snap(1).motes.map((m) => m.pos)).toEqual([[0, 0, 1.6]]);
  });

  it('AC5: đầy túi (10) thì không nhặt thêm', () => {
    const r = run({ scenario: quiet({ player: { carried: 10 }, motes: [[0, 0, 1]] }), ticks: 30 });
    expect(r.events).toEqual([]);
    expect(r.snap(30).player.carried).toBe(10);
    expect(r.snap(30).motes_active).toBe(1);
    expect(r.end.score).toBe(0);
  });

  it('AC5: carried 9 và 2 con trong tầm → chỉ nhặt 1, con còn lại nằm yên', () => {
    const r = run({ scenario: quiet({ player: { carried: 9 }, motes: [[0, 0, 1], [1, 0, 0]] }), ticks: 10 });
    expect(r.events.map((e) => [e.tick, e.name, e.data])).toEqual([[1, 'mote_picked', { carried: 10 }]]);
    expect(r.snap(10).motes).toEqual([{ id: 'M2', pos: [1, 0, 0] }]);
  });

  it('random_motes: 30 con, nhặt một con thì sinh con mới (vẫn 30)', () => {
    const r = run({ scenario: { random_shades: false, shades: [] }, ticks: 0, seed: 3 });
    const s0 = r.snap(0);
    expect(s0.motes_active).toBe(30);
    for (const m of s0.motes) {
      const d = Math.hypot(m.pos[0], m.pos[2]);
      expect(d).toBeGreaterThanOrEqual(3 - 1e-3);
      expect(d).toBeLessThanOrEqual(38 + 1e-3);
    }
    const target = s0.motes[0].pos;
    const r2 = run({
      scenario: { random_shades: false, shades: [], player: { pos: [target[0], 0, target[2]] } },
      ticks: 1,
      seed: 3,
    });
    expect(r2.events[0]).toMatchObject({ tick: 1, name: 'mote_picked' });
    expect(r2.snap(1).motes_active).toBe(30);
    expect(r2.snap(1).motes.at(-1)!.id).toBe('M31');
  });
});
