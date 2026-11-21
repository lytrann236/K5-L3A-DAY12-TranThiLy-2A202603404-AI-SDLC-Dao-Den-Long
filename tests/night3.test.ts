import { describe, expect, it } from 'vitest';
import { distXZ } from '../src/sim/geom';
import { getMap } from '../src/sim/maps';
import { n3ResolveMove } from '../src/sim/night3';
import type { InputFrame, Scenario, Vec3 } from '../src/sim/types';
import { quiet, run, ticksOf } from './helpers';

const m3 = getMap(3);
const g = (x: number, z: number) => m3.groundAt(x, z);
const r3 = (sc: Scenario = {}) => quiet({ charms: [], random_drifters: false, ...sc });
const deg = (d: number): [number, number] => [Math.cos((d * Math.PI) / 180), Math.sin((d * Math.PI) / 180)];
const rxz = (p: Vec3) => Math.hypot(p[0], p[2]);
const n3 = (ticks: number, scenario: Scenario, frames: InputFrame[] = [], seed = 1) =>
  run({ night: 3, ticks, seed, scenario, frames });

describe('Đêm 3 — Đảo Chuông: hình học (AC2-23, AC2-24, AC2-26)', () => {
  it('đảo r 45; tầng 1 Y 3 là vành r 12–24 chỉ ở z > 0; tầng 2 Y 6 là đĩa r 8; còn lại Y 0', () => {
    expect(g(0, -45)).toBe(0);
    expect(g(0, -45.01)).toBeNull();
    expect(g(31.8, 31.8)).toBe(0); // r ≈ 44.97
    expect(g(0, 8)).toBe(6);
    expect(g(0, -8)).toBe(6);
    expect(g(0, -8.01)).toBe(0);
    expect(g(0, 12)).toBe(3);
    expect(g(0, 11.99)).toBe(0);
    expect(g(0, 24)).toBe(3);
    expect(g(0, 24.01)).toBe(0);
    expect(g(18, 0.01)).toBe(3);
    expect(g(18, 0)).toBe(0); // z = 0 không thuộc tầng 1
    expect(g(18, -1)).toBe(0); // nửa z < 0 không có tầng 1
    expect(g(0, -18)).toBe(0);
  });

  it('2 dốc rộng 3 m ở 30° và 150°: Y 0 ở r 30, Y 3 ở r 24, tuyến tính; ngoài bề rộng là Y 0', () => {
    for (const d of [30, 150]) {
      const [ax, az] = deg(d);
      const [px, pz] = [-az, ax]; // vuông góc
      expect(g(30 * ax, 30 * az)).toBeCloseTo(0);
      expect(g(27 * ax, 27 * az)).toBeCloseTo(1.5);
      expect(g(25 * ax, 25 * az)).toBeCloseTo(2.5);
      expect(g(24.01 * ax, 24.01 * az)).toBeCloseTo(3, 1);
      expect(g(27 * ax + 1.49 * px, 27 * az + 1.49 * pz)).toBeCloseTo(1.5);
      expect(g(27 * ax + 1.51 * px, 27 * az + 1.51 * pz)).toBe(0);
      expect(g(30.01 * ax, 30.01 * az)).toBe(0);
    }
    // Đỉnh dốc nối liền tầng 1, kể cả ở mép bên (không có khe giữa đầu dốc thẳng và vành tròn r 24).
    const [ax, az] = deg(30);
    for (let i = -6; i <= 6; i++) {
      const w = i * 0.2475; // tới ±1.485 (bỏ đúng mép ±1.5, nơi sai số làm tròn quyết định)
      for (let k = 0; k <= 10; k++) {
        const u = 23.9 + k * 0.02;
        const x = u * ax - w * az;
        const z = u * az + w * ax;
        expect(g(x, z)).toBeGreaterThanOrEqual(2.94); // ≥ 3 × (30 − 24.1) / 6
      }
    }
  });

  it('tháp chuông r 2 ở tâm chặn Mây: điểm trong tháp luôn bị đẩy ra mép r 2', () => {
    const [x, z] = n3ResolveMove(0, -2.05, 0.01, -1.9, 6.3);
    expect(Math.hypot(x, z)).toBeGreaterThanOrEqual(2);
    expect(Math.hypot(x, z)).toBeCloseTo(2, 6);
  });

  it('bản đồ chuẩn: xuất phát (0,0,−30) quay +Z, 360 s, 7 đèn, bùa C1 (30,0,25) / C2 (−30,0,25), bục (0,3,13)', () => {
    expect(m3.start).toEqual([0, 0, -30]);
    expect(m3.startFacing).toEqual([0, 1]);
    expect(m3.durationS).toBe(360);
    expect(m3.lanterns).toEqual([
      { id: 'L1', pos: [0, 6, 6] },
      { id: 'L2', pos: [18, 3, 10] },
      { id: 'L3', pos: [-18, 3, 10] },
      { id: 'L4', pos: [35, 0, -10] },
      { id: 'L5', pos: [-35, 0, -10] },
      { id: 'L6', pos: [20, 0, -35] },
      { id: 'L7', pos: [-20, 0, -35] },
    ]);
    // Đèn đặt đúng trên mặt đất của tầng mình.
    for (const l of m3.lanterns) expect(g(l.pos[0], l.pos[2])).toBe(l.pos[1]);
    expect(m3.charms).toEqual([
      { id: 'C1', pos: [30, 0, 25] },
      { id: 'C2', pos: [-30, 0, 25] },
    ]);
    expect(m3.pads).toEqual([{ pos: [0, 3, 13], radius: 1, vel: [0, 12, -8] }]);
  });

  it('30 điểm đom đóm: 18 điểm r 34 Y 0 (mỗi 20° từ 0°), 8 điểm r 18 Y 3 (20°…160°), 4 điểm r 5 Y 6', () => {
    const pts = m3.moteSpawns;
    expect(pts).toHaveLength(30);
    const tier = (a: number, b: number) => pts.slice(a, b);
    for (const p of tier(0, 18)) expect([Math.round(rxz(p) * 1e6) / 1e6, p[1]]).toEqual([34, 0]);
    for (const p of tier(18, 26)) expect([Math.round(rxz(p) * 1e6) / 1e6, p[1]]).toEqual([18, 3]);
    for (const p of tier(26, 30)) expect([Math.round(rxz(p) * 1e6) / 1e6, p[1]]).toEqual([5, 6]);
    const ang = (p: Vec3) => Math.round(((Math.atan2(p[2], p[0]) * 180) / Math.PI + 360) % 360);
    expect(tier(0, 18).map(ang)).toEqual(Array.from({ length: 18 }, (_, k) => (20 * k) % 360));
    expect(tier(18, 26).map(ang)).toEqual([20, 40, 60, 80, 100, 120, 140, 160]);
    expect(tier(26, 30).map(ang)).toEqual([45, 135, 225, 315]);
    // Mỗi điểm nằm trên đúng mặt đất của tầng mình.
    for (const p of pts) expect(g(p[0], p[2])).toBe(p[1]);
  });

  it('16 điểm sinh Bóng Mực r 43 mỗi 22.5°; lịch 300 + 360k, tối đa 10, tốc độ 4.5', () => {
    expect(m3.shadeSpawns).toHaveLength(16);
    for (const p of m3.shadeSpawns) expect(rxz(p)).toBeCloseTo(43);
    expect(m3.shadeSpawns[1][0]).toBeCloseTo(43 * Math.cos(Math.PI / 8));
    expect([m3.shadeFirstTick, m3.shadeIntervalTicks, m3.shadeMax, m3.shadeSpeed]).toEqual([300, 360, 10, 4.5]);
  });
});

