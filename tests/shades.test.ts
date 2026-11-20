import { describe, expect, it } from 'vitest';
import { distXZ } from '../src/sim/geom';
import { quiet, run } from './helpers';

describe('Bóng Mực', () => {
  it('đuổi người chơi với 3.5 m/s, lơ lửng Y = 1', () => {
    const r = run({ scenario: quiet({ shades: [{ pos: [20, 0, 0] }] }), ticks: 60 });
    expect(r.snap(0).shades[0]).toEqual({ id: 'S1', pos: [20, 1, 0], state: 'chase' });
    expect(r.snap(60).shades[0].pos).toEqual([16.5, 1, 0]);
  });

  it('AC10: chạm → player_hit, flames −1, rơi floor(carried/2), bất tử 2 s', () => {
    const r = run({
      scenario: quiet({ player: { carried: 5 }, shades: [{ pos: [0.5, 0, 0] }] }),
      ticks: 130,
    });
    const hits = r.events.filter((e) => e.name === 'player_hit');
    expect(hits[0]).toEqual({
      type: 'event',
      tick: 1,
      name: 'player_hit',
      data: { by: 'shade', flames: 2, dropped: 2 },
    });
    expect(r.snap(1).player).toMatchObject({ flames: 2, carried: 3 });
    // Bất tử 120 tick: không trúng ở tick 2…120, trúng lại ở tick 121.
    expect(hits.map((e) => e.tick)).toEqual([1, 121]);
    expect(hits[1].data).toEqual({ by: 'shade', flames: 1, dropped: 1 });
    expect(r.snap(121).player).toMatchObject({ flames: 1, carried: 2 });
  });

  it('shade đang choáng không gây sát thương; nhảy không né được', () => {
    const stunned = run({
      scenario: quiet({ player: { carried: 2 }, shades: [{ pos: [0, 0, 0] }] }),
      frames: [{ tick: 0, pulse: true }],
      ticks: 1,
    });
    expect(stunned.events.map((e) => e.name)).toEqual(['pulse']);

    const jump = run({
      scenario: quiet({ shades: [{ pos: [3, 0, 0] }] }),
      frames: [{ tick: 30, jump: true }],
      ticks: 60,
    });
    const hit = jump.events.find((e) => e.name === 'player_hit')!;
    expect(hit.tick).toBe(35); // shade tới cách 1 m ở tick 35 dù người chơi đang ở trên không
    expect(jump.snap(35).player.pos[1]).toBeGreaterThan(0);
  });

  it('AC11: flames về 0 → game_over lost no_flames', () => {
    const r = run({
      scenario: quiet({ player: { flames: 1 }, shades: [{ pos: [0.5, 0, 0] }] }),
      ticks: 50,
    });
    expect(r.events).toEqual([
      { type: 'event', tick: 1, name: 'player_hit', data: { by: 'shade', flames: 0, dropped: 0 } },
      { type: 'event', tick: 1, name: 'game_over', data: { result: 'lost', reason: 'no_flames' } },
    ]);
    expect(r.end).toEqual({ type: 'end', ticks: 1, state: 'lost', score: 0 });
  });

  it('AC11: 3 lần trúng liên tiếp (cách 120 tick) → thua ở tick 241', () => {
    const r = run({ scenario: quiet({ shades: [{ pos: [0.5, 0, 0] }] }), ticks: 1000 });
    expect(r.events.map((e) => [e.tick, e.name])).toEqual([
      [1, 'player_hit'],
      [121, 'player_hit'],
      [241, 'player_hit'],
      [241, 'game_over'],
    ]);
    expect(r.end).toMatchObject({ ticks: 241, state: 'lost' });
  });

  it('AC13: shade không vào được 5 m quanh đèn đã thắp', () => {
    const r = run({
      scenario: quiet({
        player: { pos: [0, 0, 3] },
        lanterns: [{ id: 'L1', pos: [0, 0, 0], lit: true }],
        shades: [{ pos: [0, 0, 20] }, { pos: [-15, 0, -10] }],
      }),
      ticks: 600,
    });
    const lamp: [number, number, number] = [0, 0, 0];
    for (let t = 0; t <= 600; t++) {
      for (const sh of r.snap(t).shades) {
        expect(distXZ(sh.pos, lamp)).toBeGreaterThanOrEqual(5 - 1e-3);
      }
    }
    expect(r.events).toEqual([]);
    expect(r.snap(600).shades[0].pos).toEqual([0, 1, 5]);
  });

  it('AC13 (đối chứng): đèn CHƯA thắp thì shade tới được người chơi', () => {
    const r = run({
      scenario: quiet({
        player: { pos: [0, 0, 3] },
        lanterns: [{ id: 'L1', pos: [0, 0, 0] }],
        shades: [{ pos: [0, 0, 20] }],
      }),
      ticks: 600,
    });
    expect(r.events[0]).toMatchObject({ name: 'player_hit' });
  });

  it('AC13: shade bị pulse đẩy vào vùng đèn sẽ bị đẩy ra mép vùng', () => {
    const r = run({
      scenario: quiet({
        player: { carried: 2 },
        lanterns: [{ id: 'L1', pos: [8, 0, 0], lit: true }],
        shades: [{ pos: [3, 0, 0] }],
      }),
      frames: [{ tick: 0, pulse: true }],
      ticks: 1,
    });
    // Đẩy tới (7,0) — cách L1 1 m — rồi bị đẩy ra mép vùng 5 m theo hướng L1 → shade.
    expect(r.snap(1).shades[0]).toEqual({ id: 'S1', pos: [3, 1, 0], state: 'stunned' });
  });

  it('random_shades: 3 con đầu cách người chơi ≥ 25 m; sinh thêm mỗi 45 s', () => {
    const r0 = run({ scenario: { random_motes: false, motes: [] }, ticks: 0, seed: 5 });
    const init = r0.snap(0).shades;
    expect(init.map((s) => s.id)).toEqual(['S1', 'S2', 'S3']);
    for (const s of init) {
      expect(Math.hypot(s.pos[0], s.pos[2])).toBeGreaterThanOrEqual(25 - 1e-3);
      expect(Math.hypot(s.pos[0], s.pos[2])).toBeLessThanOrEqual(38 + 1e-3);
      expect(s.pos[1]).toBe(1);
    }

    // Không có shade ban đầu → con đầu tiên sinh ở tick 2700 (45 s), id S1.
    const r = run({ scenario: { random_motes: false, motes: [], shades: [] }, ticks: 2700, seed: 5 });
    expect(r.events).toEqual([{ type: 'event', tick: 2700, name: 'shade_spawned', data: { id: 'S1' } }]);
    const sh = r.snap(2700).shades[0];
    expect(Math.hypot(sh.pos[0], sh.pos[2])).toBeGreaterThanOrEqual(20 - 1e-3);
  });

  it('random_shades: tối đa 6 con', () => {
    const r = run({
      scenario: {
        random_motes: false,
        motes: [],
        player: { flames: 99 },
        shades: [0, 1, 2, 3, 4].map((i) => ({ pos: [30, 0, i] as [number, number, number] })),
        time_left_s: 1000,
      },
      ticks: 5401,
      seed: 5,
    });
    const spawned = r.events.filter((e) => e.name === 'shade_spawned');
    expect(spawned).toEqual([{ type: 'event', tick: 2700, name: 'shade_spawned', data: { id: 'S6' } }]);
    expect(r.snap(5401).shades).toHaveLength(6);
  });

  it('đẩy ra khỏi vùng đèn không đưa shade ra ngoài đảo: đèn (36,0,0), shade (39,0,0)', () => {
    const r = run({
      scenario: quiet({
        player: { pos: [-30, 0, 0] },
        lanterns: [{ id: 'L1', pos: [36, 0, 0], lit: true }],
        shades: [{ pos: [39, 0, 0] }],
      }),
      ticks: 5,
    });
    // Trước khi sửa: đẩy tới (41,1,0) — cách tâm đảo 41 m.
    for (let t = 1; t <= 5; t++) {
      const [x, y, z] = r.snap(t).shades[0].pos;
      expect(Math.hypot(x, z)).toBeLessThanOrEqual(40 + 1e-9);
      expect(y).toBe(1);
    }
    // Đảo ưu tiên hơn vùng đèn (hai ràng buộc xung đột ở sát mép): shade dừng ở mép đảo.
    expect(r.snap(1).shades[0].pos).toEqual([40, 1, 0]);
  });
});
