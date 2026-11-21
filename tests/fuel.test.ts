// Phase 3 — Ticket-03 "Đèn cạn dầu" (docs/notes/phase-3.md mục 4, AC3-xx).
import { describe, expect, it } from 'vitest';
import { FormatError, parseScenario } from '../src/headless/parse';
import { createGame } from '../src/sim/world';
import { hasSafeZone } from '../src/sim/fuel';
import { nearestAccepting } from '../src/sim/lanterns';
import TUNING_JSON from '../game.contract.json';
import { quiet, run, ticksOf } from './helpers';

const near = (extra: object = {}) => ({ id: 'L1', pos: [0, 0, 1] as [number, number, number], ...extra });

describe('AC3-15: contract v1.2', () => {
  it('khóa mới và thời lượng 240/270/300', () => {
    expect(TUNING_JSON.contract_version).toBe('1.3'); // Phase 4 nâng 1.2 → 1.3, tuning giữ nguyên
    expect(TUNING_JSON.tuning).toMatchObject({
      fuel_max: 100,
      fuel_decay_per_s: 1,
      fuel_per_mote: 10,
      relight_cost: 5,
      win_ratio: 0.6,
      drain_per_s: 5,
      low_fuel_threshold: 30,
      capacity_max: 20,
      night1_duration_s: 240,
      night2_duration_s: 270,
      night3_duration_s: 300,
    });
  });
});

describe('AC3-01/04: hao dầu và tắt', () => {
  it('đèn sáng hao 1/s: 60 tick −1.0; fuel xuất 1 chữ số thập phân', () => {
    const r = run({ scenario: quiet({ lanterns: [{ id: 'L1', lit: true }] }), ticks: 60 });
    expect(r.snap(0).lanterns[0].fuel).toBe(100);
    expect(r.snap(3).lanterns[0].fuel).toBe(100); // 99.95 → 100.0
    expect(r.snap(6).lanterns[0].fuel).toBe(99.9);
    expect(r.snap(60).lanterns[0].fuel).toBe(99);
    expect(r.snap(60).lanterns[1].fuel).toBe(0); // đèn tắt
  });

  it('fuel ≤ 0 → tắt ngay sau bước 2: lantern_out, deposited 0, ever_lit true', () => {
    const r = run({ scenario: quiet({ lanterns: [{ id: 'L1', lit: true, fuel: 1 }] }), ticks: 70 });
    expect(r.events).toEqual([{ type: 'event', tick: 60, name: 'lantern_out', data: { lantern_id: 'L1' } }]);
    expect(r.snap(59).lanterns[0]).toMatchObject({ lit: true, fuel: 0 }); // 1/60 → làm tròn 0.0 nhưng vẫn sáng
    expect(r.snap(60).lanterns[0]).toMatchObject({ lit: false, deposited: 0, fuel: 0, ever_lit: true, relit_count: 0 });
  });
});