describe('Đêm 3 — headless (AC2-27)', () => {
  it('--night 3: snapshot tick 0 night 3, 360 s, Mây (0,0,−30), 7 đèn, 2 bùa, 20 đom đóm trên điểm Đêm 3', () => {
    const r = run({ night: 3, ticks: 0 });
    const s0 = r.snap(0);
    expect(s0).toMatchObject({ night: 3, time_left_s: 360, player: { flames: 3, pos: [0, 0, -30], grounded: true } });
    expect(s0.lanterns.map((l) => l.id)).toEqual(['L1', 'L2', 'L3', 'L4', 'L5', 'L6', 'L7']);
    expect(s0.charms).toEqual([
      { id: 'C1', available: true, respawn_s: 0 },
      { id: 'C2', available: true, respawn_s: 0 },
    ]);
    expect(s0.motes).toHaveLength(20);
    for (const m of s0.motes) {
      expect(m3.moteSpawns.some((p) => distXZ(p, m.pos) < 1e-3 && Math.abs(p[1] - m.pos[1]) < 1e-3)).toBe(true);
    }
    expect(r.allEvents[0]).toEqual({ type: 'event', tick: 0, name: 'night_start', data: { night: 3 } });
  });

  it('lịch Bóng Mực: S1, S2 ở 300, S3 ở 660, S4 ở 1020 …; tối đa 10; trên điểm r 43, cách Mây ≥ 15 m', () => {
    const r = n3(4000, r3({ random_shades: true, lanterns: [{ id: 'L6', pos: [0, 0, -30], lit: true }] }));
    const sp = r.events.filter((e) => e.name === 'shade_spawned');
    expect(sp.map((e) => e.tick)).toEqual([300, 300, 660, 1020, 1380, 1740, 2100, 2460, 2820, 3180]);
    expect(sp.map((e) => e.data.id)).toEqual(['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8', 'S9', 'S10']);
    const s300 = r.snap(300);
    for (const sh of s300.shades) {
      expect(m3.shadeSpawns.some((p) => distXZ(p, sh.pos) < 1e-3)).toBe(true);
      expect(distXZ(sh.pos, [0, 0, -30])).toBeGreaterThanOrEqual(15);
    }
    expect(r.snap(4000).shades).toHaveLength(10);
  });

  it('Bóng Mực Đêm 3 đuổi 4.5 m/s (0.075 m/tick)', () => {
    const r = n3(20, r3({ shades: [{ id: 'S1', pos: [0, 0, -40] }] }));
    expect(r.snap(20).shades[0].pos).toEqual([0, 1, -38.5]);
    expect(r.snap(20).shades[0].state).toBe('chase');
  });

  it('rơi khỏi Đêm 3 thì hồi sinh ở (0,0,−30)', () => {
    const r = n3(200, r3({ player: { pos: [0, 0, -44.5] } }), [{ tick: 0, move: [0, -1] }, { tick: 10, move: [0, 0] }]);
    const t = ticksOf(r.events, 'player_hit')[0];
    expect(r.events.find((e) => e.name === 'player_hit')!.data).toMatchObject({ by: 'fall', flames: 2 });
    expect(r.snap(t + 60).player).toMatchObject({ pos: [0, 0, -30], grounded: true, invuln: true });
  });
});

