import { describe, expect, it } from 'vitest';
import { distXZ } from '../src/sim/geom';
import { getMap } from '../src/sim/maps';
import type { Vec3 } from '../src/sim/types';
import { quiet, run, ticksOf } from './helpers';

const m2 = getMap(2);
const A: Vec3 = [0, 0, 0];
const B: Vec3 = [70, 0, 0];
const onIsland = (p: Vec3, c: Vec3) => distXZ(p, c) <= 28 + 1e-9;

describe('Đêm 2 — Đảo Cau: bản đồ chuẩn (AC2-21)', () => {
  it('hai đảo r 28 tâm (0,0,0) / (70,0,0), cầu x ∈ [26,44] z ∈ [−2,2]; ngoài ra là biển mây', () => {
    expect(m2.groundAt(0, 28)).toBe(0);
    expect(m2.groundAt(0, 28.01)).toBeNull();
    expect(m2.groundAt(70, -28)).toBe(0);
    expect(m2.groundAt(98.01, 0)).toBeNull();
    expect(m2.groundAt(35, 2)).toBe(0);
    expect(m2.groundAt(35, -2)).toBe(0);
    expect(m2.groundAt(35, 2.01)).toBeNull();
    expect(m2.groundAt(35, 0)).toBe(0);
    expect(m2.groundAt(30, 10)).toBeNull(); // khe giữa hai đảo ngoài cầu
  });

  it('6 đèn L1…L6 đúng tọa độ và thứ tự; xuất phát (0,0,0) quay +Z; 330 s; lịch bóng 300 + 420k, tối đa 8', () => {
    expect(m2.lanterns).toEqual([
      { id: 'L1', pos: [0, 0, 20] },
      { id: 'L2', pos: [17, 0, -10] },
      { id: 'L3', pos: [-17, 0, -10] },
      { id: 'L4', pos: [70, 0, 20] },
      { id: 'L5', pos: [87, 0, -10] },
      { id: 'L6', pos: [53, 0, -10] },
    ]);
    expect(m2.start).toEqual([0, 0, 0]);
    expect(m2.startFacing).toEqual([0, 1]);
    expect(m2.durationS).toBe(330);
    expect([m2.shadeFirstTick, m2.shadeIntervalTicks, m2.shadeMax]).toEqual([300, 420, 8]);
  });

  it('24 điểm đom đóm: mỗi đảo 4 điểm r 10 (0/90/180/270°) + 8 điểm r 22 (mỗi 45°), khác nhau', () => {
    expect(m2.moteSpawns).toHaveLength(24);
    for (const [c, pts] of [
      [A, m2.moteSpawns.slice(0, 12)],
      [B, m2.moteSpawns.slice(12)],
    ] as const) {
      const r = pts.map((p) => Math.round(distXZ(p, c) * 1000) / 1000);
      expect(r).toEqual([10, 10, 10, 10, 22, 22, 22, 22, 22, 22, 22, 22]);
    }
    expect(m2.moteSpawns[1][2]).toBeCloseTo(10); // r 10 ở 90° = +Z
    const keys = new Set(m2.moteSpawns.map((p) => p.map((v) => v.toFixed(3)).join()));
    expect(keys.size).toBe(24);
  });

  it('16 điểm sinh Bóng Mực r 26 quanh mỗi đảo ở 22.5°, 67.5°, …', () => {
    expect(m2.shadeSpawns).toHaveLength(16);
    const a = m2.shadeSpawns[0];
    expect(a[0]).toBeCloseTo(26 * Math.cos(Math.PI / 8));
    expect(a[2]).toBeCloseTo(26 * Math.sin(Math.PI / 8));
    for (const p of m2.shadeSpawns.slice(0, 8)) expect(distXZ(p, A)).toBeCloseTo(26);
    for (const p of m2.shadeSpawns.slice(8)) expect(distXZ(p, B)).toBeCloseTo(26);
  });

  it('--night 2: snapshot tick 0 có night 2, 330 s, 6 đèn; 20 đom đóm trên điểm của Đêm 2', () => {
    const r = run({ night: 2, ticks: 0 });
    const s0 = r.snap(0);
    expect(s0).toMatchObject({ night: 2, time_left_s: 330, player: { flames: 3, pos: [0, 0, 0] } });
    expect(s0.lanterns.map((l) => l.id)).toEqual(['L1', 'L2', 'L3', 'L4', 'L5', 'L6']);
    expect(s0.motes).toHaveLength(20);
    for (const m of s0.motes) {
      expect(m2.moteSpawns.some((p) => distXZ(p, m.pos) < 1e-3)).toBe(true);
    }
    expect(r.allEvents[0]).toEqual({ type: 'event', tick: 0, name: 'night_start', data: { night: 2 } });
  });

  it('lịch sinh bóng Đêm 2: S1, S2 ở tick 300, S3 ở 720, S4 ở 1140; trên điểm r 26, cách Mây ≥ 15 m', () => {
    const r = run({ night: 2, ticks: 1200, scenario: quiet({ random_shades: true }) });
    const spawns = r.events.filter((e) => e.name === 'shade_spawned');
    expect(spawns.map((e) => [e.tick, e.data.id])).toEqual([
      [300, 'S1'],
      [300, 'S2'],
      [720, 'S3'],
      [1140, 'S4'],
    ]);
    for (const sh of r.snap(1140).shades) {
      expect(m2.shadeSpawns.some((p) => distXZ(p, sh.pos) < 1e-3) || sh.state !== 'spawning').toBe(true);
    }
  });
});

