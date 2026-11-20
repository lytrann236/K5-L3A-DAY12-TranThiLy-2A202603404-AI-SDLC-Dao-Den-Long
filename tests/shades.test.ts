import { describe, expect, it } from 'vitest';
import { distXZ } from '../src/sim/geom';
import { getMap } from '../src/sim/maps';
import type { Vec3 } from '../src/sim/types';
import { quiet, run, ticksOf } from './helpers';

const STATES = new Set(['spawning', 'wander', 'chase', 'recoil', 'stunned']);
const r3 = (v: number) => Math.round(v * 1000) / 1000;

describe('Bóng Mực: trạng thái và di chuyển (AC2-10)', () => {
  // Sửa theo phase-2.md mục 2: 3.5 → 4.0 m/s và chỉ đuổi khi ≤ 12 m (Phase 1 luôn đuổi từ 20 m).
  it('wander → chase khi ≤ 12 m, đuổi 4.0 m/s, lơ lửng Y = 1', () => {
    const r = run({ scenario: quiet({ shades: [{ pos: [10, 0, 0] }] }), ticks: 60 });
    expect(r.snap(0).shades[0]).toEqual({ id: 'S1', pos: [10, 1, 0], state: 'wander' });
    expect(r.snap(1).shades[0]).toEqual({ id: 'S1', pos: [9.933, 1, 0], state: 'chase' });
    expect(r.snap(60).shades[0].pos).toEqual([6, 1, 0]);
  });

  it('phát hiện đúng 12 m thì đuổi; 12.01 m thì đứng yên (wander)', () => {
    const at12 = run({ scenario: quiet({ shades: [{ pos: [12, 0, 0] }] }), ticks: 1 });
    expect(at12.snap(1).shades[0].state).toBe('chase');
    const far = run({ scenario: quiet({ shades: [{ pos: [12.01, 0, 0] }] }), ticks: 60 });
    expect(far.snap(60).shades[0]).toEqual({ id: 'S1', pos: [12.01, 1, 0], state: 'wander' });
  });

  it('chase → wander khi Mây cách > 18 m (Mây chạy 6 m/s nhanh hơn bóng 4 m/s)', () => {
    const r = run({
      // 11.05 để biên 18 m không rơi đúng số nguyên (tránh so sánh số thực ngay biên).
      scenario: quiet({ shades: [{ pos: [11.05, 0, 0] }] }),
      frames: [{ tick: 0, move: [-1, 0] }],
      ticks: 300,
    });
    expect(r.snap(200).shades[0].state).toBe('chase');
    const t = [...Array(301).keys()].find((k) => r.snap(k).shades[0].state === 'wander' && k > 0)!;
    // Lúc bỏ đuổi: khoảng cách (đo trước khi bóng đi ở tick đó) > 18, tick trước thì chưa.
    expect(t).toBeGreaterThan(200);
    const gapNow = distXZ(r.snap(t).player.pos, r.snap(t).shades[0].pos);
    expect(gapNow).toBeGreaterThan(18);
    expect(distXZ(r.snap(t - 1).player.pos, r.snap(t - 1).shades[0].pos)).toBeLessThanOrEqual(18 + 0.1);
    expect(r.snap(300).shades[0].pos).toEqual(r.snap(t).shades[0].pos); // wander đứng yên
  });

  it('spawning 30 tick: đứng yên, không gây hit; hết thì wander rồi xét phát hiện ngay', () => {
    const r = run({ scenario: quiet({ shades: [{ pos: [0.5, 0, 0], state: 'spawning' }] }), ticks: 40 });
    expect(r.snap(29).shades[0]).toEqual({ id: 'S1', pos: [0.5, 1, 0], state: 'spawning' });
    expect(ticksOf(r.events, 'player_hit')).toEqual([30]);
  });

  it('AC2-58: mọi trạng thái trong một Đêm ngẫu nhiên đều thuộc 5 tên bắt buộc', () => {
    const r = run({
      ticks: 3000,
      seed: 9,
      frames: [
        { tick: 0, move: [0.3, 1] },
        { tick: 400, move: [1, -0.2] },
        { tick: 900, move: [-1, 0] },
      ],
    });
    const seen = new Set<string>();
    for (const l of r.lines) if (l.type === 'snapshot') for (const sh of l.shades) seen.add(sh.state);
    for (const st of seen) expect(STATES.has(st)).toBe(true);
    expect(seen.size).toBeGreaterThan(1);
  });
});

