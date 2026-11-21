import { describe, expect, it } from 'vitest';
import { FormatError, parseScenario } from '../src/headless/parse';
import { quiet, run } from './helpers';

describe('Thời gian và kết thúc', () => {
  it('time_left_s = thời lượng − bước/60, làm tròn 3 chữ số', () => {
    // Phase 3: night1_duration_s 300 → 240 (ticket-03 mục 3).
    const r = run({ scenario: quiet(), ticks: 10 });
    expect(r.snap(0).time_left_s).toBe(240);
    expect(r.snap(1).time_left_s).toBe(239.983);
    expect(r.snap(10).time_left_s).toBe(239.833);
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

  it('time_left_s = 0 hợp lệ → thua dawn ngay ở tick 1', () => {
    const r = run({ scenario: quiet({ time_left_s: 0 }), ticks: 100 });
    expect(r.events).toEqual([
      { type: 'event', tick: 1, name: 'game_over', data: { result: 'lost', reason: 'dawn' } },
    ]);
    expect(r.end).toEqual({ type: 'end', ticks: 1, state: 'lost', score: 0 });
  });

  it('parseScenario: time_left_s = 0 hợp lệ, số âm bị từ chối', () => {
    expect(parseScenario('{"time_left_s":0}').time_left_s).toBe(0);
    expect(() => parseScenario('{"time_left_s":-1}')).toThrow(FormatError);
  });
});

// Phase 3: thay toàn bộ nhóm "thưởng thời gian khi thắng all_lit" (ticket-03 mục 3 + 5: không còn
// thắng sớm, bỏ thưởng thời gian). Ý "tính theo tick nguyên" giữ ở test dawn tick 84 bên dưới.
describe('AC3-11/14: thắng ở bình minh (dawn_survived), thưởng đèn sáng + lửa', () => {
  const lit = (ids: string[], fuel?: number) => ids.map((id) => ({ id, lit: true, ...(fuel !== undefined ? { fuel } : {}) }));

  it('Đêm 1: 3/5 đèn sáng ở tick cuối → won dawn_survived; 3 × (50 + floor(99.5)) + 50 × 3 = 597', () => {
    const r = run({ scenario: quiet({ time_left_s: 0.5, lanterns: lit(['L1', 'L2', 'L3']) }), ticks: 100 });
    expect(r.events).toEqual([
      { type: 'event', tick: 30, name: 'game_over', data: { result: 'won', reason: 'dawn_survived' } },
    ]);
    expect(r.snap(30).lanterns[0].fuel).toBe(99.5);
    expect(r.end).toEqual({ type: 'end', ticks: 30, state: 'won', score: 3 * (50 + 99) + 150 });
  });

  it('Đêm 1: 2/5 đèn sáng → lost dawn, không có thưởng', () => {
    const r = run({ scenario: quiet({ time_left_s: 0.5, lanterns: lit(['L1', 'L2']) }), ticks: 100 });
    expect(r.events.at(-1)!.data).toEqual({ result: 'lost', reason: 'dawn' });
    expect(r.end.score).toBe(0);
  });

  it('ngưỡng Đêm 2 = 4/6, Đêm 3 = 5/7', () => {
    const ids = ['L1', 'L2', 'L3', 'L4', 'L5', 'L6', 'L7'];
    for (const [night, need] of [[2, 4], [3, 5]] as const) {
      const below = run({ night, scenario: quiet({ time_left_s: 0.1, lanterns: lit(ids.slice(0, need - 1)) }), ticks: 10 });
      expect(below.end.state).toBe('lost');
      const ok = run({ night, scenario: quiet({ time_left_s: 0.1, lanterns: lit(ids.slice(0, need)) }), ticks: 10 });
      expect(ok.events.at(-1)!.data).toEqual({ result: 'won', reason: 'dawn_survived' });
    }
  });

  it('đèn tắt đúng tick bình minh không được tính (bước 2 trước bước 11)', () => {
    // L3 fuel 0.5 = 30 đơn vị → tắt ở tick 30 = tick bình minh → chỉ còn 2/5.
    const r = run({
      scenario: quiet({ time_left_s: 0.5, lanterns: [...lit(['L1', 'L2']), { id: 'L3', lit: true, fuel: 0.5 }] }),
      ticks: 100,
    });
    expect(r.events.map((e) => [e.tick, e.name])).toEqual([
      [30, 'lantern_out'],
      [30, 'game_over'],
    ]);
    expect(r.end.state).toBe('lost');
  });

  it('floor(fuel) theo đơn vị nguyên: fuel 50.3 − 0.5 = 49.8 → +49', () => {
    const r = run({ scenario: quiet({ time_left_s: 0.5, lanterns: lit(['L1', 'L2', 'L3'], 50.3) }), ticks: 100 });
    expect(r.snap(30).lanterns[0].fuel).toBe(49.8);
    expect(r.end.score).toBe(3 * (50 + 49) + 150);
  });

  it('thắp đèn thứ 3 ngay tick bình minh vẫn tính; không có thưởng thời gian', () => {
    const r = run({
      scenario: quiet({ time_left_s: 0.016, player: { carried: 10 }, lanterns: [...lit(['L1', 'L2']), { id: 'L3', pos: [0, 0, 2] }] }),
      frames: [{ tick: 0, interact: true }],
      ticks: 10,
    });
    expect(r.events.map((e) => e.name)).toEqual(['deposit', 'lantern_lit', 'game_over']);
    expect(r.events[2].data).toEqual({ result: 'won', reason: 'dawn_survived' });
    // 10 × 5 (nạp) + 100 (thắp) + L1, L2 (50 + 99) + L3 (50 + 100) + 50 × 3.
    expect(r.end).toEqual({ type: 'end', ticks: 1, state: 'won', score: 50 + 100 + 2 * 149 + 150 + 150 });
  });

  it('AC3-11: thắp đủ 5 đèn KHÔNG kết thúc Đêm', () => {
    const r = run({ scenario: quiet({ lanterns: lit(['L1', 'L2', 'L3', 'L4', 'L5']) }), ticks: 600 });
    expect(r.events).toEqual([]);
    expect(r.end.state).toBe('playing');
  });

  it('dawn đúng ở tick = round(time_left_s × 60), kể cả khi không phải bội của 1/60', () => {
    const r = run({ scenario: quiet({ time_left_s: 1.4 }), ticks: 200 });
    expect(r.events).toEqual([
      { type: 'event', tick: 84, name: 'game_over', data: { result: 'lost', reason: 'dawn' } },
    ]);
  });
});

describe('flames = 0 trong scenario', () => {
  it('hợp lệ → thua no_flames ở tick 1, không có player_hit', () => {
    const r = run({ scenario: quiet({ player: { flames: 0 } }), ticks: 100 });
    expect(r.snap(0).player.flames).toBe(0);
    expect(r.events).toEqual([
      { type: 'event', tick: 1, name: 'game_over', data: { result: 'lost', reason: 'no_flames' } },
    ]);
    expect(r.end).toEqual({ type: 'end', ticks: 1, state: 'lost', score: 0 });
  });

  it('parseScenario: flames 0 hợp lệ, flames âm hoặc không nguyên bị từ chối', () => {
    expect(parseScenario('{"player":{"flames":0}}').player?.flames).toBe(0);
    expect(() => parseScenario('{"player":{"flames":-1}}')).toThrow(FormatError);
    expect(() => parseScenario('{"player":{"flames":1.5}}')).toThrow(FormatError);
  });
});

// Phase 3: viết lại theo luật thắng bình minh (ticket-03 mục 3): không còn thắng khi thắp đèn cuối;
// "hết lửa luôn thua trước" giờ xét ở tick bình minh. Test "bóng sát Mây lúc thắp đèn cuối → thắng"
// bỏ vì không còn thắng sớm; ý "bước 6 đẩy bóng trước bước 9" vẫn được giữ ở test dưới.
describe('AC2-16 / AC3-12: thắng/thua xét cuối tick (bước 11)', () => {
  const dawnSetup = (flames: number, shades: { pos: [number, number, number] }[] = []) =>
    quiet({
      time_left_s: 0.016,
      player: { carried: 10, flames },
      shades,
      lanterns: [
        { id: 'L1', lit: true },
        { id: 'L2', lit: true },
        { id: 'L3', lit: true },
        { id: 'L4', lit: true },
        { id: 'L5', pos: [0, 0, 2] },
      ],
    });

  it('đủ đèn ở tick bình minh nhưng hết lửa → thua no_flames (hết lửa luôn thua trước)', () => {
    const r = run({ scenario: dawnSetup(0), frames: [{ tick: 0, interact: true }], ticks: 10 });
    expect(r.events.map((e) => [e.tick, e.name, e.data])).toEqual([
      [1, 'deposit', { lantern_id: 'L5', amount: 10, deposited: 10 }],
      [1, 'lantern_lit', { lantern_id: 'L5', relight: false }],
      [1, 'game_over', { result: 'lost', reason: 'no_flames' }],
    ]);
    // Không có thưởng bình minh: 10 × 5 (nạp) + 100 (thắp).
    expect(r.end).toEqual({ type: 'end', ticks: 1, state: 'lost', score: 150 });
  });

  it('bóng sát Mây lúc thắp đèn: bước 6 đẩy bóng ra trước bước 9 → không hit', () => {
    const r = run({ scenario: dawnSetup(3, [{ pos: [0.5, 0, 0] }]), frames: [{ tick: 0, interact: true }], ticks: 10 });
    expect(r.events.map((e) => e.name)).toEqual(['deposit', 'lantern_lit', 'game_over']);
    expect(r.snap(1).shades[0].pos).not.toEqual([0.5, 1, 0]); // đã bị đẩy ở bước 6
    expect(r.end.state).toBe('won');
  });
});
