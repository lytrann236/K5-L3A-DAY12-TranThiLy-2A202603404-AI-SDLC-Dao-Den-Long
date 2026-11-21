import { describe, expect, it } from 'vitest';
import { quiet, run } from './helpers';

describe('Đèn (AC2-07, AC2-17, AC2-20)', () => {
  // Sửa theo phase-2.md mục 2: vị trí vòng 22 m của Phase 1 → 5 tọa độ chuẩn ticket-02 Phần 2.
  // Phase 3: snapshot đèn thêm fuel / ever_lit / relit_count (Test Contract v1.2).
  it('vị trí mặc định Đêm 1: L1 (0,0,25) · L2 (23.8,0,7.7) · L3 (14.7,0,−20.2) · L4 (−14.7,0,−20.2) · L5 (−23.8,0,7.7)', () => {
    const r = run({ scenario: quiet(), ticks: 0 });
    expect(r.snap(0).lanterns).toEqual([
      { id: 'L1', pos: [0, 0, 25], lit: false, deposited: 0, fuel: 0, ever_lit: false, relit_count: 0 },
      { id: 'L2', pos: [23.8, 0, 7.7], lit: false, deposited: 0, fuel: 0, ever_lit: false, relit_count: 0 },
      { id: 'L3', pos: [14.7, 0, -20.2], lit: false, deposited: 0, fuel: 0, ever_lit: false, relit_count: 0 },
      { id: 'L4', pos: [-14.7, 0, -20.2], lit: false, deposited: 0, fuel: 0, ever_lit: false, relit_count: 0 },
      { id: 'L5', pos: [-23.8, 0, 7.7], lit: false, deposited: 0, fuel: 0, ever_lit: false, relit_count: 0 },
    ]);
  });

  // Sửa theo phase-2.md mục 2: lantern_cost 10 và "+10 mỗi đom đóm nạp" → 10 × 10 + 100 = 200.
  // Phase 3: per_mote 10 → 5 (ticket-03 mục 5) → 10 × 5 + 100 = 150; lantern_lit thêm relight; fuel 100.
  it('AC6: carried 10 cạnh L1, interact → deposit 10 + lantern_lit, điểm 100 + 10 × 5 = 150', () => {
    const r = run({
      scenario: quiet({ player: { pos: [0, 0, 24], carried: 10 } }),
      frames: [{ tick: 0, interact: true }],
      ticks: 3,
    });
    expect(r.events).toEqual([
      { type: 'event', tick: 1, name: 'deposit', data: { lantern_id: 'L1', amount: 10, deposited: 10 } },
      { type: 'event', tick: 1, name: 'lantern_lit', data: { lantern_id: 'L1', relight: false } },
    ]);
    expect(r.snap(1).score).toBe(150);
    expect(r.snap(1).player.carried).toBe(0);
    expect(r.snap(1).lanterns[0]).toMatchObject({ id: 'L1', lit: true, deposited: 10, fuel: 100, ever_lit: true });
  });

  // Sửa theo phase-2.md mục 2: nạp một phần CÓ cộng 10/đom đóm; biên 2 m thay cho 3 m.
  // Phase 3: per_mote 5 → 3 × 5 = 15.
  it('nạp một phần cộng 5/đom đóm, đèn nhớ tiến độ; giữ nút không nạp lại', () => {
    const r = run({
      scenario: quiet({ player: { pos: [0, 0, 24], carried: 3 } }),
      frames: [{ tick: 0, interact: true }],
      ticks: 10,
    });
    expect(r.events).toEqual([
      { type: 'event', tick: 1, name: 'deposit', data: { lantern_id: 'L1', amount: 3, deposited: 3 } },
    ]);
    expect(r.snap(10).score).toBe(15);
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
      ['lantern_lit', { lantern_id: 'L1', relight: false }],
    ]);
    expect(r.snap(1).player.carried).toBe(2);
    expect(r.snap(1).score).toBe(15 + 100); // Phase 3: per_mote 5
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

  // Phase 3: "chỉ xét đèn chưa sáng" → "chỉ xét đèn nhận được" (ticket-03 mục 1). Đèn sáng ĐẦY dầu
  // vẫn bị bỏ qua (giữ nguyên kỳ vọng cũ); đèn sáng chưa đầy được chọn (test ở fuel.test.ts).
  it('chỉ xét đèn nhận được (đèn đầy dầu bị bỏ qua); gần nhất, bằng nhau thì id nhỏ hơn', () => {
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
    // Phase 3: L1 sáng đã hao 1/60 ở bước 2 nên chưa đầy → được chọn (gần hơn), châm 1 lên 100.
    expect(skipLit.events[0]).toMatchObject({ name: 'refuel', data: { lantern_id: 'L1', amount: 1, fuel: 100 } });
    // Đèn đầy dầu (vừa thắp ở bước 5 cùng tick) bị bỏ qua: thắp L1 xong lần bấm sau mới châm.
    const full = run({
      scenario: quiet({ player: { carried: 12 }, lanterns: [{ id: 'L1', pos: [0, 0, 0.5] }, { id: 'L2', pos: [0, 0, 1.5] }] }),
      frames: [{ tick: 0, interact: true }, { tick: 1, interact: false }, { tick: 2, interact: true }],
      ticks: 3,
    });
    expect(full.events.map((e) => [e.tick, e.name, e.data.lantern_id])).toEqual([
      [1, 'deposit', 'L1'],
      [1, 'lantern_lit', 'L1'],
      [3, 'refuel', 'L1'],
    ]);
  });

  // Phase 3: thay AC7 "thắp đủ 5 đèn → won all_lit" (ticket-03 mục 3: không còn thắng sớm). Thắng
  // bình minh nằm ở endgame.test.ts. Ở đây: thắp đèn cuối → Đêm tiếp tục, đèn đặt sẵn không cộng điểm.
  it('thắp đủ 5 đèn → vẫn playing, không game_over; 10 × 5 + 100 = 150', () => {
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
      { type: 'event', tick: 1, name: 'lantern_lit', data: { lantern_id: 'L5', relight: false } },
    ]);
    expect(r.end).toEqual({ type: 'end', ticks: 100, state: 'playing', score: 150 });
  });
});
