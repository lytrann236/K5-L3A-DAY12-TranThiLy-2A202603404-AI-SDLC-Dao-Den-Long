import { describe, expect, it } from 'vitest';
import { quiet, run, ticksOf } from './helpers';

// AC2-19: tạm dừng — tick tăng, sim_tick / thời gian / hồi chiêu / spawn / TTL đứng yên.
describe('Tạm dừng (AC2-19)', () => {
  const pauseAt = (on: number, off: number) => [
    { tick: on, pause: true },
    { tick: on + 1, pause: false },
    { tick: off, pause: true },
    { tick: off + 1, pause: false },
  ];

  it('tick bật pause: ghi paused, không chạy gameplay; tick bỏ pause: ghi resumed rồi chạy bước 2–12', () => {
    const r = run({
      scenario: quiet(),
      frames: [{ tick: 0, move: [0, 1] }, ...pauseAt(10, 20)],
      ticks: 30,
    });
    expect(r.events).toEqual([
      { type: 'event', tick: 11, name: 'paused', data: {} },
      { type: 'event', tick: 21, name: 'resumed', data: {} },
    ]);
    expect(r.snap(10)).toMatchObject({ tick: 10, sim_tick: 10, state: 'playing' });
    expect(r.snap(11)).toMatchObject({ tick: 11, sim_tick: 10, state: 'paused', time_left_s: 299.833 });
    expect(r.snap(11).player.pos).toEqual([0, 0, 1]);
    expect(r.snap(20)).toMatchObject({ tick: 20, sim_tick: 10, state: 'paused' });
    expect(r.snap(20).player.pos).toEqual([0, 0, 1]);
    expect(r.snap(21)).toMatchObject({ tick: 21, sim_tick: 11, state: 'playing' });
    expect(r.snap(21).player.pos).toEqual([0, 0, 1.1]);
    expect(r.end).toEqual({ type: 'end', ticks: 30, state: 'playing', score: 0 });
    expect(r.snap(30).sim_tick).toBe(20);
  });

  it('hồi chiêu và hết giờ đứng yên khi tạm dừng', () => {
    const r = run({
      scenario: quiet({ time_left_s: 0.1, player: { pulse_cd_ticks: 3 } }),
      frames: pauseAt(0, 100),
      ticks: 200,
    });
    expect(r.snap(50)).toMatchObject({ state: 'paused', sim_tick: 0, time_left_s: 0.1 });
    expect(r.snap(50).player.pulse_cd_s).toBe(0.05);
    // 6 tick gameplay (0.1 s): tick 101 là tick gameplay 1 → dawn ở tick 106.
    expect(r.events.map((e) => [e.tick, e.name])).toEqual([
      [1, 'paused'],
      [101, 'resumed'],
      [106, 'game_over'],
    ]);
  });

  it('lịch sinh đom đóm theo sim_tick: pause 50 tick đầu → con thứ 21 sinh ở tick 290', () => {
    const r = run({ scenario: { random_shades: false }, frames: pauseAt(0, 50), ticks: 300, seed: 3 });
    expect(r.snap(289).motes_active).toBe(20);
    expect(r.snap(290)).toMatchObject({ sim_tick: 240, motes_active: 21 });
  });

  it('khi tạm dừng nút khác chỉ ghi nhận trạng thái: giữ pulse qua lúc bỏ pause không kích hoạt', () => {
    const held = run({
      scenario: quiet({ player: { carried: 6 } }),
      frames: [
        { tick: 0, pause: true },
        { tick: 1, pause: false },
        { tick: 5, pulse: true }, // bấm lúc đang dừng → không có tác dụng
        { tick: 10, pause: true }, // bỏ pause, pulse vẫn giữ → không có sườn mới
      ],
      ticks: 20,
    });
    expect(ticksOf(held.events, 'pulse')).toEqual([]);
    expect(held.snap(20).player.carried).toBe(6);

    // Bấm pulse đúng tick bỏ pause → có tác dụng ngay ở tick đó.
    const same = run({
      scenario: quiet({ player: { carried: 6 } }),
      frames: [
        { tick: 0, pause: true },
        { tick: 1, pause: false },
        { tick: 10, pause: true, pulse: true },
      ],
      ticks: 20,
    });
    expect(same.events.map((e) => [e.tick, e.name])).toEqual([
      [1, 'paused'],
      [11, 'resumed'],
      [11, 'pulse'],
    ]);
  });

  it('chạy hết --ticks khi đang tạm dừng: dòng end có state "paused"', () => {
    const r = run({ scenario: quiet(), frames: [{ tick: 3, pause: true }], ticks: 10 });
    expect(r.end).toEqual({ type: 'end', ticks: 10, state: 'paused', score: 0 });
    expect(r.snap(10).sim_tick).toBe(3);
  });
});
