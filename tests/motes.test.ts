import { describe, expect, it } from 'vitest';
import { getMap } from '../src/sim/maps';
import type { Vec3 } from '../src/sim/types';
import { quiet, run } from './helpers';

const key = (p: number[]) => `${p[0]},${p[2]}`;
const spawnKeys = new Set(getMap(1).moteSpawns.map((p) => key([Math.round(p[0] * 1000) / 1000, 0, Math.round(p[2] * 1000) / 1000])));

describe('Đom đóm (AC2-05, AC2-06)', () => {
  // Sửa theo phase-2.md mục 2: "+10 mỗi đom đóm NẠP" → nhặt không cộng điểm.
  it('AC4: đom đóm tại (0,0,1) → mote_picked tick 1, carried 1, điểm 0 (nhặt không cộng)', () => {
    const r = run({ scenario: quiet({ motes: [[0, 0, 1]] }), ticks: 5 });
    expect(r.events).toEqual([{ type: 'event', tick: 1, name: 'mote_picked', data: { carried: 1 } }]);
    expect(r.snap(1).player.carried).toBe(1);
    expect(r.snap(1).score).toBe(0);
    expect(r.snap(1).motes_active).toBe(0);
  });

  // Sửa theo phase-2.md mục 2: biên 1.5/1.6 m → 1.0/1.01 m (pickup_radius 1).
  it('XZ đúng 1.0 m thì nhặt, 1.01 m thì không', () => {
    const r = run({ scenario: quiet({ motes: [[0, 0, 1.01], [1, 0, 0]] }), ticks: 1 });
    expect(r.events).toEqual([{ type: 'event', tick: 1, name: 'mote_picked', data: { carried: 1 } }]);
    expect(r.snap(1).motes.map((m) => m.pos)).toEqual([[0, 0, 1.01]]);
  });

  it('chênh cao chân Mây − mặt đất nơi đặt đom đóm ≤ 1.5 m mới nhặt (Mây đang ở trên không)', () => {
    // Bắt đầu ở Y 1.6 (trên không, rơi tự do): sau tick 1 chân ở ≈ 1.597 → chênh > 1.5, không nhặt.
    const high = run({ scenario: quiet({ player: { pos: [0, 1.6, 0] }, motes: [[0, 0, 0]] }), ticks: 1 });
    expect(high.events).toEqual([]);
    // Bắt đầu ở Y 1.5: sau tick 1 chân ở < 1.5 → nhặt.
    const low = run({ scenario: quiet({ player: { pos: [0, 1.5, 0] }, motes: [[0, 0, 0]] }), ticks: 1 });
    expect(low.events.map((e) => e.name)).toEqual(['mote_picked']);
  });

  it('AC5: đầy túi (10) thì không nhặt thêm', () => {
    const r = run({ scenario: quiet({ player: { carried: 10 }, motes: [[0, 0, 1]] }), ticks: 30 });
    expect(r.events).toEqual([]);
    expect(r.snap(30).player.carried).toBe(10);
    expect(r.snap(30).motes_active).toBe(1);
    expect(r.end.score).toBe(0);
  });

  it('AC5: carried 9 và 2 con trong tầm → chỉ nhặt 1, con còn lại nằm yên', () => {
    const r = run({ scenario: quiet({ player: { carried: 9 }, motes: [[0, 0, 1], [1, 0, 0]] }), ticks: 10 });
    expect(r.events.map((e) => [e.tick, e.name, e.data])).toEqual([[1, 'mote_picked', { carried: 10 }]]);
    expect(r.snap(10).motes).toEqual([{ id: 'M2', pos: [1, 0, 0], kind: 'random', ttl_s: null }]);
  });

  // Thay theo phase-2.md mục 2: "30 con, nhặt thì sinh lại" → 20 con trên 20 điểm khác nhau, sinh ở tick 240k.
  it('AC2-06: 20 đom đóm ban đầu ở 20 điểm KHÁC NHAU thuộc 24 điểm chuẩn của Đêm 1', () => {
    expect(getMap(1).moteSpawns).toHaveLength(24);
    const r = run({ scenario: { random_shades: false }, ticks: 0, seed: 3 });
    const ms = r.snap(0).motes;
    expect(ms).toHaveLength(20);
    expect(ms.map((m) => m.id)).toEqual(Array.from({ length: 20 }, (_, i) => `M${i + 1}`));
    expect(new Set(ms.map((m) => key(m.pos))).size).toBe(20);
    for (const m of ms) {
      expect(spawnKeys.has(key(m.pos))).toBe(true);
      expect(m).toMatchObject({ kind: 'random', ttl_s: null });
    }
  });

  it('AC2-06: sinh thêm 1 con ở tick 240, 480, … vào điểm trống; hết điểm trống thì bỏ lượt', () => {
    const r = run({ scenario: { random_shades: false }, ticks: 1300, seed: 3 });
    const count = (t: number) => r.snap(t).motes_active;
    expect([count(239), count(240), count(479), count(480), count(720), count(960)]).toEqual([20, 21, 21, 22, 23, 24]);
    // 24 điểm đã kín (Mây đứng ở gốc, không nhặt) → tick 1200 bỏ lượt.
    expect(count(1200)).toBe(24);
    const s = r.snap(960).motes;
    expect(new Set(s.map((m) => key(m.pos))).size).toBe(24);
    expect(s.at(-1)!.id).toBe('M24');
  });

  it('AC2-06: điểm vừa nhặt trở thành điểm trống; trần 30 con', () => {
    // 30 con trong scenario (không nằm trên điểm sinh) + random_motes → tick 240 không sinh vì đã đủ 30.
    const thirty: Vec3[] = Array.from({ length: 30 }, (_, i) => [5 + i * 0.5, 0, 5]);
    const full = run({ scenario: { random_shades: false, motes: thirty }, ticks: 240 });
    expect(full.snap(240).motes_active).toBe(30);
    const notFull = run({ scenario: { random_shades: false, motes: thirty.slice(1) }, ticks: 240 });
    expect(notFull.snap(239).motes_active).toBe(29);
    expect(notFull.snap(240).motes_active).toBe(30);
    expect(spawnKeys.has(key(notFull.snap(240).motes.at(-1)!.pos))).toBe(true);
  });

  it('AC2-06: tất định theo seed — cùng seed cùng điểm, seed khác thì khác', () => {
    const pos = (seed: number) => run({ scenario: { random_shades: false }, ticks: 0, seed }).snap(0).motes.map((m) => key(m.pos));
    expect(pos(3)).toEqual(pos(3));
    expect(pos(3)).not.toEqual(pos(4));
  });
});
