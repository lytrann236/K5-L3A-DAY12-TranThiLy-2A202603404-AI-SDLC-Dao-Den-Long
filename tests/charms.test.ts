import { describe, expect, it } from 'vitest';
import { parseScenario } from '../src/headless/parse';
import { quiet, run, ticksOf } from './helpers';

describe('Bùa Gió: vị trí và nhặt (AC2-35)', () => {
  it('Đêm 2 mặc định có C1 ở (35,0,0); Đêm 1 không có bùa', () => {
    expect(run({ night: 2, ticks: 0 }).snap(0).charms).toEqual([{ id: 'C1', available: true, respawn_s: 0 }]);
    expect(run({ ticks: 0 }).snap(0).charms).toEqual([]);
  });

  it('nhặt theo luật đom đóm: đứng ở (35,0,0) → charm_picked {C1, 600}; bùa biến mất 2700 tick', () => {
    const r = run({ night: 2, ticks: 1, scenario: quiet({ player: { pos: [35, 0, 0] } }) });
    expect(r.events).toEqual([
      { type: 'event', tick: 1, name: 'charm_picked', data: { charm_id: 'C1', charm_ticks: 600 } },
    ]);
    expect(r.snap(1).charms).toEqual([{ id: 'C1', available: false, respawn_s: 45 }]);
    expect(r.snap(1).player.charm_s).toBe(10);
  });

  it('biên nhặt: XZ 1.0 m thì nhặt, 1.01 m thì không; chênh cao > 1.5 m thì không', () => {
    const at = run({ night: 2, ticks: 1, scenario: quiet({ player: { pos: [34, 0, 0] } }) });
    expect(ticksOf(at.events, 'charm_picked')).toEqual([1]);
    const out = run({ night: 2, ticks: 1, scenario: quiet({ player: { pos: [33.99, 0, 0] } }) });
    expect(ticksOf(out.events, 'charm_picked')).toEqual([]);
    // Mây ở trên không, chân cao 1.6 m so với bùa (đang rơi, tick 1 vẫn > 1.5).
    const high = run({ night: 2, ticks: 1, scenario: quiet({ player: { pos: [35, 1.6, 0] } }) });
    expect(ticksOf(high.events, 'charm_picked')).toEqual([]);
  });

  it('túi đầy (10) vẫn nhặt được bùa', () => {
    const r = run({ night: 2, ticks: 1, scenario: quiet({ player: { pos: [35, 0, 0], carried: 10 } }) });
    expect(ticksOf(r.events, 'charm_picked')).toEqual([1]);
    expect(r.snap(1).player.carried).toBe(10);
  });

  it('scenario charms[] thay danh sách mặc định; thiếu pos → vị trí chuẩn theo id', () => {
    const sc = parseScenario('{"charms":[{"id":"C1","available":false,"respawn_ticks":30}]}', 2);
    const r = run({ night: 2, ticks: 31, scenario: quiet({ ...sc, player: { pos: [35, 0, 0] } }) });
    expect(r.snap(0).charms).toEqual([{ id: 'C1', available: false, respawn_s: 0.5 }]);
    // Xuất hiện lại ở tick 30 (bước 2), nhặt ngay bước 4 của tick đó tại vị trí chuẩn (35,0,0).
    expect(ticksOf(r.events, 'charm_picked')).toEqual([30]);
    const noId = parseScenario('{"charms":[{}]}', 2);
    expect(run({ night: 2, ticks: 0, scenario: noId }).snap(0).charms).toEqual([
      { id: 'C1', available: true, respawn_s: 0 },
    ]);
    expect(run({ night: 2, ticks: 0, scenario: { charms: [] } }).snap(0).charms).toEqual([]);
  });
});

