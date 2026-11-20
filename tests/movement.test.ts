import { describe, expect, it } from 'vitest';
import { quiet, run } from './helpers';

describe('Di chuyển người chơi', () => {
  it('AC1: move [0,1], yaw 0, 60 tick → (0,0,6)', () => {
    const r = run({ scenario: quiet(), frames: [{ tick: 0, move: [0, 1], cam_yaw_deg: 0 }], ticks: 60 });
    expect(r.snap(0).player.pos).toEqual([0, 0, 0]);
    expect(r.snap(1).player.pos).toEqual([0, 0, 0.1]);
    expect(r.snap(60).player.pos).toEqual([0, 0, 6]);
  });

  it('AC2: move [0,1], yaw 90, 60 tick → (6,0,0)', () => {
    const r = run({ scenario: quiet(), frames: [{ tick: 0, move: [0, 1], cam_yaw_deg: 90 }], ticks: 60 });
    expect(r.snap(60).player.pos).toEqual([6, 0, 0]);
  });

  it('AC3: move [1,1] được chuẩn hóa — 60 tick đi đúng 6 m', () => {
    const r = run({ scenario: quiet(), frames: [{ tick: 0, move: [1, 1] }], ticks: 60 });
    const [x, , z] = r.snap(60).player.pos;
    expect([x, z]).toEqual([4.243, 4.243]);
    expect(Math.hypot(x, z)).toBeCloseTo(6, 2);
  });

  it('AC3: move có độ dài < 1 không bị phóng to (move [0.5,0] → 3 m)', () => {
    const r = run({ scenario: quiet(), frames: [{ tick: 0, move: [0.5, 0] }], ticks: 60 });
    expect(r.snap(60).player.pos).toEqual([3, 0, 0]);
  });

  it('trường vắng trong frame giữ giá trị cũ', () => {
    const r = run({
      scenario: quiet(),
      frames: [
        { tick: 0, move: [0, 1], cam_yaw_deg: 90 },
        { tick: 30, jump: false },
      ],
      ticks: 60,
    });
    expect(r.snap(60).player.pos).toEqual([6, 0, 0]);
  });

  it('AC2-01: tăng tốc / dừng tức thời — vel [0,0,6] khi chạy, 0 ngay tick thả phím', () => {
    const r = run({
      scenario: quiet(),
      frames: [
        { tick: 0, move: [0, 1] },
        { tick: 30, move: [0, 0] },
      ],
      ticks: 40,
    });
    expect(r.snap(1).player.vel).toEqual([0, 0, 6]);
    expect(r.snap(30).player.pos).toEqual([0, 0, 3]);
    expect(r.snap(31).player).toMatchObject({ pos: [0, 0, 3], vel: [0, 0, 0], grounded: true });
  });

  it('AC2-02: điều khiển trên không đầy đủ — đổi hướng giữa lúc nhảy có hiệu lực ngay', () => {
    const r = run({
      scenario: quiet(),
      frames: [
        { tick: 0, move: [0, 1], jump: true },
        { tick: 10, move: [1, 0] },
      ],
      ticks: 20,
    });
    expect(r.snap(10).player.pos[2]).toBe(1);
    expect(r.snap(20).player.pos[0]).toBe(1);
    expect(r.snap(20).player.pos[2]).toBe(1);
    expect(r.snap(20).player.grounded).toBe(false);
    expect(r.snap(20).player.vel[0]).toBe(6);
  });

  // Sửa theo phase-2.md mục 2: nhảy 7 m/s (Phase 1: 6 m/s, đỉnh 0.85). y(n) = 7n/60 − 10(n/60)².
  it('AC2-03: nhảy vy 7, g 20 → đỉnh 1.225 m ở tick 21, chạm đất ở tick 42; nhảy trên không bị bỏ qua', () => {
    const r = run({
      scenario: quiet(),
      frames: [
        { tick: 0, jump: true },
        { tick: 5, jump: false },
        { tick: 10, jump: true }, // đang trên không → bỏ qua
      ],
      ticks: 60,
    });
    expect(r.snap(1).player).toMatchObject({ grounded: false, vel: [0, 6.667, 0] });
    expect(r.snap(1).player.pos[1]).toBe(0.114);
    expect(r.snap(21).player.pos[1]).toBe(1.225); // đỉnh
    expect(r.snap(41).player.pos[1]).toBe(0.114);
    expect(r.snap(42).player).toMatchObject({ pos: [0, 0, 0], grounded: true, vel: [0, 0, 0] });
    // Vẫn giữ nút jump (không có sườn mới) → không nhảy lại.
    expect(r.snap(60).player.pos).toEqual([0, 0, 0]);
  });

  // Thay theo phase-2.md mục 2: fall_enabled true — đi quá 40 m thì rơi (Phase 1 kẹp ở mép).
  it('AC2-14: bước ra khỏi mép r 40 → rơi; Y < −10 → 1 sự kiện player_hit fall có lost, mất hết đom đóm', () => {
    const r = run({
      scenario: quiet({ player: { pos: [39.95, 0, 0], carried: 7 } }),
      frames: [{ tick: 0, move: [1, 0] }],
      ticks: 250,
    });
    expect(r.snap(1).player).toMatchObject({ pos: [40.05, 0, 0], grounded: false });
    // Rơi tự do từ tick 2: sau m tick Y = −10 (m/60)² < −10 khi m = 61 → tick 62.
    expect(r.snap(61).player.pos[1]).toBe(-10);
    const hits = r.events.filter((e) => e.name === 'player_hit');
    expect(hits).toEqual([
      { type: 'event', tick: 62, name: 'player_hit', data: { by: 'fall', flames: 2, dropped: 0, lost: 7 } },
    ]);
    expect(r.snap(62).player).toMatchObject({ flames: 2, carried: 0, vel: [0, 0, 0], invuln: true });
    // Chờ 60 tick: đứng yên dù vẫn giữ move.
    expect(r.snap(121).player.pos).toEqual(r.snap(62).player.pos);
    // Hồi sinh ở điểm xuất phát tick 122, v = 0, bất tử 90 tick (hết ở tick 212).
    expect(r.snap(122).player).toMatchObject({ pos: [0, 0, 0], vel: [0, 0, 0], grounded: true, invuln: true });
    expect(r.snap(123).player.pos).toEqual([0.1, 0, 0]);
    expect(r.snap(211).player.invuln).toBe(true);
    expect(r.snap(212).player.invuln).toBe(false);
  });

  it('AC2-14: rơi bỏ qua bất tử; hết lửa → thua ngay, không hồi sinh', () => {
    const inv = run({
      scenario: quiet({ player: { pos: [39.95, 0, 0], invuln_ticks: 1000 } }),
      frames: [{ tick: 0, move: [1, 0] }],
      ticks: 70,
    });
    expect(inv.events.map((e) => [e.tick, e.name])).toEqual([[62, 'player_hit']]);

    const last = run({
      scenario: quiet({ player: { pos: [39.95, 0, 0], flames: 1 } }),
      frames: [{ tick: 0, move: [1, 0] }],
      ticks: 300,
    });
    expect(last.events.map((e) => [e.tick, e.name, e.data])).toEqual([
      [62, 'player_hit', { by: 'fall', flames: 0, dropped: 0, lost: 0 }],
      [62, 'game_over', { result: 'lost', reason: 'no_flames' }],
    ]);
    expect(last.end).toEqual({ type: 'end', ticks: 62, state: 'lost', score: 0 });
  });

  it('AC2-18: hồi sinh ở bước 3 rồi mới nhặt ở bước 4 — đom đóm ở điểm xuất phát được nhặt đúng tick hồi sinh', () => {
    const r = run({
      scenario: quiet({ player: { pos: [39.95, 0, 0] }, motes: [[0, 0, 0.5]] }),
      frames: [
        { tick: 0, move: [1, 0] },
        { tick: 62, move: [0, 0] },
      ],
      ticks: 130,
    });
    expect(r.events.map((e) => [e.tick, e.name])).toEqual([
      [62, 'player_hit'],
      [122, 'mote_picked'],
    ]);
  });
});