describe('Đêm 2: cầu tre và rơi (AC2-21, AC2-14)', () => {
  it('đi dọc cầu từ đảo A sang đảo B (z = 0) không rơi', () => {
    const r = run({
      night: 2,
      scenario: quiet({ player: { pos: [20, 0, 0] }, charms: [] }), // bỏ bùa C1 trên cầu (đổi tốc độ)
      frames: [{ tick: 0, move: [0, 1], cam_yaw_deg: 90 }], // yaw 90 → đi theo +X
      ticks: 330, // 33 m → x = 53
    });
    expect(ticksOf(r.events, 'player_hit')).toEqual([]);
    expect(r.snap(150).player).toMatchObject({ pos: [35, 0, 0], grounded: true });
    expect(r.snap(330).player).toMatchObject({ pos: [53, 0, 0], grounded: true });
  });

  it('bước ra khỏi mép cầu (z > 2) thì rơi: player_hit fall có lost, hồi sinh ở (0,0,0)', () => {
    const r = run({
      night: 2,
      scenario: quiet({ player: { pos: [35, 0, 0], carried: 4 }, charms: [] }),
      frames: [{ tick: 0, move: [0, 1] }], // +Z
      ticks: 200,
    });
    // z = 0.1·t: còn trên cầu ở tick 19 (z 1.9), đã ra ngoài ở tick 21 (z 2.1). Tick 20 (z = 2 cộng
    // dồn số thực) nằm đúng biên nên không kiểm.
    expect(r.snap(19).player).toMatchObject({ pos: [35, 0, 1.9], grounded: true });
    expect(r.snap(21).player.grounded).toBe(false);
    expect(r.snap(22).player.pos[1]).toBeLessThan(0);
    const hits = r.events.filter((e) => e.name === 'player_hit');
    expect(hits).toHaveLength(1);
    expect(hits[0].data).toEqual({ by: 'fall', flames: 2, dropped: 0, lost: 4 });
    const t = hits[0].tick;
    expect(r.snap(t + 60).player).toMatchObject({ pos: [0, 0, 0], vel: [0, 0, 0], invuln: true, carried: 0 });
  });

  it('khe giữa hai đảo ngoài cầu là biển mây: từ (27,0,5) đi +X thì rơi', () => {
    const r = run({
      night: 2,
      scenario: quiet({ player: { pos: [27, 0, 5] } }),
      frames: [{ tick: 0, move: [0, 1], cam_yaw_deg: 90 }],
      ticks: 120,
    });
    expect(r.events.find((e) => e.name === 'player_hit')?.data).toMatchObject({ by: 'fall' });
  });

  it('Bóng Mực bị kẹp trong phạm vi đảo/cầu: không bay qua khe theo Mây đang bay trên bục', () => {
    // Bóng đứng sát mép đảo A ở hướng +X ngoài cầu; Mây ở khe (đang rơi) ngay bên ngoài.
    const r = run({
      night: 2,
      scenario: quiet({ player: { pos: [29.5, 0, 10] }, shades: [{ pos: [25.5, 0, 10] }] }),
      ticks: 30,
    });
    for (let t = 0; t <= 30; t++) expect(m2.groundAt(r.snap(t).shades[0].pos[0], r.snap(t).shades[0].pos[2])).toBe(0);
    expect(r.snap(30).shades[0].state).toBe('chase');
  });

  it('bị đánh trên cầu: đom đóm rơi luôn nằm trên mặt đất (cầu hoặc đảo)', () => {
    const r = run({
      night: 2,
      seed: 4,
      scenario: quiet({ player: { pos: [35, 0, 0], carried: 10 }, shades: [{ pos: [35.5, 0, 0] }], charms: [] }),
      ticks: 1,
    });
    expect(r.events[0].data).toEqual({ by: 'shade', flames: 2, dropped: 5 });
    const motes = r.snap(1).motes;
    expect(motes).toHaveLength(5);
    for (const m of motes) {
      expect(m.kind).toBe('dropped');
      expect(m2.groundAt(m.pos[0], m.pos[2])).toBe(0);
    }
  });
});

