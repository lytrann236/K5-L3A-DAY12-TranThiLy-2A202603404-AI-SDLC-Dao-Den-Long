import { describe, expect, it } from 'vitest';
import { distXZ } from '../src/sim/geom';
import { getMap } from '../src/sim/maps';
import type { Scenario } from '../src/sim/types';
import { quiet, run, ticksOf } from './helpers';

/** Đêm 2, tắt mọi thứ ngẫu nhiên và bỏ bùa C1 để chỉ còn Gió Lạc. */
const q2 = (sc: Scenario = {}) => quiet({ charms: [], ...sc });
const r3 = (v: number) => Math.round(v * 1000) / 1000;

describe('Gió Lạc: lịch sinh (AC2-30)', () => {
  it('Đêm 2: D1 ở tick 1200, D2 ở 2400; đã có 2 con thì tick 3600 không sinh; trên điểm sương', () => {
    const r = run({ night: 2, ticks: 3600, scenario: q2({ random_drifters: true }) });
    expect(r.snap(1199).drifters).toEqual([]);
    expect(r.snap(1200).drifters.map((d) => d.id)).toEqual(['D1']);
    expect(r.snap(2399).drifters).toHaveLength(1);
    expect(r.snap(2400).drifters.map((d) => d.id)).toEqual(['D1', 'D2']);
    expect(r.snap(3600).drifters.map((d) => d.id)).toEqual(['D1', 'D2']);
    // Con mới ở idle, bay ở Y = mặt đất + 1, trên vòng r 4 m quanh một điểm sương (điểm sinh Bóng Mực).
    const d1 = r.snap(1200).drifters[0];
    expect(d1).toMatchObject({ state: 'idle', stolen: 0 });
    expect(d1.pos[1]).toBe(1);
    const near = getMap(2).shadeSpawns.map((p) => distXZ(p, d1.pos));
    expect(near.some((d) => Math.abs(d - 4) < 1e-3)).toBe(true);
  });

  it('tối đa 2 con đang tồn tại: con `removed` không tính, nên tick 3600 sinh D3', () => {
    const r = run({
      night: 2,
      ticks: 1200,
      scenario: q2({
        random_drifters: true,
        drifters: [
          { id: 'D1', pos: [-20, 0, -20] },
          { id: 'D2', pos: [-20, 0, 20], state: 'removed' },
        ],
      }),
    });
    expect(r.snap(1200).drifters.map((d) => [d.id, d.state])).toEqual([
      ['D1', 'idle'],
      ['D2', 'removed'],
      ['D3', 'idle'],
    ]);
  });

  it('Đêm 1 không có Gió Lạc; random_drifters false thì Đêm 2 cũng không sinh', () => {
    const n1 = run({ ticks: 2400 });
    expect(n1.snap(2400).drifters).toEqual([]);
    const off = run({ night: 2, ticks: 1200, scenario: { random_drifters: false } });
    expect(off.snap(1200).drifters).toEqual([]);
  });

  it('tất định theo seed: cùng seed cùng vị trí, seed khác thì khác', () => {
    const pos = (seed: number) => run({ night: 2, seed, ticks: 1200 }).snap(1200).drifters[0]?.pos;
    expect(pos(3)).toEqual(pos(3));
    const all = new Set([1, 2, 3, 4, 5, 6].map((s) => JSON.stringify(pos(s))));
    expect(all.size).toBeGreaterThan(1);
  });
});

