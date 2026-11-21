import { TICK_RATE } from './constants';
import { capacity, fuelOut } from './fuel';
import type { GameState, Vec3 } from './types';

/** Làm tròn 3 chữ số thập phân (đổi -0 thành 0). */
export function round3(x: number): number {
  const r = Math.round(x * 1000) / 1000;
  return r === 0 ? 0 : r;
}

const r3v = (v: Vec3): Vec3 => [round3(v[0]), round3(v[1]), round3(v[2])];
const sec = (ticks: number) => round3(ticks / TICK_RATE);

/** Trạng thái ghi ra output: `paused` khi đang tạm dừng (game chưa kết thúc). */
export function outputState(s: GameState): string {
  return s.status === 'playing' && s.paused ? 'paused' : s.status;
}

/** Dòng snapshot theo Test Contract mục E (v1.2). */
export function toSnapshot(s: GameState) {
  const p = s.player;
  return {
    type: 'snapshot' as const,
    tick: s.tick,
    sim_tick: s.simTick,
    state: outputState(s),
    night: s.night,
    time_left_s: round3(s.timeLeft),
    score: s.score,
    wind: { active: s.wind.active, dir_deg: s.wind.dirDeg },
    player: {
      pos: r3v(p.pos),
      vel: r3v(p.vel),
      grounded: p.grounded,
      flames: p.flames,
      carried: p.carried,
      invuln: p.invuln > 0 || p.respawn > 0,
      dash_cd_s: sec(p.dashCooldown),
      pulse_cd_s: sec(p.pulseCooldown),
      charm_s: sec(p.charm),
      capacity: capacity(p),
    },
    lanterns: s.lanterns.map((l) => ({
      id: l.id,
      pos: r3v(l.pos),
      lit: l.lit,
      deposited: l.deposited,
      fuel: fuelOut(l),
      ever_lit: l.everLit,
      relit_count: l.relitCount,
    })),
    shades: s.shades.map((sh) => ({ id: sh.id, pos: r3v(sh.pos), state: sh.state })),
    drifters: s.drifters.map((d) => ({ id: d.id, pos: r3v(d.pos), state: d.state, stolen: d.stolen })),
    charms: s.charms.map((c) => ({ id: c.id, available: c.available, respawn_s: sec(c.respawn) })),
    motes_active: s.motes.length,
    motes: s.motes.map((m) => ({
      id: m.id,
      pos: r3v(m.pos),
      kind: m.kind,
      ttl_s: m.ttl === null ? null : sec(m.ttl),
    })),
  };
}