describe('AC3-02/03: châm dầu', () => {
  it('used = min(carried, ceil((100 − fuel)/10)); fuel = min(100, fuel + 10·used); +5/đom đóm', () => {
    // fuel 41 − 1/60 ở bước 2 → thiếu 59.0167 → ceil 6 → fuel 100, dùng 6.
    const r = run({
      scenario: quiet({ player: { carried: 9 }, lanterns: [near({ lit: true, fuel: 41 })] }),
      frames: [{ tick: 0, interact: true }],
      ticks: 1,
    });
    expect(r.events).toEqual([
      { type: 'event', tick: 1, name: 'refuel', data: { lantern_id: 'L1', amount: 6, fuel: 100 } },
    ]);
    expect(r.snap(1).player.carried).toBe(3);
    expect(r.snap(1).score).toBe(30);
  });

  it('mang ít hơn cần: dùng hết, fuel + 10 mỗi con', () => {
    const r = run({
      scenario: quiet({ player: { carried: 2 }, lanterns: [near({ lit: true, fuel: 20 })] }),
      frames: [{ tick: 0, interact: true }],
      ticks: 1,
    });
    expect(r.events[0].data).toEqual({ lantern_id: 'L1', amount: 2, fuel: 40 }); // 19.983 + 20 = 39.983 → 40.0
    expect(r.snap(1).player.carried).toBe(0);
  });

  it('không có đom đóm → không sự kiện', () => {
    const r = run({
      scenario: quiet({ player: { carried: 0 }, lanterns: [near({ lit: true, fuel: 20 })] }),
      frames: [{ tick: 0, interact: true }],
      ticks: 1,
    });
    expect(r.events).toEqual([]);
  });

  it('đèn đầy dầu không được chọn: L1 vừa thắp (100) ở gần, L2 tắt xa hơn → lần bấm tiếp theo cùng tick không có', () => {
    // Đèn chỉ đầy ở đúng tick vừa thắp (bước 2 của tick sau đã hao). Kiểm trực tiếp hàm chọn:
    const g = createGame(1, quiet({ player: { carried: 5 }, lanterns: [near({ lit: true }), { id: 'L2', pos: [0, 0, 1.5] }] }));
    expect(nearestAccepting(g)?.id).toBe('L2');
    g.lanterns[0].fuelU -= 1;
    expect(nearestAccepting(g)?.id).toBe('L1');
    g.lanterns[1].lit = true;
    g.lanterns[1].fuelU = 6000;
    g.lanterns[0].fuelU = 6000;
    expect(nearestAccepting(g)).toBeNull();
  });
});

describe('AC3-05: thắp lại', () => {
  it('đèn ever_lit cần 5: lantern_lit relight true, relit_count 1, +5×5 +40, fuel 100', () => {
    const r = run({
      scenario: quiet({ player: { carried: 7 }, lanterns: [near({ ever_lit: true })] }),
      frames: [{ tick: 0, interact: true }],
      ticks: 1,
    });
    expect(r.events.map((e) => [e.name, e.data])).toEqual([
      ['deposit', { lantern_id: 'L1', amount: 5, deposited: 5 }],
      ['lantern_lit', { lantern_id: 'L1', relight: true }],
    ]);
    expect(r.snap(1).lanterns[0]).toMatchObject({ lit: true, fuel: 100, ever_lit: true, relit_count: 1, deposited: 5 });
    expect(r.snap(1).player).toMatchObject({ carried: 2, capacity: 12 });
    expect(r.snap(1).score).toBe(25 + 40);
  });

  it('tắt rồi thắp lại trong cùng một lần chạy', () => {
    const r = run({
      scenario: quiet({ player: { carried: 5 }, lanterns: [near({ lit: true, fuel: 0.5 })] }),
      frames: [
        { tick: 40, interact: true },
      ],
      ticks: 42,
    });
    expect(ticksOf(r.events, 'lantern_out')).toEqual([30]);
    expect(r.events.find((e) => e.name === 'lantern_lit')).toMatchObject({ tick: 41, data: { relight: true } });
  });
});

describe('AC3-06: vùng an toàn chỉ khi fuel ≥ 30', () => {
  it('đúng 30 còn vùng; 29.99 mất', () => {
    const g = createGame(1, quiet({ lanterns: [{ id: 'L1', lit: true, fuel: 30 }, { id: 'L2', lit: true, fuel: 29.99 }] }));
    expect(hasSafeZone(g.lanterns[0])).toBe(true);
    expect(hasSafeZone(g.lanterns[1])).toBe(false);
  });

  it('đèn fuel < 30 không chặn Bóng Mực: bóng đuổi Mây vào trong r 6 và gây hit', () => {
    const r = run({
      scenario: quiet({ lanterns: [{ id: 'L1', pos: [0, 0, 0], lit: true, fuel: 20 }], shades: [{ pos: [0, 0, 8] }] }),
      ticks: 200,
    });
    expect(ticksOf(r.events, 'player_hit').length).toBeGreaterThan(0);
  });

  it('đèn fuel 100 chặn bóng ở mép 6 m', () => {
    const r = run({
      scenario: quiet({ lanterns: [{ id: 'L1', pos: [0, 0, 0], lit: true }], shades: [{ pos: [0, 0, 8] }] }),
      ticks: 200,
    });
    expect(ticksOf(r.events, 'player_hit')).toEqual([]);
    expect(r.snap(200).shades[0].pos).toEqual([0, 1, 6]);
  });
});