describe('Gió Lạc: idle / chase (AC2-31)', () => {
  it('idle bay vòng r 4 m, 2 m/s, ngược chiều kim đồng hồ; vòng đi qua vị trí đặt (góc 0)', () => {
    const r = run({ night: 2, ticks: 60, scenario: q2({ drifters: [{ pos: [-10, 0, -10] }] }) });
    const c = [-14, 0, -10] as [number, number, number]; // tâm = vị trí − (4, 0, 0)
    for (const t of [1, 15, 30, 60]) expect(distXZ(r.snap(t).drifters[0].pos, c)).toBeCloseTo(4, 2);
    // 60 tick × 2 m/s = 2 m cung → góc 0.5 rad.
    expect(r.snap(60).drifters[0].pos).toEqual([r3(-14 + 4 * Math.cos(0.5)), 1, r3(-10 + 4 * Math.sin(0.5))]);
    expect(r.snap(60).drifters[0].state).toBe('idle');
  });

  it('idle → chase khi carried ≥ 5 và cách ≤ 15 m; chase 7 m/s về phía Mây', () => {
    const r = run({ night: 2, ticks: 60, scenario: q2({ player: { carried: 5 }, drifters: [{ pos: [15, 0, 0] }] }) });
    expect(r.snap(1).drifters[0]).toMatchObject({ state: 'chase', pos: [r3(15 - 7 / 60), 1, 0] });
    expect(r.snap(60).drifters[0].pos).toEqual([8, 1, 0]);
  });

  it('carried 4 hoặc cách 15.01 m thì vẫn idle', () => {
    const few = run({ night: 2, ticks: 30, scenario: q2({ player: { carried: 4 }, drifters: [{ pos: [3, 0, 0] }] }) });
    expect(few.snap(30).drifters[0].state).toBe('idle');
    expect(ticksOf(few.events, 'drifter_steal')).toEqual([]);
    const far = run({ night: 2, ticks: 1, scenario: q2({ player: { carried: 9 }, drifters: [{ pos: [15.01, 0, 0] }] }) });
    expect(far.snap(1).drifters[0].state).toBe('idle');
  });

  it('chase → idle khi mất điều kiện (Tỏa Sáng làm carried 5 → 2, Gió Lạc ngoài 5 m)', () => {
    const r = run({
      night: 2,
      ticks: 20,
      scenario: q2({ player: { carried: 5 }, drifters: [{ pos: [12, 0, 0] }] }),
      frames: [{ tick: 9, pulse: true }],
    });
    expect(r.snap(9).drifters[0].state).toBe('chase');
    expect(r.snap(10).player.carried).toBe(2);
    expect(r.snap(10).drifters[0]).toEqual({ ...r.snap(9).drifters[0], state: 'idle' }); // dừng tại chỗ
    expect(r.snap(20).drifters[0].state).toBe('idle');
    expect(distXZ(r.snap(20).drifters[0].pos, [r.snap(10).drifters[0].pos[0] - 4, 0, 0])).toBeCloseTo(4, 2);
  });
});