describe('Đêm 3 — di chuyển qua tầng (AC2-23, AC2-24, AC2-26)', () => {
  it('đi lên dốc 30° từ r 32 (Y 0) tới tầng 1 (Y 3), luôn bám đất, không rơi', () => {
    const [ax, az] = deg(30);
    const r = n3(120, r3({ player: { pos: [32 * ax, 0, 32 * az] } }), [{ tick: 0, move: [-ax, -az] }]);
    expect(r.snap(20).player.pos[1]).toBe(0); // r 30: chân dốc
    expect(r.snap(40).player.pos[1]).toBeCloseTo(1, 3); // r 28
    expect(r.snap(60).player.pos[1]).toBeCloseTo(2, 3); // r 26
    expect(r.snap(80).player.pos[1]).toBe(3); // r 24: đỉnh dốc
    expect(r.snap(120).player).toMatchObject({ pos: [17.321, 3, 10], grounded: true }); // r 20 trên tầng 1
    for (let t = 1; t <= 120; t++) expect(r.snap(t).player.grounded).toBe(true);
    expect(r.events).toEqual([]);
  });

  it('đi lên dốc 150° cũng được; đi xuống dốc thì bám đất về Y 0', () => {
    const [ax, az] = deg(150);
    const up = n3(90, r3({ player: { pos: [31 * ax, 0, 31 * az] } }), [{ tick: 0, move: [-ax, -az] }]);
    expect(up.snap(90).player.pos[1]).toBe(3);
    const down = n3(90, r3({ player: { pos: [22 * ax, 3, 22 * az] } }), [{ tick: 0, move: [ax, az] }]);
    expect(down.snap(90).player.pos[1]).toBe(0);
    for (let t = 1; t <= 90; t++) expect(down.snap(t).player.grounded).toBe(true);
  });

  it('bước khỏi mép z = 0 của tầng 1 thì rơi xuống tầng 0 (không mất lửa)', () => {
    const r = n3(40, r3({ player: { pos: [18, 3, 0.5] } }), [{ tick: 0, move: [0, -1] }]);
    expect(r.snap(5).player).toMatchObject({ pos: [18, 3, 0], grounded: true });
    expect(r.snap(6).player).toMatchObject({ pos: [18, 3, -0.1], grounded: false });
    expect(r.snap(40).player).toMatchObject({ pos: [18, 0, -3.5], grounded: true });
    expect(r.events).toEqual([]);
  });

  it('bước khỏi tầng 2 (r 8) rơi xuống tầng 0; bước khỏi mép ngoài tầng 1 (r 24) rơi xuống tầng 0', () => {
    const a = n3(60, r3({ player: { pos: [0, 6, -7] } }), [{ tick: 0, move: [0, -1] }]);
    expect(a.snap(60).player).toMatchObject({ pos: [0, 0, -13], grounded: true });
    const b = n3(60, r3({ player: { pos: [0, 3, 23] } }), [{ tick: 0, move: [0, 1] }]);
    expect(b.snap(60).player).toMatchObject({ pos: [0, 0, 29], grounded: true });
    expect([...a.events, ...b.events]).toEqual([]);
  });

  it('vách đứng không đi lên được: đi thẳng vào vách tầng 1 từ tầng 0 thì dừng ở mép, Y 0', () => {
    const r = n3(60, r3({ player: { pos: [0, 0, 10] } }), [{ tick: 0, move: [0, 1] }]);
    const p = r.snap(60).player;
    expect(p.pos[1]).toBe(0);
    expect(p.pos[2]).toBeCloseTo(12, 3); // snapshot làm tròn 3 chữ số
    expect(m3.groundAt(p.pos[0], p.pos[2] - 1e-3)).toBe(0);
    // Nhảy ở chân vách cũng không lên được (đỉnh nhảy 1.225 m < 3 m).
    const j = n3(60, r3({ player: { pos: [0, 0, 11.5] } }), [{ tick: 0, move: [0, 1], jump: true }]);
    for (let t = 1; t <= 60; t++) expect(j.snap(t).player.pos[2]).toBeLessThanOrEqual(12);
    expect(j.snap(60).player).toMatchObject({ grounded: true });
    expect(j.snap(60).player.pos[1]).toBe(0);
    // Tầng 1 → tầng 2 cũng là vách (3 m): từ (0,3,12) đi −Z thì rơi xuống khe r 8–12, rồi chạm vách r 8.
    const t2 = n3(120, r3({ player: { pos: [0, 0, 11] } }), [{ tick: 0, move: [0, -1] }]);
    expect(t2.snap(120).player.pos[1]).toBe(0);
    expect(t2.snap(120).player.pos[2]).toBeCloseTo(8, 6);
  });

  it('trượt theo vách: đi chéo vào vách r 12 thì bỏ thành phần đi vào vách, vẫn trượt theo mép', () => {
    const r = n3(30, r3({ player: { pos: [0, 0, 11] } }), [{ tick: 0, move: [1, 1] }]);
    const p10 = r.snap(10).player.pos;
    const p30 = r.snap(30).player.pos;
    expect(p30[1]).toBe(0);
    expect(rxz(p30)).toBeCloseTo(12, 3);
    expect(p30[0]).toBeGreaterThan(p10[0] + 1); // vẫn đi tiếp theo phương tiếp tuyến
    // Trượt dọc vách thẳng z = 0 từ nửa z < 0: thành phần +Z bị bỏ, +X giữ nguyên 4.243 m/s.
    const w = n3(60, r3({ player: { pos: [14, 0, -1] } }), [{ tick: 0, move: [1, 1] }]);
    const q = w.snap(60).player.pos;
    expect(q[1]).toBe(0);
    expect(q[2]).toBe(0);
    expect(q[0]).toBeCloseTo(14 + 60 * (6 / Math.SQRT2) / 60, 2);
  });

  it('vách bên của dốc: từ tầng 0 đi ngang vào thân dốc (chỗ cao 1.5 m) thì bị chặn', () => {
    const [ax, az] = deg(30);
    const [px, pz] = [-az, ax];
    const start: Vec3 = [27 * ax + 3 * px, 0, 27 * az + 3 * pz];
    const r = n3(60, r3({ player: { pos: start } }), [{ tick: 0, move: [-px, -pz] }]);
    const p = r.snap(60).player.pos;
    expect(p[1]).toBe(0);
    const w = -p[0] * az + p[2] * ax;
    expect(w).toBeCloseTo(1.5, 3);
  });

  it('tháp chuông chặn Mây: không vào được r < 2, trượt quanh tháp; Mây vẫn ở tầng 2', () => {
    const r = n3(120, r3({ player: { pos: [0, 6, -4] } }), [{ tick: 0, move: [0.2, 1] }]);
    let minR = Infinity;
    for (let t = 1; t <= 120; t++) {
      const p = r.snap(t).player.pos;
      minR = Math.min(minR, rxz(p));
      expect(p[1]).toBe(6);
    }
    expect(minR).toBeGreaterThanOrEqual(1.999);
    expect(r.snap(120).player.pos[2]).toBeGreaterThan(2); // đã vòng qua phía +Z của tháp
  });

  it('bục (0,3,13): vy 12, ngang 8 m/s về −Z, giữ tới khi chạm đất → đáp tầng 2 ở tick 51 (0,6,6.2)', () => {
    const r = n3(60, r3({ player: { pos: [0, 3, 13] } }), [{ tick: 0, move: [1, 0] }]);
    expect(r.snap(1).player).toMatchObject({ vel: [0, 11.667, -8], grounded: false });
    expect(r.snap(30).player.pos).toEqual([0, 6.5, 9]); // move không ghi đè vận tốc phóng
    expect(r.snap(51).player).toMatchObject({ pos: [0, 6, 6.2], grounded: true });
    expect(m3.groundAt(0, 6.2)).toBe(6);
    expect(r.events).toEqual([]);
  });
});

