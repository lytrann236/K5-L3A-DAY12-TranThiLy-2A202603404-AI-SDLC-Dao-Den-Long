import type { GameState, Vec3 } from './types';

/** Làm tròn 3 chữ số thập phân (đổi -0 thành 0). */
export function round3(x: number): number {
  const r = Math.round(x * 1000) / 1000;
  return r === 0 ? 0 : r;
}

const r3v = (v: Vec3): Vec3 => [round3(v[0]), round3(v[1]), round3(v[2])];

/** Dòng snapshot theo Test Contract mục E. */
export function toSnapshot(s: GameState) {
  return {
    type: 'snapshot' as const,
    tick: s.tick,
    sim_tick: s.tick,
    state: s.status,
    time_left_s: round3(s.timeLeft),
    score: s.score,
    player: { pos: r3v(s.player.pos), flames: s.player.flames, carried: s.player.carried },
    lanterns: s.lanterns.map((l) => ({
      id: l.id,
      pos: r3v(l.pos),
      lit: l.lit,
      deposited: l.deposited,
    })),
    shades: s.shades.map((sh) => ({ id: sh.id, pos: r3v(sh.pos), state: sh.state })),
    motes_active: s.motes.length,
    motes: s.motes.map((m) => ({ id: m.id, pos: r3v(m.pos) })),
  };
}
