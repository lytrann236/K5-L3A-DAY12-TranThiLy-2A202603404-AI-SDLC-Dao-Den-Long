import { describe, expect, it } from 'vitest';
import { distXZ } from '../src/sim/geom';
import { quiet, run } from './helpers';

describe('Vùng an toàn quanh đèn đã sáng (AC2-08)', () => {
  // Sửa theo phase-2.md mục 2: bán kính 6 m (Phase 1: 5 m, dừng ở (0,1,5)).
  it('AC13: bóng ở ngoài bị chặn ở mép 6 m, không chạm được Mây đứng trong vùng', () => {
    const r = run({
      scenario: quiet({
        player: { pos: [0, 0, 3] },
        lanterns: [{ id: 'L1', pos: [0, 0, 0], lit: true }],
        shades: [{ pos: [0, 0, 14] }, { pos: [-8, 0, -5] }],
      }),
      ticks: 600,
    });
    const lamp: [number, number, number] = [0, 0, 0];
    for (let t = 0; t <= 600; t++) {
      for (const sh of r.snap(t).shades) expect(distXZ(sh.pos, lamp)).toBeGreaterThanOrEqual(6 - 1e-3);
    }
    expect(r.events).toEqual([]);
    expect(r.snap(600).shades[0]).toEqual({ id: 'S1', pos: [0, 1, 6], state: 'chase' });
    expect(r.snap(600).shades[1].state).toBe('chase');
  });

  it('AC13 (đối chứng): đèn CHƯA thắp thì bóng tới được Mây', () => {
    const r = run({
      scenario: quiet({
        player: { pos: [0, 0, 3] },
        lanterns: [{ id: 'L1', pos: [0, 0, 0] }],
        shades: [{ pos: [0, 0, 14] }],
      }),
      ticks: 600,
    });
    expect(r.events[0]).toMatchObject({ name: 'player_hit' });
  });

  it('bóng đang ở trong lúc đèn vừa thắp: đẩy ra mép trong 30 tick, không gây hit trong lúc đó', () => {
    // L1 (0,0,25); Mây (0,0,24) nạp 10 ở tick 1; bóng (0,0,22) cách đèn 3 m, cách Mây 2 m.
    const r = run({
      scenario: quiet({ player: { pos: [0, 0, 24], carried: 10 }, shades: [{ pos: [0, 0, 22] }] }),
      frames: [{ tick: 0, interact: true }],
      ticks: 120,
    });
    expect(r.events.map((e) => e.name)).toEqual(['deposit', 'lantern_lit']);
    // 3 m chia đều 30 tick = 0.1 m/tick, bắt đầu ngay tick thắp.
    expect(r.snap(1).shades[0]).toEqual({ id: 'S1', pos: [0, 1, 21.9], state: 'wander' });
    expect(r.snap(15).shades[0].pos).toEqual([0, 1, 20.5]);
    expect(r.snap(30).shades[0].pos).toEqual([0, 1, 19]);
    // Hết đẩy: bóng đuổi nhưng bị chặn ở mép 6 m.
    expect(r.snap(31).shades[0]).toEqual({ id: 'S1', pos: [0, 1, 19], state: 'chase' });
    expect(r.snap(120).shades[0].pos).toEqual([0, 1, 19]);
  });

  it('bóng trùng tâm đèn bị đẩy theo +X; bóng sát Mây trong vùng cũng không gây hit lúc bị đẩy', () => {
    const r = run({
      scenario: quiet({
        player: { pos: [0.5, 0, 0] },
        lanterns: [{ id: 'L1', pos: [0, 0, 0], lit: true }],
        shades: [{ pos: [0, 0, 0] }],
      }),
      ticks: 30,
    });
    expect(r.events).toEqual([]);
    expect(r.snap(1).shades[0].pos).toEqual([0.2, 1, 0]);
    expect(r.snap(30).shades[0].pos).toEqual([6, 1, 0]);
  });
});
