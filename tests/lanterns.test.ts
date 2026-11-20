import { describe, expect, it } from 'vitest';
import { quiet, run } from './helpers';

describe('Đèn (AC2-07, AC2-17, AC2-20)', () => {
  // Sửa theo phase-2.md mục 2: vị trí vòng 22 m của Phase 1 → 5 tọa độ chuẩn ticket-02 Phần 2.
  it('vị trí mặc định Đêm 1: L1 (0,0,25) · L2 (23.8,0,7.7) · L3 (14.7,0,−20.2) · L4 (−14.7,0,−20.2) · L5 (−23.8,0,7.7)', () => {
    const r = run({ scenario: quiet(), ticks: 0 });
    expect(r.snap(0).lanterns).toEqual([
      { id: 'L1', pos: [0, 0, 25], lit: false, deposited: 0 },
      { id: 'L2', pos: [23.8, 0, 7.7], lit: false, deposited: 0 },
      { id: 'L3', pos: [14.7, 0, -20.2], lit: false, deposited: 0 },
      { id: 'L4', pos: [-14.7, 0, -20.2], lit: false, deposited: 0 },
      { id: 'L5', pos: [-23.8, 0, 7.7], lit: false, deposited: 0 },
    ]);
  });

  // Sửa theo phase-2.md mục 2: lantern_cost 10 và "+10 mỗi đom đóm nạp" → 10 × 10 + 100 = 200.
  it('AC6: carried 10 cạnh L1, interact → deposit 10 + lantern_lit, điểm 100 + 10 × 10 = 200', () => {
    const r = run({
      scenario: quiet({ player: { pos: [0, 0, 24], carried: 10 } }),
      frames: [{ tick: 0, interact: true }],
      ticks: 3,
    });
    expect(r.events).toEqual([
      { type: 'event', tick: 1, name: 'deposit', data: { lantern_id: 'L1', amount: 10, deposited: 10 } },
      { type: 'event', tick: 1, name: 'lantern_lit', data: { lantern_id: 'L1' } },
    ]);
    expect(r.snap(1).score).toBe(200);
    expect(r.snap(1).player.carried).toBe(0);
    expect(r.snap(1).lanterns[0]).toMatchObject({ id: 'L1', lit: true, deposited: 10 });
  });

  // Sửa theo phase-2.md mục 2: nạp một phần CÓ cộng 10/đom đóm; biên 2 m thay cho 3 m.
  it('nạp một phần cộng 10/đom đóm, đèn nhớ tiến độ; giữ nút không nạp lại', () => {
    const r = run({
      scenario: quiet({ player: { pos: [0, 0, 24], carried: 3 } }),
      frames: [{ tick: 0, interact: true }],
      ticks: 10,
    });
    expect(r.events).toEqual([
      { type: 'event', tick: 1, name: 'deposit', data: { lantern_id: 'L1', amount: 3, deposited: 3 } },
    ]);
    expect(r.snap(10).score).toBe(30);
    expect(r.snap(10).lanterns[0]).toMatchObject({ lit: false, deposited: 3 });
  });

  it('mỗi lần bấm nạp min(carried, còn thiếu): deposited 7 + carried 5 → nạp 3, còn mang 2, thắp', () => {
    const r = run({
      scenario: quiet({ player: { pos: [0, 0, 24], carried: 5 }, lanterns: [{ id: 'L1', deposited: 7 }] }),
      frames: [{ tick: 0, interact: true }],
      ticks: 1,
    });
    expect(r.events.map((e) => [e.name, e.data])).toEqual([
      ['deposit', { lantern_id: 'L1', amount: 3, deposited: 10 }],
      ['lantern_lit', { lantern_id: 'L1' }],
    ]);
    expect(r.snap(1).player.carried).toBe(2);
    expect(r.snap(1).score).toBe(30 + 100);
  });

  it('bán kính 2.0 m (XZ): đúng 2 m thì nạp, 2.01 m thì không', () => {
    const at = (z: number) =>
      run({
        scenario: quiet({ player: { pos: [0, 0, z], carried: 1 } }),
        frames: [{ tick: 0, interact: true }],
        ticks: 1,
      }).events.map((e) => e.name);
    expect(at(23)).toEqual(['deposit']);
    expect(at(22.99)).toEqual([]);
  });

  it('chỉ xét đèn chưa sáng; gần nhất, bằng nhau thì id nhỏ hơn', () => {
    const tie = run({
      scenario: quiet({
        player: { carried: 2 },
        lanterns: [
          { id: 'L2', pos: [0, 0, 1] },
          { id: 'L1', pos: [0, 0, -1] },
        ],
      }),
      frames: [{ tick: 0, interact: true }],
      ticks: 1,
    });
    expect(tie.events[0].data).toMatchObject({ lantern_id: 'L1' });

    const skipLit = run({
      scenario: quiet({
        player: { carried: 2 },
        lanterns: [
          { id: 'L1', pos: [0, 0, 0.5], lit: true },
          { id: 'L2', pos: [0, 0, 1.5] },
        ],
      }),
      frames: [{ tick: 0, interact: true }],
      ticks: 1,
    });
    expect(skipLit.events[0].data).toMatchObject({ lantern_id: 'L2', amount: 2 });
  });

  // Sửa theo phase-2.md mục 2: thêm 10 × số nạp; thắng xét ở bước 11.
  it('AC7: thắp đủ 5 đèn → won all_lit; 100 (nạp 10) + 100 (thắp) + 2 × 299 + 50 × 3 = 948', () => {
    const r = run({
      scenario: quiet({
        player: { carried: 10 },
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
      { type: 'event', tick: 1, name: 'deposit', data: { lantern_id: 'L5', amount: 10, deposited: 10 } },
      { type: 'event', tick: 1, name: 'lantern_lit', data: { lantern_id: 'L5' } },
      { type: 'event', tick: 1, name: 'game_over', data: { result: 'won', reason: 'all_lit' } },
    ]);
    expect(r.end).toEqual({ type: 'end', ticks: 1, state: 'won', score: 948 });
    expect(r.snap(1).state).toBe('won');
    expect(r.lines.at(-1)).toEqual(r.end);
  });
});