describe('Gió Lạc: cướp và flee (AC2-32, AC2-34)', () => {
  it('chạm XZ ≤ 1.2 → cướp min(3, carried), drifter_steal, flee 7 m/s 240 tick rồi removed cùng số đã cướp', () => {
    const r = run({ night: 2, ticks: 320, scenario: q2({ player: { carried: 7 }, drifters: [{ pos: [10, 0, 0] }] }) });
    // 10 − 76 × 7/60 = 1.133 ≤ 1.2 → cướp ở tick 76 (tick 75: 1.25 > 1.2).
    expect(r.events.filter((e) => e.name === 'drifter_steal')).toEqual([
      { type: 'event', tick: 76, name: 'drifter_steal', data: { drifter_id: 'D1', amount: 3, carried: 4 } },
    ]);
    expect(r.snap(75).drifters[0].state).toBe('chase');
    expect(r.snap(76).drifters[0]).toMatchObject({ state: 'flee', stolen: 3 });
    // Bay ra xa Mây 7 m/s: 60 tick sau xa thêm 7 m.
    expect(r.snap(136).drifters[0].pos[0]).toBeCloseTo(1.133 + 7, 2);
    // flee 240 lần bay: snapshot 76…315 là flee, 316 removed (giữ số đã cướp).
    expect(r.snap(315).drifters[0].state).toBe('flee');
    expect(r.snap(316).drifters[0]).toMatchObject({ state: 'removed', stolen: 3 });
    expect(r.snap(320).drifters[0].pos).toEqual(r.snap(316).drifters[0].pos);
    expect(r.snap(320).player).toMatchObject({ carried: 4, flames: 3 });
  });

  it('mỗi con chỉ cướp 1 lần: con đang flee chạm Mây không cướp nữa', () => {
    const r = run({
      night: 2,
      ticks: 120,
      scenario: q2({ player: { carried: 10 }, drifters: [{ pos: [0.5, 0, 0], state: 'flee', stolen: 3 }] }),
    });
    expect(ticksOf(r.events, 'drifter_steal')).toEqual([]);
    expect(r.snap(120).player.carried).toBe(10);
  });

  it('cướp min(3, carried): hai con cùng chạm, D1 cướp 3 rồi D2 cướp phần còn lại (2)', () => {
    const r = run({
      night: 2,
      ticks: 1,
      scenario: q2({
        player: { carried: 5 },
        drifters: [
          { id: 'D2', pos: [0, 0, 0.5] },
          { id: 'D1', pos: [0.5, 0, 0] },
        ],
      }),
    });
    expect(r.events.map((e) => [e.name, e.data])).toEqual([
      ['drifter_steal', { drifter_id: 'D1', amount: 3, carried: 2 }],
      ['drifter_steal', { drifter_id: 'D2', amount: 2, carried: 0 }],
    ]);
  });

  it('AC2-18: cướp TRƯỚC hit Bóng Mực cùng tick: carried 8 → cướp 3 → hit rơi floor(5/2) = 2', () => {
    const r = run({
      night: 2,
      ticks: 1,
      scenario: q2({
        player: { carried: 8 },
        drifters: [{ pos: [0.5, 0, 0] }],
        shades: [{ pos: [0, 0, 0.5] }],
      }),
    });
    expect(r.events).toEqual([
      { type: 'event', tick: 1, name: 'drifter_steal', data: { drifter_id: 'D1', amount: 3, carried: 5 } },
      { type: 'event', tick: 1, name: 'player_hit', data: { by: 'shade', flames: 2, dropped: 2 } },
    ]);
    expect(r.snap(1).player.carried).toBe(3);
  });

  it('không làm mất Ngọn Lửa; bất tử không ngăn bị cướp', () => {
    const r = run({
      night: 2,
      ticks: 5,
      scenario: q2({ player: { carried: 6, invuln_ticks: 90 }, drifters: [{ pos: [1, 0, 0] }] }),
    });
    expect(r.events.map((e) => e.name)).toEqual(['drifter_steal']);
    expect(r.snap(5).player).toMatchObject({ flames: 3, carried: 3, invuln: true });
  });

  it('vùng an toàn của đèn đã sáng không chặn Gió Lạc', () => {
    // L1 (0,0,20) đã sáng; Mây đứng ở tâm đèn, Gió Lạc ở ngoài vùng 6 m bay thẳng vào.
    const r = run({
      night: 2,
      ticks: 120,
      scenario: q2({
        player: { pos: [0, 0, 20], carried: 6 },
        lanterns: [{ id: 'L1', lit: true }],
        drifters: [{ pos: [10, 0, 20] }],
      }),
    });
    expect(ticksOf(r.events, 'drifter_steal')).toHaveLength(1);
    const st = r.events.find((e) => e.name === 'drifter_steal')!;
    expect(distXZ(r.snap(st.tick).drifters[0].pos, [0, 0, 20])).toBeLessThanOrEqual(1.2);
  });

  it('đang chờ hồi sinh sau khi rơi thì không bị cướp', () => {
    const r = run({
      night: 2,
      ticks: 70,
      // Y −9.999 ngoài đảo: tick 1 xuống dưới −10 (bước 3), nên bước 9 Mây đã đang chờ hồi sinh.
      scenario: q2({ player: { pos: [0, -9.999, 40], carried: 6 }, drifters: [{ pos: [0, 0, 41], state: 'chase' }] }),
    });
    expect(r.events.map((e) => e.name)).toEqual(['player_hit']);
    expect(r.events[0].data).toMatchObject({ by: 'fall', lost: 6 });
  });
});