describe('Đêm 3 — nhặt / chạm theo tầng (AC2-23, AC2-27)', () => {
  it('không nhặt đom đóm ở tầng khác dù XZ ≤ 1 (chênh cao 3 m); cùng tầng thì nhặt', () => {
    // (Tránh bục nhảy (0,3,13).) Mây ở tầng 0 (6,0,10) r 11.66, đom đóm ở tầng 1 (6,·,10.6) r 12.18:
    // XZ 0.6 m, chênh 3 m.
    const lower = n3(5, r3({ player: { pos: [6, 0, 10] }, motes: [[6, 0, 10.6]] }));
    expect(lower.snap(0).motes[0].pos).toEqual([6, 3, 10.6]);
    expect(ticksOf(lower.events, 'mote_picked')).toEqual([]);
    // Mây ở tầng 1 không nhặt được đom đóm tầng 0 ngay dưới vách: chênh 3 m.
    const upper = n3(5, r3({ player: { pos: [6, 3, 10.6] }, motes: [[6, 0, 10]] }));
    expect(ticksOf(upper.events, 'mote_picked')).toEqual([]);
    // Cùng tầng 1: nhặt.
    const same = n3(1, r3({ player: { pos: [6, 3, 10.6] }, motes: [[6, 0, 11.2]] }));
    expect(ticksOf(same.events, 'mote_picked')).toEqual([1]);
    // Trên dốc (mặt đất Y 1.45 ở r 27.1): Mây đứng ở tầng 0 sát bên dốc, chênh 1.45 ≤ 1.5 → nhặt được.
    const [ax, az] = deg(30);
    const [px, pz] = [-az, ax];
    const mote: Vec3 = [27.1 * ax + 1.2 * px, 0, 27.1 * az + 1.2 * pz];
    const ramp = n3(1, r3({ player: { pos: [27.1 * ax + 1.6 * px, 0, 27.1 * az + 1.6 * pz] }, motes: [mote] }));
    expect(ramp.snap(0).motes[0].pos[1]).toBeCloseTo(1.45, 3);
    expect(ticksOf(ramp.events, 'mote_picked')).toEqual([1]);
  });

  it('bùa theo chênh cao mặt đất: Mây trên tầng 1 không nhặt được bùa đặt ở tầng 0 ngay dưới', () => {
    const r = n3(2, r3({ player: { pos: [6, 3, 10.6] }, charms: [{ id: 'C1', pos: [6, 0, 10] }] }));
    expect(ticksOf(r.events, 'charm_picked')).toEqual([]);
    const ok = n3(2, r3({ player: { pos: [6, 0, 9.5] }, charms: [{ id: 'C1', pos: [6, 0, 10] }] }));
    expect(ticksOf(ok.events, 'charm_picked')).toEqual([1]);
  });

  // Bản đồ chuẩn không có chỗ nào ở tầng dưới cách đèn tầng trên ≤ 2 m (L1 r 6 cách vách r 8 đúng 2 m,
  // nhưng r 8 vẫn là tầng 2), nên test dời L2 tới sát vách z = 0 bằng scenario.
  it('nạp đèn chỉ đo XZ: đứng tầng 0 sát vách vẫn nạp được đèn tầng 1 trong 2 m', () => {
    const sc = r3({ player: { pos: [18, 0, -0.5], carried: 10 }, lanterns: [{ id: 'L2', pos: [18, 3, 1] }] });
    const r = n3(2, sc, [{ tick: 0, interact: true }]);
    expect(r.events.find((e) => e.name === 'deposit')!.data).toEqual({ lantern_id: 'L2', amount: 10, deposited: 10 });
  });

  it('Bóng Mực ở tầng dưới không chạm Mây ở tầng trên; bay qua vách (Y = mặt đất + 1) thì chạm', () => {
    // Mây tầng 1 (−6,3,11) r 12.53; bóng tầng 0 (−6,·,10.1) r 11.73: XZ 0.9 m nhưng chênh 3 m.
    const r = n3(10, r3({ player: { pos: [-6, 3, 11] }, shades: [{ id: 'S1', pos: [-6, 0, 10.1] }] }));
    for (let t = 1; t <= 3; t++) {
      const sh = r.snap(t).shades[0];
      expect(sh.pos[1]).toBe(1);
      expect(distXZ(sh.pos, [-6, 3, 11])).toBeLessThanOrEqual(1);
    }
    expect(r.snap(4).shades[0].pos[1]).toBe(4); // đã bay sang trên tầng 1
    expect(ticksOf(r.events, 'player_hit')).toEqual([4]);
  });

  it('Bóng Mực bay qua vách tầng, Y theo mặt đất bên dưới (1 / 4 / 7), bị tháp chặn và trượt quanh', () => {
    // Bóng ở tầng 0 (0.3,·,−9) đuổi Mây ở (0,6,2.5) phía bên kia tháp (cách 11.5 m).
    const r = n3(300, r3({ player: { pos: [0, 6, 2.5], invuln_ticks: 1000 }, shades: [{ id: 'S1', pos: [0.3, 0, -9] }] }));
    const ys = new Set<number>();
    let minR = Infinity;
    for (let t = 1; t <= 300; t++) {
      const sh = r.snap(t).shades[0];
      ys.add(sh.pos[1]);
      minR = Math.min(minR, rxz(sh.pos));
    }
    expect([...ys].sort()).toEqual([1, 7]);
    expect(minR).toBeGreaterThanOrEqual(1.999);
    expect(distXZ(r.snap(300).shades[0].pos, [0, 6, 2.5])).toBeLessThan(0.01); // đã vòng qua tháp tới Mây
    const y4 = n3(1, r3({ shades: [{ pos: [0, 0, 18] }] })).snap(0).shades[0].pos[1];
    expect(y4).toBe(4);
  });

  it('Tỏa Sáng đẩy Bóng Mực vào tháp thì dừng ở mép tháp (vật cản)', () => {
    const r = n3(20, r3({ player: { pos: [0, 6, -6], carried: 3 }, shades: [{ id: 'S1', pos: [0, 0, -3] }] }), [
      { tick: 0, pulse: true },
    ]);
    expect(r.events[0]).toMatchObject({ name: 'pulse', data: { stunned_ids: ['S1'] } });
    const sh = r.snap(20).shades[0];
    expect(sh.state).toBe('stunned');
    expect(rxz(sh.pos)).toBeCloseTo(2, 6);
  });

  it('đom đóm rơi khi bị đánh không nằm trong tháp', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const r = n3(1, r3({ player: { pos: [0, 6, -2.2], carried: 10 }, shades: [{ id: 'S1', pos: [0, 0, -2.5] }] }), [], seed);
      const ms = r.snap(1).motes;
      expect(ms).toHaveLength(5);
      for (const m of ms) {
        expect(rxz(m.pos)).toBeGreaterThanOrEqual(1.999); // snapshot làm tròn 3 chữ số
        expect(m.pos[1]).toBe(m3.groundAt(m.pos[0], m.pos[2]));
      }
    }
  });
});