describe('Bóng Mực: chạm và bị đánh (AC2-11, AC2-13)', () => {
  // Sửa theo phase-2.md mục 2: bất tử 90 tick (trúng lại ở tick 91), bóng recoil lùi 2 m,
  // đom đóm rơi thành `dropped` (Phase 1: biến mất, trúng lại ở tick 121).
  it('AC10: chạm → player_hit, −1 lửa, rơi floor(carried/2) thành dropped, bất tử 90 tick', () => {
    const r = run({
      scenario: quiet({ player: { carried: 5 }, shades: [{ pos: [0.5, 0, 0] }] }),
      ticks: 100,
    });
    const hits = r.events.filter((e) => e.name === 'player_hit');
    expect(hits[0]).toEqual({ type: 'event', tick: 1, name: 'player_hit', data: { by: 'shade', flames: 2, dropped: 2 } });
    expect(r.snap(1).player).toMatchObject({ flames: 2, carried: 3, invuln: true });
    expect(hits.map((e) => e.tick)).toEqual([1, 91]);
    expect(hits[1].data).toEqual({ by: 'shade', flames: 1, dropped: 1 });
    expect(r.snap(90).player.invuln).toBe(true);
  });

  it('AC2-13: đom đóm rơi trên vành 1.5–2.5 m quanh Mây, kind dropped, TTL 480 tick', () => {
    const r = run({
      scenario: quiet({ player: { carried: 4, flames: 9 }, shades: [{ pos: [0.5, 0, 0] }] }),
      ticks: 482,
    });
    const ms = r.snap(1).motes;
    expect(ms.map((m) => [m.id, m.kind, m.ttl_s])).toEqual([
      ['M1', 'dropped', 8],
      ['M2', 'dropped', 8],
    ]);
    for (const m of ms) {
      const d = Math.hypot(m.pos[0], m.pos[2]);
      expect(d).toBeGreaterThanOrEqual(1.5 - 1e-3);
      expect(d).toBeLessThanOrEqual(2.5 + 1e-3);
      expect(m.pos[1]).toBe(0);
    }
    const ids = (t: number) => r.snap(t).motes.map((m) => m.id);
    expect(r.snap(480).motes.find((m) => m.id === 'M1')!.ttl_s).toBe(0.017);
    expect(ids(480)).toContain('M1');
    expect(ids(481)).not.toContain('M1');
    expect(ids(481)).not.toContain('M2');
  });

  it('AC2-13: đom đóm rơi nhặt lại được (từ tick sau) và không cộng điểm', () => {
    const first = run({ scenario: quiet({ player: { carried: 2 }, shades: [{ pos: [0.5, 0, 0] }] }), ticks: 1 });
    const m = first.snap(1).motes[0];
    const d = Math.hypot(m.pos[0], m.pos[2]);
    const r = run({
      scenario: quiet({ player: { carried: 2 }, shades: [{ pos: [0.5, 0, 0] }] }),
      frames: [{ tick: 1, move: [m.pos[0] / d, m.pos[2] / d] }],
      ticks: 30,
    });
    const pick = r.events.find((e) => e.name === 'mote_picked')!;
    expect(pick.data).toEqual({ carried: 2 });
    expect(pick.tick).toBeGreaterThan(1);
    expect(r.snap(pick.tick).score).toBe(0);
  });

  it('AC2-11: bóng gây hit chuyển recoil, lùi 2 m trong 60 tick ra xa Mây, không gây hit trong lúc đó', () => {
    const r = run({ scenario: quiet({ player: { carried: 0 }, shades: [{ pos: [0.5, 0, 0] }] }), ticks: 62 });
    // Tick 1: bóng đuổi 4/60 m (bước 8) rồi chạm (bước 9) ở x = 0.433; lùi từ tick 2 tới tick 61.
    expect(r.snap(1).shades[0]).toEqual({ id: 'S1', pos: [0.433, 1, 0], state: 'recoil' });
    expect(r.snap(31).shades[0].pos).toEqual([1.433, 1, 0]);
    expect(r.snap(60).shades[0].state).toBe('recoil');
    expect(r.snap(61).shades[0]).toEqual({ id: 'S1', pos: [2.433, 1, 0], state: 'wander' });
    expect(r.snap(62).shades[0].state).toBe('chase');
  });

  it('AC2-11: chạm lúc Mây bất tử không làm gì (bóng không recoil, không mất lửa)', () => {
    const r = run({ scenario: quiet({ player: { invuln_ticks: 50 }, shades: [{ pos: [0.5, 0, 0] }] }), ticks: 49 });
    expect(r.events).toEqual([]);
    expect(r.snap(49).shades[0]).toMatchObject({ state: 'chase', pos: [0, 1, 0] });
  });

  it('AC2-11: tối đa 1 hit mỗi tick, bóng id nhỏ nhất (theo số) gây hit trước', () => {
    const r = run({
      scenario: quiet({
        shades: [
          { id: 'S10', pos: [0.5, 0, 0] },
          { id: 'S9', pos: [-0.5, 0, 0] },
        ],
      }),
      ticks: 1,
    });
    expect(r.events).toHaveLength(1);
    expect(r.snap(1).shades.map((s) => [s.id, s.state])).toEqual([
      ['S10', 'chase'],
      ['S9', 'recoil'],
    ]);
  });

  it('AC2-11: chênh cao > 1.5 m (chân Mây so với mặt đất dưới tâm bóng) thì không chạm', () => {
    // Mây rơi từ Y 2: y(n) = 2 − 10 (n/60)² ≤ 1.5 lần đầu ở n = 14.
    const r = run({ scenario: quiet({ player: { pos: [0, 2, 0] }, shades: [{ pos: [0.5, 0, 0] }] }), ticks: 20 });
    expect(ticksOf(r.events, 'player_hit')).toEqual([14]);
    expect(r.snap(13).player.pos[1]).toBeGreaterThan(1.5);
  });

  it('nhảy (đỉnh 1.225 m < 1.5) không né được Bóng Mực', () => {
    const r = run({ scenario: quiet({ shades: [{ pos: [3, 0, 0] }] }), frames: [{ tick: 25, jump: true }], ticks: 60 });
    const hit = r.events.find((e) => e.name === 'player_hit')!;
    expect(r.snap(hit.tick).player.pos[1]).toBeGreaterThan(0);
  });

  it('bóng đang stunned / recoil (đặt trong scenario) không gây hit', () => {
    const st = run({ scenario: quiet({ shades: [{ pos: [0.5, 0, 0], state: 'stunned' }] }), ticks: 130 });
    expect(ticksOf(st.events, 'player_hit')).toEqual([120]); // choáng 120 tick rồi wander → chase
    const rc = run({ scenario: quiet({ shades: [{ pos: [0.5, 0, 0], state: 'recoil' }] }), ticks: 61 });
    expect(rc.events).toEqual([]);
    expect(rc.snap(60).shades[0]).toEqual({ id: 'S1', pos: [2.5, 1, 0], state: 'wander' });
  });

  it('AC11: flames về 0 → game_over lost no_flames', () => {
    const r = run({ scenario: quiet({ player: { flames: 1 }, shades: [{ pos: [0.5, 0, 0] }] }), ticks: 50 });
    expect(r.events).toEqual([
      { type: 'event', tick: 1, name: 'player_hit', data: { by: 'shade', flames: 0, dropped: 0 } },
      { type: 'event', tick: 1, name: 'game_over', data: { result: 'lost', reason: 'no_flames' } },
    ]);
    expect(r.end).toEqual({ type: 'end', ticks: 1, state: 'lost', score: 0 });
  });

  // Sửa theo phase-2.md mục 2: bất tử 90 tick + recoil → 3 lần trúng ở tick 1, 91, 181 (Phase 1: 1, 121, 241).
  it('AC11: 3 lần trúng liên tiếp (cách 90 tick) → thua ở tick 181', () => {
    const r = run({ scenario: quiet({ shades: [{ pos: [0.5, 0, 0] }] }), ticks: 1000 });
    expect(r.events.map((e) => [e.tick, e.name])).toEqual([
      [1, 'player_hit'],
      [91, 'player_hit'],
      [181, 'player_hit'],
      [181, 'game_over'],
    ]);
    expect(r.end).toMatchObject({ ticks: 181, state: 'lost' });
  });
});

