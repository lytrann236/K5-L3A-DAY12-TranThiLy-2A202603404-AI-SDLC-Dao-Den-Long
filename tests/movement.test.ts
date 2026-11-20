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

  it('bị chặn ở mép đảo bán kính 40, không có sự kiện fall', () => {
    const r = run({
      scenario: quiet({ player: { pos: [39, 0, 0] } }),
      frames: [{ tick: 0, move: [1, 0] }],
      ticks: 60,
    });
    expect(r.snap(60).player.pos).toEqual([40, 0, 0]);
    expect(r.events).toEqual([]);
  });

  it('nhảy chỉ khi chạm đất, rơi về Y = 0', () => {
    const r = run({ scenario: quiet(), frames: [{ tick: 0, jump: true }], ticks: 60 });
    // Euler bán ẩn: y(n) = (6n − n(n+1)/6) / 60.
    expect(r.snap(1).player.pos[1]).toBe(0.094);
    expect(r.snap(18).player.pos[1]).toBe(0.85); // đỉnh
    expect(r.snap(34).player.pos[1]).toBe(0.094);
    expect(r.snap(35).player.pos[1]).toBe(0); // chạm đất
    // Vẫn giữ nút jump (không có sườn mới) → không nhảy lại.
    expect(r.snap(60).player.pos).toEqual([0, 0, 0]);
  });
});