describe('Đêm 3 — gió mạnh (AC2-28)', () => {
  const still = (sc: Scenario = {}) => r3({ player: { pos: [0, 0, -30] }, ...sc });

  it('cơn k ≥ 1 thổi sim_tick [1800k, 1800k + 300); dir_deg nguyên chốt lúc báo trước (1800k − 120)', () => {
    const r = n3(3700, still());
    expect(r.snap(1679).wind).toEqual({ active: false, dir_deg: 0 });
    const d1 = r.snap(1680).wind.dir_deg;
    expect(Number.isInteger(d1)).toBe(true);
    expect(d1).toBeGreaterThanOrEqual(0);
    expect(d1).toBeLessThan(360);
    expect(r.snap(1799).wind).toEqual({ active: false, dir_deg: d1 });
    expect(r.snap(1800).wind).toEqual({ active: true, dir_deg: d1 });
    expect(r.snap(2099).wind).toEqual({ active: true, dir_deg: d1 });
    expect(r.snap(2100).wind).toEqual({ active: false, dir_deg: d1 }); // giữ hướng cơn gần nhất
    expect(r.snap(3479).wind.dir_deg).toBe(d1);
    expect(r.snap(3600).wind.active).toBe(true);
    let active = 0;
    for (let t = 1; t <= 3700; t++) if (r.snap(t).wind.active) active++;
    expect(active).toBe(300 + 101);
  });

  it('gió đẩy Mây 2 m/s theo hướng dir_deg (quy ước bản đồ, thổi TỚI): 300 tick đi đúng 10 m', () => {
    const r = n3(2100, still());
    const d = (r.snap(1800).wind.dir_deg * Math.PI) / 180;
    const v = r.snap(1800).player.vel;
    expect(v[0]).toBeCloseTo(2 * Math.cos(d), 3);
    expect(v[2]).toBeCloseTo(2 * Math.sin(d), 3);
    expect(r.snap(1799).player.pos).toEqual([0, 0, -30]);
    const p = r.snap(2100).player.pos;
    expect(p[0]).toBeCloseTo(10 * Math.cos(d), 2);
    expect(p[2]).toBeCloseTo(-30 + 10 * Math.sin(d), 2);
    expect(r.snap(2100).player.vel).toEqual([0, 0, 0]);
  });

  it('gió cộng vào vận tốc khi chạy, khi đang trên không và khi lướt', () => {
    const r = n3(1830, still(), [
      { tick: 1799, move: [0, 1] },
      { tick: 1810, jump: true },
      { tick: 1825, dash: true },
    ]);
    const d = (r.snap(1800).wind.dir_deg * Math.PI) / 180;
    const [wx, wz] = [2 * Math.cos(d), 2 * Math.sin(d)];
    const near = (v: number[], x: number, z: number) => {
      expect(v[0]).toBeCloseTo(x, 3);
      expect(v[2]).toBeCloseTo(z, 3);
    };
    near(r.snap(1805).player.vel, wx, 6 + wz);
    expect(r.snap(1815).player.grounded).toBe(false);
    near(r.snap(1815).player.vel, wx, 6 + wz);
    near(r.snap(1826).player.vel, wx, 14 + wz);
  });

  it('hướng gió theo seed (tất định, seed khác → khác)', () => {
    const dir = (seed: number) => n3(1680, still(), [], seed).snap(1680).wind.dir_deg;
    expect(dir(1)).toBe(dir(1));
    const all = new Set([1, 2, 3, 4, 5, 6, 7, 8].map(dir));
    expect(all.size).toBeGreaterThan(1);
  });

  it('wind_enabled false: không có gió; Đêm 1 / 2 cũng không có gió', () => {
    const off = n3(2100, still({ wind_enabled: false }));
    for (const t of [1680, 1800, 2000]) expect(off.snap(t).wind).toEqual({ active: false, dir_deg: 0 });
    expect(off.snap(2100).player.pos).toEqual([0, 0, -30]);
    for (const night of [1, 2]) {
      const r = run({ night, ticks: 1900, scenario: quiet({ charms: [] }) });
      expect(r.snap(1850).wind).toEqual({ active: false, dir_deg: 0 });
      expect(r.snap(1850).player.pos).toEqual([0, 0, 0]);
    }
  });

  it('tắt gió không đổi lịch sinh ngẫu nhiên (gió dùng luồng RNG riêng)', () => {
    const sc = { player: { flames: 1000 } };
    const on = n3(4000, sc);
    const off = n3(4000, { ...sc, wind_enabled: false });
    const ids = (x: typeof on) => x.events.filter((e) => e.name === 'shade_spawned').map((e) => e.tick);
    expect(ids(on)).toEqual(ids(off));
    expect(on.snap(300).shades).toEqual(off.snap(300).shades);
  });

  it('tạm dừng: lịch gió theo sim_tick nên đứng yên khi pause', () => {
    const r = n3(2000, still(), [
      { tick: 100, pause: true },
      { tick: 101, pause: false },
      { tick: 200, pause: true },
    ]);
    // Dừng ở tick 101 … 200 (100 tick): cơn 1 bắt đầu ở tick 1900 (sim_tick 1800).
    expect(r.snap(1899)).toMatchObject({ sim_tick: 1799, wind: { active: false } });
    expect(r.snap(1900)).toMatchObject({ sim_tick: 1800, wind: { active: true } });
    expect(r.snap(150)).toMatchObject({ state: 'paused' });
  });
});