describe('Bóng Mực: lịch sinh (AC2-12, AC2-20)', () => {
  const pts = getMap(1).shadeSpawns;
  const ptKeys = new Set(pts.map((p) => `${r3(p[0])},${r3(p[2])}`));

  it('12 điểm sinh r 37 ở 15°, 45°, …', () => {
    expect(pts).toHaveLength(12);
    expect(pts[0].map(r3)).toEqual([35.739, 0, 9.576]);
    for (const p of pts) expect(Math.hypot(p[0], p[2])).toBeCloseTo(37, 9);
  });

  // Thay theo phase-2.md mục 2: Phase 1 sinh 3 con lúc đầu + mỗi 45 s.
  it('S1, S2 ở tick 300; S3 ở 780; rồi mỗi 480 tick; tối đa 6; trên điểm chuẩn, spawning 30 tick', () => {
    const r = run({ scenario: { random_motes: false, motes: [] }, ticks: 3000, seed: 5 });
    expect(r.snap(0).shades).toEqual([]);
    expect(r.events.filter((e) => e.name === 'shade_spawned').map((e) => [e.tick, e.data.id])).toEqual([
      [300, 'S1'],
      [300, 'S2'],
      [780, 'S3'],
      [1260, 'S4'],
      [1740, 'S5'],
      [2220, 'S6'],
    ]);
    const s300 = r.snap(300).shades;
    expect(s300.map((s) => s.state)).toEqual(['spawning', 'spawning']);
    expect(s300[0].pos).not.toEqual(s300[1].pos);
    for (const s of r.snap(2220).shades) {
      expect(ptKeys.has(`${s.pos[0]},${s.pos[2]}`)).toBe(true);
      expect(s.pos[1]).toBe(1);
    }
    expect(r.snap(329).shades[0].state).toBe('spawning');
    expect(r.snap(330).shades[0].state).toBe('wander');
    expect(r.snap(3000).shades).toHaveLength(6);
  });

  it('cách Mây ≥ 15 m: Mây đứng trên một điểm sinh thì điểm đó không bao giờ được chọn', () => {
    const me = pts[0];
    const r = run({
      scenario: { random_motes: false, motes: [], player: { pos: [me[0], 0, me[2]] } },
      ticks: 2300,
      seed: 11,
    });
    for (const s of r.snap(2220).shades) expect(distXZ(s.pos as Vec3, me)).toBeGreaterThanOrEqual(15);
  });

  it('tối đa 6 con tồn tại: đã có 5 thì tick 300 chỉ sinh 1 (S6)', () => {
    const r = run({
      scenario: {
        random_motes: false,
        motes: [],
        shades: [0, 1, 2, 3, 4].map((i) => ({ pos: [-30, 0, i * 2] as Vec3 })),
      },
      ticks: 1000,
      seed: 5,
    });
    expect(r.events.filter((e) => e.name === 'shade_spawned').map((e) => [e.tick, e.data.id])).toEqual([[300, 'S6']]);
  });

  it('AC2-18: thực thể mới sinh chỉ tương tác được từ tick sau (đom đóm sinh dưới chân ở tick 240 nhặt ở 241)', () => {
    const map = getMap(1);
    const free = map.moteSpawns[3];
    const others = map.moteSpawns.filter((_, i) => i !== 3);
    const r = run({
      scenario: { random_shades: false, motes: others, player: { pos: [free[0], 0, free[2]] } },
      ticks: 245,
    });
    expect(r.snap(240).motes.at(-1)!.pos.map(r3)).toEqual([r3(free[0]), 0, r3(free[2])]);
    expect(r.events.map((e) => [e.tick, e.name])).toEqual([[241, 'mote_picked']]);
  });

  it('Bóng Mực luôn ở trong phạm vi đảo (r ≤ 40) kể cả khi đuổi Mây đã rơi ra ngoài', () => {
    const r = run({
      scenario: quiet({ player: { pos: [39.5, 0, 0] }, shades: [{ pos: [35, 0, 0] }] }),
      frames: [{ tick: 0, move: [1, 0] }],
      ticks: 100,
    });
    for (let t = 0; t <= 100; t++) {
      const [x, y, z] = r.snap(t).shades[0].pos;
      expect(Math.hypot(x, z)).toBeLessThanOrEqual(40 + 1e-6);
      expect(y).toBe(1);
    }
  });
});