describe('Lướt (AC2-04)', () => {
  it('đứng yên → lướt theo hướng quay mặt (+Z lúc đầu): event dash, 12 tick × 14 m/s = 2.8 m', () => {
    const r = run({ scenario: quiet(), frames: [{ tick: 0, dash: true }], ticks: 20 });
    expect(r.events).toEqual([{ type: 'event', tick: 1, name: 'dash', data: {} }]);
    expect(r.snap(1).player).toMatchObject({ pos: [0, 0, 0.233], vel: [0, 0, 14], dash_cd_s: 1.5 });
    expect(r.snap(12).player.pos).toEqual([0, 0, 2.8]);
    expect(r.snap(13).player).toMatchObject({ pos: [0, 0, 2.8], vel: [0, 0, 0] });
  });

  it('lướt theo hướng move (thay cho tốc độ chạy trong 12 tick) rồi chạy tiếp 6 m/s', () => {
    const r = run({ scenario: quiet(), frames: [{ tick: 0, move: [1, 0], dash: true }], ticks: 22 });
    expect(r.snap(12).player.pos).toEqual([2.8, 0, 0]);
    expect(r.snap(22).player.pos).toEqual([3.8, 0, 0]);
  });

  it('hướng quay mặt = hướng di chuyển gần nhất', () => {
    const r = run({
      scenario: quiet(),
      frames: [
        { tick: 0, move: [-1, 0] },
        { tick: 10, move: [0, 0], dash: true },
      ],
      ticks: 22,
    });
    expect(r.snap(22).player.pos).toEqual([-3.8, 0, 0]);
  });

  it('hồi chiêu 90 tick tính từ lúc bắt đầu lướt; bấm khi đang lướt bị bỏ qua', () => {
    const base = quiet();
    const early = run({
      scenario: base,
      frames: [
        { tick: 0, dash: true },
        { tick: 1, dash: false },
        { tick: 5, dash: true }, // đang lướt
        { tick: 6, dash: false },
        { tick: 89, dash: true }, // còn 1 tick hồi
      ],
      ticks: 100,
    });
    expect(early.events.map((e) => [e.tick, e.name])).toEqual([[1, 'dash']]);
    const ready = run({
      scenario: base,
      frames: [
        { tick: 0, dash: true },
        { tick: 1, dash: false },
        { tick: 90, dash: true },
      ],
      ticks: 100,
    });
    expect(ready.events.map((e) => [e.tick, e.name])).toEqual([
      [1, 'dash'],
      [91, 'dash'],
    ]);
  });

  it('lướt trên không giữ nguyên độ cao (vy = 0, không trọng lực), hết lướt thì rơi tiếp', () => {
    const r = run({
      scenario: quiet(),
      frames: [
        { tick: 0, jump: true },
        { tick: 10, dash: true },
      ],
      ticks: 60,
    });
    const y10 = r.snap(10).player.pos[1];
    expect(y10).toBe(0.889);
    for (let t = 11; t <= 22; t++) {
      expect(r.snap(t).player.pos[1]).toBe(y10);
      expect(r.snap(t).player.vel[1]).toBe(0);
    }
    expect(r.snap(22).player.pos[2]).toBe(2.8);
    expect(r.snap(23).player.pos[1]).toBeLessThan(y10);
    expect(r.snap(60).player).toMatchObject({ grounded: true });
  });

  it('không bất tử khi lướt: lướt vào Bóng Mực vẫn bị đánh', () => {
    const r = run({ scenario: quiet({ shades: [{ pos: [0, 0, 2] }] }), frames: [{ tick: 0, dash: true }], ticks: 12 });
    const hit = r.events.find((e) => e.name === 'player_hit')!;
    expect(hit).toBeDefined();
    expect(hit.tick).toBeLessThanOrEqual(12);
    expect(r.snap(hit.tick - 1).player.invuln).toBe(false);
  });
});