describe('AC3-07: wander chọn mục tiêu', () => {
  // Mây ở xa (> 12 m) để bóng không đuổi.
  const far = { pos: [0, 0, -30] as [number, number, number] };

  it('đi tới đèn sáng fuel < 30 gần nhất (bỏ qua đèn tắt gần hơn), dừng 2 m rồi drain', () => {
    const r = run({
      scenario: quiet({
        player: far,
        lanterns: [
          { id: 'L1', pos: [10, 0, 0], lit: true, fuel: 25 },
          { id: 'L2', pos: [-3, 0, 0] },
          { id: 'L3', lit: true },
          { id: 'L4', lit: true },
          { id: 'L5', lit: true },
        ],
        shades: [{ pos: [0, 0, 0] }],
      }),
      ticks: 200,
    });
    expect(r.snap(1).shades[0].pos).toEqual([0.067, 1, 0]); // 4 m/s → +X
    const t = r.lines.find((l) => l.type === 'snapshot' && l.shades[0]?.state === 'drain').tick;
    expect(r.snap(t).shades[0].pos).toEqual([8, 1, 0]);
    expect(t).toBe(120); // 8 m / (4/60)
  });

  it('không có đèn yếu → đi về đèn tắt gần nhất, dừng cách 2 m, giữ wander', () => {
    const r = run({
      scenario: quiet({
        player: far,
        lanterns: [{ id: 'L1', pos: [5, 0, 0] }, { id: 'L2', pos: [-6, 0, 0] }, { id: 'L3', lit: true }],
        shades: [{ pos: [0, 0, 0] }],
      }),
      ticks: 120,
    });
    expect(r.snap(120).shades[0]).toEqual({ id: 'S1', pos: [3, 1, 0], state: 'wander' });
  });

  it('đèn yếu bằng khoảng cách → id nhỏ hơn', () => {
    const r = run({
      scenario: quiet({
        player: far,
        lanterns: [
          { id: 'L1', pos: [-5, 0, 0], lit: true, fuel: 20 },
          { id: 'L2', pos: [5, 0, 0], lit: true, fuel: 20 },
        ],
        shades: [{ pos: [0, 0, 0] }],
      }),
      ticks: 1,
    });
    expect(r.snap(1).shades[0].pos).toEqual([-0.067, 1, 0]);
  });

  it('bóng đang chase không đổi mục tiêu', () => {
    const r = run({
      scenario: quiet({
        player: { pos: [0, 0, 5] },
        lanterns: [{ id: 'L1', pos: [-8, 0, 0], lit: true, fuel: 20 }],
        shades: [{ pos: [0, 0, 0] }],
      }),
      ticks: 5,
    });
    expect(r.snap(5).shades[0].state).toBe('chase');
    expect(r.snap(5).shades[0].pos[0]).toBe(0);
  });
});

