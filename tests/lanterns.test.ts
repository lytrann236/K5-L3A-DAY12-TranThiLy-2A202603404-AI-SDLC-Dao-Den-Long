import { describe, expect, it } from 'vitest';
import { quiet, run } from './helpers';

describe('Đèn', () => {
  it('vị trí mặc định: L1 tại (0,0,22), 5 đèn trên vòng 22 m', () => {
    const r = run({ scenario: quiet(), ticks: 0 });
    const ls = r.snap(0).lanterns;
    expect(ls.map((l) => l.id)).toEqual(['L1', 'L2', 'L3', 'L4', 'L5']);
    expect(ls[0].pos).toEqual([0, 0, 22]);
    expect(ls[1].pos).toEqual([-20.923, 0, 6.798]);
    for (const l of ls) expect(Math.hypot(l.pos[0], l.pos[2])).toBeCloseTo(22, 2);
  });

  it('AC6: carried 5 cạnh L1, interact → deposit 5 + lantern_lit + 100 điểm', () => {
    const r = run({
      scenario: quiet({ player: { pos: [0, 0, 20], carried: 5 } }),
      frames: [{ tick: 0, interact: true }],
      ticks: 3,
    });
    expect(r.events).toEqual([
      { type: 'event', tick: 1, name: 'deposit', data: { lantern_id: 'L1', amount: 5, deposited: 5 } },
      { type: 'event', tick: 1, name: 'lantern_lit', data: { lantern_id: 'L1' } },
    ]);
    expect(r.snap(1).score).toBe(100);
    expect(r.snap(1).player.carried).toBe(0);
    expect(r.snap(1).lanterns[0]).toMatchObject({ id: 'L1', lit: true, deposited: 5 });
  });

  it('nạp một phần, không cộng điểm; giữ nút không nạp lại; ngoài 3 m không nạp', () => {
    const r = run({
      scenario: quiet({ player: { pos: [0, 0, 20], carried: 3 } }),
      frames: [
        { tick: 0, interact: true },
        { tick: 5, move: [0, -1] },
        { tick: 6, move: [0, 0], interact: false },
        { tick: 7, interact: true },
      ],
      ticks: 10,
    });
    // Sau tick 6 người chơi ở z = 19.9 → cách L1 2.1 m (vẫn trong tầm) nhưng carried = 0.
    expect(r.events).toEqual([
      { type: 'event', tick: 1, name: 'deposit', data: { lantern_id: 'L1', amount: 3, deposited: 3 } },
    ]);
    expect(r.snap(10).score).toBe(0);
    expect(r.snap(10).lanterns[0]).toMatchObject({ lit: false, deposited: 3 });

    const far = run({
      scenario: quiet({ player: { pos: [0, 0, 18.9], carried: 5 } }),
      frames: [{ tick: 0, interact: true }],
      ticks: 2,
    });
    expect(far.events).toEqual([]);
  });

  it('AC7: thắp đủ 5 đèn → game_over won all_lit + thưởng thời gian và flames', () => {
    const r = run({
      scenario: quiet({
        player: { carried: 5 },
        lanterns: [
          { id: 'L1', lit: true },
          { id: 'L2', lit: true },
          { id: 'L3', lit: true },
          { id: 'L4', lit: true },
          { id: 'L5', pos: [0, 0, 2] },
        ],
      }),
      frames: [{ tick: 0, interact: true }],
      ticks: 100,
    });
    expect(r.snap(0).score).toBe(0); // đèn đặt sẵn không được cộng điểm
    expect(r.events).toEqual([
      { type: 'event', tick: 1, name: 'deposit', data: { lantern_id: 'L5', amount: 5, deposited: 5 } },
      { type: 'event', tick: 1, name: 'lantern_lit', data: { lantern_id: 'L5' } },
      { type: 'event', tick: 1, name: 'game_over', data: { result: 'won', reason: 'all_lit' } },
    ]);
    // 100 (thắp L5) + 2 × floor(300 − 1/60 = 299.983) + 50 × 3 flames = 100 + 598 + 150.
    expect(r.end).toEqual({ type: 'end', ticks: 1, state: 'won', score: 848 });
    expect(r.snap(1).state).toBe('won');
    expect(r.lines.at(-1)).toEqual(r.end);
  });
});