describe('Gió Lạc: Tỏa Sáng (AC2-33)', () => {
  it('trúng con đang chase → flee không cướp (stolen 0), không có drifter_drop, không vào stunned_ids', () => {
    const r = run({
      night: 2,
      ticks: 250,
      scenario: q2({ player: { carried: 8 }, drifters: [{ pos: [4, 0, 0] }] }),
      frames: [{ tick: 1, pulse: true }],
    });
    expect(r.snap(1).drifters[0].state).toBe('chase');
    expect(r.events.filter((e) => e.name !== 'pulse')).toEqual([]);
    expect(r.events.find((e) => e.name === 'pulse')).toMatchObject({ tick: 2, data: { stunned_ids: [] } });
    expect(r.snap(2).drifters[0]).toMatchObject({ state: 'flee', stolen: 0 });
    expect(r.snap(2).score).toBe(0);
    // Pulse (bước 7) trước khi bay (bước 8): lần bay thứ 1 ở tick 2, thứ 240 ở tick 241 → removed.
    expect(r.snap(240).drifters[0].state).toBe('flee');
    expect(r.snap(241).drifters[0].state).toBe('removed');
    expect(r.snap(250).player.carried).toBe(5);
  });

  it('trúng con flee đang mang → drifter_drop, thả toàn bộ thành dropped tại chỗ, biến mất sau 120 tick', () => {
    const r = run({
      night: 2,
      ticks: 130,
      scenario: q2({ player: { carried: 3 }, drifters: [{ pos: [3, 0, 0], state: 'flee', stolen: 3 }] }),
      frames: [{ tick: 0, pulse: true }],
    });
    // Bước 7 (pulse) chạy trước bước 8 (Gió Lạc bay) nên vị trí thả là (3, 0, 0).
    expect(r.events.map((e) => [e.tick, e.name, e.data])).toEqual([
      [1, 'pulse', { stunned_ids: [] }],
      [1, 'drifter_drop', { drifter_id: 'D1', amount: 3 }],
    ]);
    const s1 = r.snap(1);
    expect(s1.drifters[0]).toMatchObject({ state: 'flee', stolen: 0 });
    expect(s1.motes).toEqual([
      { id: 'M1', pos: [3, 0, 0], kind: 'dropped', ttl_s: 8 },
      { id: 'M2', pos: [3, 0, 0], kind: 'dropped', ttl_s: 8 },
      { id: 'M3', pos: [3, 0, 0], kind: 'dropped', ttl_s: 8 },
    ]);
    // 120 lần bay ở tick 1…120 → removed sau lần thứ 120.
    expect(r.snap(119).drifters[0].state).toBe('flee');
    expect(r.snap(120).drifters[0]).toMatchObject({ state: 'removed', stolen: 0 });
  });

  it('trúng con flee không mang gì, hoặc con idle → không có gì xảy ra', () => {
    const r = run({
      night: 2,
      ticks: 2,
      scenario: q2({
        player: { carried: 3 },
        drifters: [
          { pos: [3, 0, 0], state: 'flee' },
          { pos: [-3, 0, 0], state: 'idle' },
        ],
      }),
      frames: [{ tick: 0, pulse: true }],
    });
    expect(r.events.map((e) => e.name)).toEqual(['pulse']);
    expect(r.snap(1).drifters.map((d) => d.state)).toEqual(['flee', 'idle']);
  });

  it('ngoài 5 m (3D từ chân + 0.8) thì không trúng', () => {
    // Gió Lạc ở Y 1, tâm pulse ở Y 0.8: XZ 4.99 → 3D 4.994 trúng; XZ 5.0 → 5.004 trượt.
    const hit = run({
      night: 2,
      ticks: 1,
      scenario: q2({ player: { carried: 3 }, drifters: [{ pos: [4.99, 0, 0], state: 'flee', stolen: 1 }] }),
      frames: [{ tick: 0, pulse: true }],
    });
    expect(ticksOf(hit.events, 'drifter_drop')).toEqual([1]);
    const miss = run({
      night: 2,
      ticks: 1,
      scenario: q2({ player: { carried: 3 }, drifters: [{ pos: [5, 0, 0], state: 'flee', stolen: 1 }] }),
      frames: [{ tick: 0, pulse: true }],
    });
    expect(ticksOf(miss.events, 'drifter_drop')).toEqual([]);
  });
});
