import { describe, expect, it } from 'vitest';
import { quiet, run, ticksOf } from './helpers';

describe('Tỏa Sáng (AC2-09, AC2-17)', () => {
  // Sửa theo phase-2.md mục 2: cần 3 đom đóm, đẩy dần trong 15 tick (không tức thời), +5, choáng 120 tick.
  it('AC8: carried 4, bóng cách 3 m → stunned, đẩy 4 m trong 15 tick (3 → 7), carried 1, +5', () => {
    const r = run({
      scenario: quiet({ player: { carried: 4 }, shades: [{ pos: [3, 0, 0] }, { pos: [10, 0, 0] }] }),
      frames: [{ tick: 0, pulse: true }],
      ticks: 121,
    });
    expect(r.events[0]).toEqual({ type: 'event', tick: 1, name: 'pulse', data: { stunned_ids: ['S1'] } });
    const s1 = r.snap(1);
    expect(s1.player).toMatchObject({ carried: 1, pulse_cd_s: 3 });
    expect(s1.score).toBe(5);
    expect(s1.shades[0]).toEqual({ id: 'S1', pos: [3.267, 1, 0], state: 'stunned' });
    expect(s1.shades[1].state).toBe('chase');
    expect(r.snap(14).shades[0].pos).toEqual([6.733, 1, 0]);
    expect(r.snap(15).shades[0].pos).toEqual([7, 1, 0]);
    expect(r.snap(16).shades[0].pos).toEqual([7, 1, 0]);
    // Choáng 120 tick: tick 120 vẫn choáng, tick 121 về wander → đuổi ngay (≤ 12 m).
    expect(r.snap(120).shades[0]).toEqual({ id: 'S1', pos: [7, 1, 0], state: 'stunned' });
    expect(r.snap(121).shades[0]).toEqual({ id: 'S1', pos: [6.933, 1, 0], state: 'chase' });
  });

  it('khoảng cách đo 3D từ chân Mây + 0.8 m tới tâm bóng (Y 1): XZ 4.9 trúng, XZ 5.0 trượt', () => {
    // (0,0.8,0) → (4.9,1,0): √(24.01 + 0.04) = 4.904 ≤ 5; (5,1,0): √(25.04) = 5.004 > 5.
    const r = run({
      scenario: quiet({ player: { carried: 3 }, shades: [{ id: 'S1', pos: [4.9, 0, 0] }, { id: 'S2', pos: [0, 0, 5] }] }),
      frames: [{ tick: 0, pulse: true }],
      ticks: 1,
    });
    expect(r.events[0].data).toEqual({ stunned_ids: ['S1'] });
  });

  it('đang trên không: tâm theo chân Mây (đỉnh nhảy 1.225 → tâm 2.025)', () => {
    // Tâm (0,2.025,0): bóng XZ 4.85 → √(23.52 + 1.05) = 4.957 trúng; XZ 4.9 → 5.006 trượt.
    const r = run({
      scenario: quiet({
        player: { carried: 3 },
        shades: [
          // stunned (đặt sẵn) để đứng yên trong lúc Mây nhảy; vẫn trúng Tỏa Sáng.
          { id: 'S1', pos: [4.85, 0, 0], state: 'stunned', state_ticks_left: 100 },
          { id: 'S2', pos: [0, 0, -4.9], state: 'stunned', state_ticks_left: 100 },
        ],
      }),
      frames: [
        { tick: 0, jump: true },
        { tick: 20, pulse: true },
      ],
      ticks: 21,
    });
    expect(r.snap(21).player.pos[1]).toBe(1.225);
    expect(r.events.find((e) => e.name === 'pulse')!.data).toEqual({ stunned_ids: ['S1'] });
  });

  // Sửa dựng theo phase-2.md mục 2: carried ≥ 3 (kỳ vọng stunned_ids rỗng giữ nguyên).
  it('pulse không trúng ai vẫn ghi sự kiện với stunned_ids rỗng', () => {
    const r = run({ scenario: quiet({ player: { carried: 3 } }), frames: [{ tick: 0, pulse: true }], ticks: 1 });
    expect(r.events).toEqual([{ type: 'event', tick: 1, name: 'pulse', data: { stunned_ids: [] } }]);
    expect(r.snap(1).player.carried).toBe(0);
  });

  it('bóng trùng vị trí Mây bị đẩy theo +X', () => {
    const r = run({
      scenario: quiet({ player: { carried: 3 }, shades: [{ id: 'S9', pos: [0, 0, 0] }] }),
      frames: [{ tick: 0, pulse: true }],
      ticks: 15,
    });
    expect(r.events).toEqual([{ type: 'event', tick: 1, name: 'pulse', data: { stunned_ids: ['S9'] } }]);
    expect(r.snap(15).shades[0].pos).toEqual([4, 1, 0]);
  });

  // Sửa theo phase-2.md mục 2: "dừng nếu gặp vật cản" thay cho kẹp: mép đảo và mép vùng đèn.
  it('đẩy dừng ở vật cản: mép đảo r 40', () => {
    const r = run({
      scenario: quiet({ player: { pos: [38, 0, 0], carried: 3 }, shades: [{ pos: [39, 0, 0] }] }),
      frames: [{ tick: 0, pulse: true }],
      ticks: 15,
    });
    expect(r.snap(3).shades[0].pos).toEqual([39.8, 1, 0]);
    expect(r.snap(4).shades[0].pos).toEqual([40, 1, 0]);
    expect(r.snap(15).shades[0].pos).toEqual([40, 1, 0]);
  });

  it('đẩy dừng ở vật cản: mép vùng an toàn 6 m của đèn đã sáng', () => {
    const r = run({
      scenario: quiet({
        player: { carried: 3 },
        lanterns: [{ id: 'L1', pos: [9, 0, 0], lit: true }],
        shades: [{ pos: [1.5, 0, 0] }],
      }),
      frames: [{ tick: 0, pulse: true }],
      ticks: 15,
    });
    expect(r.snap(15).shades[0]).toEqual({ id: 'S1', pos: [3, 1, 0], state: 'stunned' });
  });

  it('trúng cả bóng đang spawning / recoil / stunned (+5 mỗi con); pulse lại làm mới choáng', () => {
    const r = run({
      scenario: quiet({
        player: { carried: 3 },
        shades: [
          { id: 'S1', pos: [3, 0, 0], state: 'spawning' },
          { id: 'S2', pos: [0, 0, 3], state: 'recoil' },
          { id: 'S3', pos: [-3, 0, 0], state: 'stunned', state_ticks_left: 10 },
        ],
      }),
      frames: [{ tick: 0, pulse: true }],
      ticks: 121,
    });
    expect(r.events[0].data).toEqual({ stunned_ids: ['S1', 'S2', 'S3'] });
    expect(r.snap(1).score).toBe(15);
    // S3 lẽ ra hết choáng ở tick 10; được làm mới 120 tick và đẩy lùi 4 m về −X.
    expect(r.snap(11).shades[2].state).toBe('stunned');
    expect(r.snap(15).shades[2].pos).toEqual([-7, 1, 0]);
    expect(r.snap(120).shades.map((s) => s.state)).toEqual(['stunned', 'stunned', 'stunned']);
    expect(r.snap(121).shades.map((s) => s.state)).toEqual(['chase', 'chase', 'chase']);
  });

  // Sửa theo phase-2.md mục 2: carried < 3 (Phase 1: < 2).
  it('AC9: carried < 3 → không có sự kiện, không trừ', () => {
    const r = run({
      scenario: quiet({ player: { carried: 2 }, shades: [{ pos: [5, 0, 0] }] }),
      frames: [{ tick: 0, pulse: true }],
      ticks: 1,
    });
    expect(r.events).toEqual([]);
    expect(r.snap(1).player.carried).toBe(2);
    expect(r.snap(1).shades[0].state).toBe('chase');
  });

  // Sửa theo phase-2.md mục 2: hồi chiêu 3 s = 180 tick (Phase 1: 90 tick).
  it('AC9: đang hồi chiêu (180 tick tính từ tick kích hoạt) → không có sự kiện', () => {
    const base = quiet({ player: { carried: 9 } });
    const early = run({
      scenario: base,
      frames: [
        { tick: 0, pulse: true },
        { tick: 1, pulse: false },
        { tick: 2, pulse: true },
        { tick: 3, pulse: false },
        { tick: 179, pulse: true },
      ],
      ticks: 200,
    });
    expect(ticksOf(early.events, 'pulse')).toEqual([1]);
    expect(early.snap(200).player.carried).toBe(6);

    const ready = run({
      scenario: base,
      frames: [
        { tick: 0, pulse: true },
        { tick: 1, pulse: false },
        { tick: 180, pulse: true },
      ],
      ticks: 200,
    });
    expect(ticksOf(ready.events, 'pulse')).toEqual([1, 181]);
    expect(ready.snap(200).player.carried).toBe(3);
  });

  it('giữ nút pulse không kích hoạt lại (chỉ sườn false→true)', () => {
    const r = run({ scenario: quiet({ player: { carried: 9 } }), frames: [{ tick: 0, pulse: true }], ticks: 400 });
    expect(r.events.map((e) => e.tick)).toEqual([1]);
  });
});