describe('Bùa Gió: hiệu lực (AC2-36)', () => {
  it('chạy 7.2 m/s trong khi có hiệu lực, hết hiệu lực thì về 6 m/s', () => {
    // charm_ticks 100 (đặt sẵn) để quãng chạy còn nằm trong đảo A; thời lượng 600 kiểm ở test nhặt.
    const r = run({
      night: 2,
      ticks: 110,
      scenario: quiet({ player: { pos: [0, 0, -20], charm_ticks: 100 }, charms: [] }),
      frames: [{ tick: 0, move: [0, 1] }],
    });
    expect(r.snap(1).player).toMatchObject({ pos: [0, 0, -19.88], vel: [0, 0, 7.2], charm_s: 1.65 });
    expect(r.snap(99).player.vel).toEqual([0, 0, 7.2]);
    expect(r.snap(100).player).toMatchObject({ vel: [0, 0, 6], charm_s: 0 });
    expect(r.snap(99).player.pos[2]).toBeCloseTo(-20 + 99 * 0.12, 6);
  });

  it('nhặt bùa thì tốc độ đổi từ tick sau; nhặt lại khi còn hiệu lực thì làm mới về 600', () => {
    const r = run({
      night: 2,
      ticks: 3,
      scenario: quiet({
        player: { pos: [35, 0, 0], charm_ticks: 100 },
        charms: [{ id: 'C1', pos: [35, 0, 0] }],
      }),
      frames: [{ tick: 1, move: [0, 1] }],
    });
    expect(r.events[0]).toMatchObject({ tick: 1, name: 'charm_picked', data: { charm_id: 'C1', charm_ticks: 600 } });
    expect(r.snap(1).player.charm_s).toBe(10); // 100 → 600
    expect(r.snap(2).player.vel).toEqual([0, 0, 7.2]);
  });

  it('lướt không hồi chiêu: vẫn phải nhấn lại; nhấn khi đang lướt bị bỏ qua; vẫn 14 m/s × 12 tick', () => {
    const r = run({
      night: 2,
      ticks: 40,
      scenario: quiet({ player: { pos: [-20, 0, 0], charm_ticks: 600 }, charms: [] }),
      frames: [
        { tick: 0, dash: true }, // lướt ở tick 1…12
        { tick: 5, dash: false },
        { tick: 6, dash: true }, // tick 7: đang lướt → bỏ qua
        { tick: 7, dash: false },
        { tick: 12, dash: true }, // tick 13: vừa hết lướt → lướt tiếp ngay, không hồi chiêu
        { tick: 13, dash: true }, // giữ nút: không tính là nhấn lại
      ],
    });
    expect(ticksOf(r.events, 'dash')).toEqual([1, 13]);
    expect(r.snap(1).player.dash_cd_s).toBe(0);
    expect(r.snap(12).player.pos).toEqual([-20, 0, 2.8]);
    expect(r.snap(12).player.vel).toEqual([0, 0, 14]);
    expect(r.snap(24).player.pos).toEqual([-20, 0, 5.6]);
    expect(r.snap(25).player.vel).toEqual([0, 0, 0]); // giữ nút không lướt lần 3
  });

  it('nhặt bùa khi đang hồi chiêu lướt: hồi chiêu về 0, lướt được ngay', () => {
    const r = run({
      night: 2,
      ticks: 3,
      scenario: quiet({ player: { pos: [35, 0, 0], dash_cd_ticks: 80 } }),
      frames: [{ tick: 1, dash: true }],
    });
    expect(r.snap(1).player.dash_cd_s).toBe(0);
    expect(ticksOf(r.events, 'dash')).toEqual([2]);
  });

  it('không có bùa thì lướt hồi 90 tick như thường', () => {
    const r = run({
      night: 2,
      ticks: 20,
      scenario: quiet({ player: { pos: [-20, 0, 0] }, charms: [] }),
      frames: [
        { tick: 0, dash: true },
        { tick: 1, dash: false },
        { tick: 15, dash: true },
      ],
    });
    expect(ticksOf(r.events, 'dash')).toEqual([1]);
  });

  it('bùa xuất hiện lại sau 2700 tick: nhặt ở tick 1 → available lại ở tick 2701', () => {
    const r = run({ night: 2, ticks: 2702, scenario: quiet({ player: { pos: [35, 0, 0] } }) });
    expect(r.snap(2700).charms).toEqual([{ id: 'C1', available: false, respawn_s: 0.017 }]);
    // Mây vẫn đứng trên bùa: tick 2701 bùa có lại (bước 2) và được nhặt ngay (bước 4).
    expect(ticksOf(r.events, 'charm_picked')).toEqual([1, 2701]);
    expect(r.snap(2701).player.charm_s).toBe(10);
  });

  it('bùa có lại khi Mây không đứng đó: available true, respawn_s 0', () => {
    const r = run({
      night: 2,
      ticks: 2702,
      scenario: quiet({ player: { pos: [35, 0, 0] } }),
      frames: [
        { tick: 1, move: [0, 1] }, // rời bùa 1.2 m theo +Z rồi đứng yên trên cầu
        { tick: 11, move: [0, 0] },
      ],
    });
    expect(r.snap(2700).player.pos[2]).toBeCloseTo(1.2, 6);
    expect(r.snap(2701).charms).toEqual([{ id: 'C1', available: true, respawn_s: 0 }]);
  });
});