describe('AC3-08: drain', () => {
  const drainSc = (extra: object = {}) =>
    quiet({
      player: { pos: [0, 0, -30] },
      lanterns: [{ id: 'L1', pos: [0, 0, 0], lit: true, fuel: 20 }],
      shades: [{ id: 'S1', pos: [2, 0, 0], state: 'drain', target_lantern_id: 'L1' }],
      ...extra,
    });

  it('hút 5/s + hao 1/s = 6/s; fuel_drain mỗi 60 tick; bóng đứng yên', () => {
    const r = run({ scenario: drainSc(), ticks: 125 });
    expect(r.snap(60).lanterns[0].fuel).toBe(14);
    expect(r.events.filter((e) => e.name === 'fuel_drain')).toEqual([
      { type: 'event', tick: 60, name: 'fuel_drain', data: { lantern_id: 'L1', shade_id: 'S1', fuel: 14 } },
      { type: 'event', tick: 120, name: 'fuel_drain', data: { lantern_id: 'L1', shade_id: 'S1', fuel: 8 } },
    ]);
    expect(r.snap(125).shades[0]).toEqual({ id: 'S1', pos: [2, 1, 0], state: 'drain' });
  });

  it('nhiều con cộng dồn: 2 con → 11/s; đèn tắt ở tick 110 → cả hai về wander', () => {
    const r = run({
      scenario: drainSc({
        shades: [
          { id: 'S1', pos: [2, 0, 0], state: 'drain', target_lantern_id: 'L1' },
          { id: 'S2', pos: [-2, 0, 0], state: 'drain', target_lantern_id: 'L1' },
        ],
      }),
      ticks: 115,
    });
    // 20 fuel = 1200 đơn vị, 11 đơn vị/tick → tick 110 (1210 ≥ 1200).
    expect(ticksOf(r.events, 'lantern_out')).toEqual([110]);
    expect(r.snap(110).shades.map((s) => s.state)).toEqual(['wander', 'wander']);
    expect(r.events.filter((e) => e.name === 'fuel_drain').map((e) => e.data.fuel)).toEqual([9, 9]);
  });

  it('scenario: drain thiếu target_lantern_id → đèn gần nhất', () => {
    const r = run({ scenario: drainSc({ shades: [{ pos: [2, 0, 0], state: 'drain' }] }), ticks: 60 });
    expect(r.snap(60).lanterns[0].fuel).toBe(14);
  });
});

describe('AC3-09: rời drain', () => {
  const base = (playerPos: [number, number, number], extra: object = {}) =>
    quiet({
      player: { pos: playerPos, carried: 10 },
      lanterns: [{ id: 'L1', pos: [0, 0, 0], lit: true, fuel: 20 }],
      shades: [{ id: 'S1', pos: [2, 0, 0], state: 'drain', target_lantern_id: 'L1' }],
      ...extra,
    });

  it('Mây trong 6 m → chase', () => {
    const r = run({ scenario: base([8, 0, 0]), ticks: 1 });
    expect(r.snap(1).shades[0].state).toBe('chase');
    const r2 = run({ scenario: base([8.1, 0, 0]), ticks: 1 });
    expect(r2.snap(1).shades[0].state).toBe('drain');
  });

  it('Tỏa Sáng trúng bóng drain → stunned, +15; hết choáng → wander', () => {
    const r = run({ scenario: base([0, 0, -1]), frames: [{ tick: 0, pulse: true }], ticks: 125 });
    expect(r.events[0]).toMatchObject({ tick: 1, name: 'pulse', data: { stunned_ids: ['S1'] } });
    expect(r.snap(1).score).toBe(15);
    expect(r.snap(1).shades[0].state).toBe('stunned');
    expect(r.snap(121).shades[0].state).not.toBe('stunned');
  });

  it('cách đèn > 2 m → wander', () => {
    const r = run({ scenario: base([0, 0, -30], { shades: [{ id: 'S1', pos: [2.5, 0, 0], state: 'drain', target_lantern_id: 'L1' }] }), ticks: 1 });
    expect(r.snap(1).shades[0].state).toBe('wander');
  });

  it('AC3-10: châm lên ≥ 30 → wander + bị đẩy ra mép 6 m trong 30 tick, không gây hit', () => {
    const r = run({
      scenario: base([0, 0, 1.5], { shades: [{ id: 'S1', pos: [0, 0, 2], state: 'drain', target_lantern_id: 'L1' }] }),
      frames: [{ tick: 0, interact: true }],
      ticks: 31,
    });
    expect(r.events[0]).toMatchObject({ tick: 1, name: 'refuel', data: { lantern_id: 'L1', amount: 9, fuel: 100 } });
    expect(r.snap(1).shades[0].state).toBe('wander');
    expect(r.snap(30).shades[0].pos).toEqual([0, 1, 6]);
    expect(ticksOf(r.events, 'player_hit')).toEqual([]);
  });

  it('châm mà vẫn < 30 (20 − 6/60 + 10 = 29.9) → chưa có vùng an toàn: không bị đẩy, bóng đuổi và gây hit', () => {
    const r = run({
      scenario: base([0, 0, 1.5], {
        player: { pos: [0, 0, 1.5], carried: 1 },
        shades: [{ id: 'S1', pos: [0, 0, 2], state: 'drain', target_lantern_id: 'L1' }],
      }),
      frames: [{ tick: 0, interact: true }],
      ticks: 1,
    });
    expect(r.events[0]).toMatchObject({ name: 'refuel', data: { amount: 1, fuel: 29.9 } }); // bước 2 đã hao 1 + hút 5 đơn vị
    expect(r.events.map((e) => e.name)).toEqual(['refuel', 'player_hit']);
    expect(r.snap(1).shades[0].state).toBe('recoil');
  });
});