describe('Đêm 2: bục nhảy (AC2-22)', () => {
  it('bục (20,0,18): vy 14, ngang 24 m/s về tâm đảo B; bay 84 tick (1.4 s), đáp trong đảo B', () => {
    const r = run({ night: 2, scenario: quiet({ player: { pos: [20, 0, 18] } }), ticks: 90 });
    const dir = [50 / Math.hypot(50, 18), -18 / Math.hypot(50, 18)];
    const v1 = r.snap(1).player.vel;
    expect(v1[0]).toBeCloseTo(24 * dir[0], 3);
    expect(v1[2]).toBeCloseTo(24 * dir[1], 3);
    expect(v1[1]).toBeCloseTo(14 - 20 / 60, 3);
    expect(r.snap(83).player.grounded).toBe(false);
    const land = r.snap(84).player;
    expect(land.grounded).toBe(true);
    expect(land.pos[1]).toBe(0);
    // 84 tick × 0.4 m = 33.6 m theo hướng về tâm B.
    expect(land.pos[0]).toBeCloseTo(20 + 33.6 * dir[0], 2);
    expect(land.pos[2]).toBeCloseTo(18 + 33.6 * dir[1], 2);
    expect(onIsland(land.pos, B)).toBe(true);
    expect(ticksOf(r.events, 'player_hit')).toEqual([]);
  });

  it('bục (50,0,−18) bắn về tâm đảo A, đáp trong đảo A', () => {
    const r = run({ night: 2, scenario: quiet({ player: { pos: [50, 0, -18] } }), ticks: 90 });
    const land = r.snap(84).player;
    expect(land.grounded).toBe(true);
    expect(onIsland(land.pos, A)).toBe(true);
    expect(land.pos[0]).toBeCloseTo(50 - 33.6 * (50 / Math.hypot(50, 18)), 2);
  });

  it('chạm bục ở mép r 1 cũng phóng; ngoài 1 m thì không', () => {
    const edge = run({ night: 2, scenario: quiet({ player: { pos: [19, 0, 18] } }), ticks: 1 });
    expect(edge.snap(1).player.grounded).toBe(false);
    const out = run({ night: 2, scenario: quiet({ player: { pos: [18.99, 0, 18] } }), ticks: 1 });
    expect(out.snap(1).player).toMatchObject({ pos: [18.99, 0, 18], grounded: true });
  });

  it('đi bộ lên bục thì phóng ở tick kế tiếp; phím di chuyển không ghi đè vận tốc phóng', () => {
    const r = run({
      night: 2,
      scenario: quiet({ player: { pos: [18.5, 0, 18] } }),
      frames: [
        { tick: 0, move: [0, 1], cam_yaw_deg: 90 }, // +X: 0.1 m/tick → x = 19.0 ở tick 5
        { tick: 10, move: [-1, -1] },
      ],
      ticks: 100,
    });
    expect(r.snap(5).player).toMatchObject({ pos: [19, 0, 18], grounded: true });
    expect(r.snap(6).player.grounded).toBe(false);
    const v = r.snap(30).player.vel;
    expect(Math.hypot(v[0], v[2])).toBeCloseTo(24, 3);
    expect(r.snap(6 + 83).player.grounded).toBe(true); // vẫn bay đúng 84 tick
    expect(onIsland(r.snap(89).player.pos, B)).toBe(true);
  });

  it('vẫn lướt được khi đang bay: lướt giữ độ cao, hết lướt bay tiếp với vận tốc phóng, đáp trong đảo B', () => {
    const r = run({
      night: 2,
      scenario: quiet({ player: { pos: [20, 0, 18] } }),
      frames: [
        { tick: 20, dash: true, move: [0, 1], cam_yaw_deg: 90 },
        { tick: 21, dash: false },
      ],
      ticks: 120,
    });
    expect(ticksOf(r.events, 'dash')).toEqual([21]);
    const y = r.snap(21).player.pos[1];
    expect(r.snap(32).player.pos[1]).toBe(y); // 12 tick lướt giữ nguyên độ cao
    expect(r.snap(32).player.vel).toEqual([14, 0, 0]);
    const v = r.snap(33).player.vel;
    expect(Math.hypot(v[0], v[2])).toBeCloseTo(24, 3);
    const landTick = [...Array(121).keys()].find((t) => t > 33 && r.snap(t).player.grounded)!;
    expect(landTick).toBe(84 + 12);
    expect(onIsland(r.snap(landTick).player.pos, B)).toBe(true);
    expect(ticksOf(r.events, 'player_hit')).toEqual([]);
  });

  it('đang bay thì nút nhảy không có tác dụng; đáp xong mới nhảy được', () => {
    const r = run({
      night: 2,
      scenario: quiet({ player: { pos: [20, 0, 18] } }),
      frames: [
        { tick: 10, jump: true },
        { tick: 11, jump: false },
      ],
      ticks: 84,
    });
    expect(r.snap(84).player.grounded).toBe(true);
  });
});
