import { describe, expect, it } from 'vitest';
import { BENCH_MOTES, BENCH_SHADES, benchScenario } from '../src/render/bench';
import { createGame } from '../src/sim/world';

describe('cảnh benchmark (ticket-04 mục 1)', () => {
  it('đúng 200 Bóng Mực wander, 100 đom đóm, L1–L3 sáng fuel 100, tất định theo seed', () => {
    const s = createGame(42, benchScenario(42), 1);
    expect(s.shades).toHaveLength(BENCH_SHADES);
    expect(BENCH_SHADES).toBe(200);
    expect(s.shades.every((x) => x.state === 'wander')).toBe(true);
    expect(s.motes).toHaveLength(BENCH_MOTES);
    expect(BENCH_MOTES).toBe(100);
    expect(s.lanterns.filter((l) => l.lit).map((l) => l.id)).toEqual(['L1', 'L2', 'L3']);
    expect(s.lanterns.filter((l) => l.lit).every((l) => l.fuelU === 100 * 60)).toBe(true);
    expect(s.player.pos).toEqual([0, 0, 0]);
    expect(benchScenario(42)).toEqual(benchScenario(42));
  });
});