describe('AC3-13: sức chứa tăng dần', () => {
  it('10 + 2 × successful_lights, tối đa 20; scenario successful_lights', () => {
    const cap = (n: number) => run({ scenario: quiet({ player: { successful_lights: n } }), ticks: 0 }).snap(0).player.capacity;
    expect([cap(0), cap(1), cap(4), cap(5), cap(9)]).toEqual([10, 12, 18, 20, 20]);
  });

  it('đèn đặt sẵn không tính; nhặt tới sức chứa mới', () => {
    const r = run({
      scenario: quiet({
        player: { carried: 11, successful_lights: 1 },
        lanterns: [{ id: 'L1', lit: true }],
        motes: [[0, 0, 0.5], [0, 0, 0.6]],
      }),
      ticks: 1,
    });
    expect(r.snap(1).player).toMatchObject({ carried: 12, capacity: 12 });
    expect(r.snap(1).motes_active).toBe(1);
  });

  it('thắp thành công → capacity +2', () => {
    const r = run({
      scenario: quiet({ player: { pos: [0, 0, 24], carried: 10 } }),
      frames: [{ tick: 0, interact: true }],
      ticks: 1,
    });
    expect(r.snap(1).player.capacity).toBe(12);
  });
});

describe('AC3-16: scenario v1.2', () => {
  it('fuel ngoài [0, 100], ever_lit không boolean, target_lantern_id sai → FormatError', () => {
    expect(() => parseScenario('{"lanterns":[{"id":"L1","fuel":101}]}')).toThrow(FormatError);
    expect(() => parseScenario('{"lanterns":[{"id":"L1","ever_lit":1}]}')).toThrow(FormatError);
    expect(() => parseScenario('{"shades":[{"pos":[0,0,0],"state":"drain","target_lantern_id":"L9"}]}')).toThrow(FormatError);
    expect(() => parseScenario('{"player":{"successful_lights":-1}}')).toThrow(FormatError);
    expect(parseScenario('{"shades":[{"pos":[0,0,0],"state":"drain"}]}').shades?.[0].state).toBe('drain');
  });

  it('đèn lit thiếu fuel → 100; đèn tắt có fuel bị bỏ qua (0)', () => {
    const r = run({ scenario: quiet({ lanterns: [{ id: 'L1', lit: true }, { id: 'L2', fuel: 50 }] }), ticks: 0 });
    expect(r.snap(0).lanterns[0]).toMatchObject({ fuel: 100, ever_lit: true, relit_count: 0 });
    expect(r.snap(0).lanterns[1]).toMatchObject({ lit: false, fuel: 0, ever_lit: false });
  });
});

describe('AC3-17: tất định', () => {
  it('cùng seed → giống hệt (random bật, 4000 tick, có drain)', () => {
    const a = run({ ticks: 4000, seed: 7 }).lines;
    const b = run({ ticks: 4000, seed: 7 }).lines;
    expect(a).toEqual(b);
  });
});
