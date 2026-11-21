import {
  MOTE_INITIAL_COUNT,
  SHADE_RECOIL_TICKS,
  SHADE_SPAWNING_TICKS,
  SHADE_Y,
  TICK_RATE,
} from './constants';
import { TUNING } from './contract';
import { dirXZ } from './geom';
import { getMap } from './maps';
import { mulberry32 } from './rng';
import type { GameState, Lantern, Scenario, Shade, ShadeState, Vec3 } from './types';

/** Id đèn của một Đêm: L1…Ln theo bản đồ chuẩn. */
export function lanternIds(night = 1): string[] {
  return getMap(night).lanterns.map((l) => l.id);
}

/** Số tick mặc định của các trạng thái có thời hạn (khi scenario không ghi state_ticks_left). */
const STUN_TICKS = Math.round(TUNING.pulse_stun_s * TICK_RATE);
const DEFAULT_STATE_TICKS: Partial<Record<ShadeState, number>> = {
  spawning: SHADE_SPAWNING_TICKS,
  recoil: SHADE_RECOIL_TICKS,
  stunned: STUN_TICKS,
};

export function newShade(id: string, x: number, z: number, state: ShadeState, ticks: number): Shade {
  return {
    id,
    pos: [x, SHADE_Y, z],
    state,
    stateTicks: ticks,
    pushTicks: 0,
    pushDir: [1, 0],
    recoilDir: [1, 0],
    safeTicks: 0,
    safeStep: [0, 0],
  };
}

export function shadeNum(id: string): number {
  const m = /^S(\d+)$/.exec(id);
  return m ? Number(m[1]) : 0;
}

/** Xáo Fisher–Yates bằng RNG có seed (trả về mảng mới). */
export function shuffled<T>(items: readonly T[], rng: () => number): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Dựng trạng thái tick 0: mặc định của Đêm rồi áp scenario.
 * Không phát sự kiện, không cộng điểm.
 */
export function createGame(seed: number, scenario: Scenario = {}, night = 1): GameState {
  const map = getMap(night);
  const sp = scenario.player ?? {};
  const durationS = scenario.time_left_s ?? map.durationS;

  const s: GameState = {
    night,
    tick: 0,
    simTick: 0,
    status: 'playing',
    paused: false,
    score: 0,
    durationS,
    durationTicks: Math.round(durationS * TICK_RATE),
    timeLeft: durationS,
    player: {
      pos: sp.pos ? [...sp.pos] : [...map.start],
      vel: [0, 0, 0],
      grounded: true,
      facing: [...map.startFacing],
      flames: sp.flames ?? TUNING.flames,
      carried: sp.carried ?? 0,
      invuln: sp.invuln_ticks ?? 0,
      pulseCooldown: sp.pulse_cd_ticks ?? 0,
      dashCooldown: sp.dash_cd_ticks ?? 0,
      dashTicks: 0,
      dashDir: [...map.startFacing],
      charm: sp.charm_ticks ?? 0,
      respawn: 0,
      launch: null,
      heldVy: null,
    },
    lanterns: map.lanterns.map((l): Lantern => ({ id: l.id, pos: [...l.pos], lit: false, deposited: 0 })),
    shades: [],
    motes: [],
    drifters: [],
    charms: [],
    wind: { active: false, dirDeg: 0 },
    randomMotes: scenario.random_motes ?? true,
    randomShades: scenario.random_shades ?? true,
    randomDrifters: scenario.random_drifters ?? true,
    windEnabled: scenario.wind_enabled ?? true,
    rng: mulberry32(seed),
    prevButtons: { jump: false, interact: false, pulse: false, dash: false, pause: false },
    nextMoteId: 1,
    nextShadeId: 1,
  };
  const p = s.player;
  const g = map.groundAt(p.pos[0], p.pos[2]);
  p.grounded = g !== null && p.pos[1] <= g;
  if (p.grounded) p.pos[1] = g!;

  // Đèn: cập nhật theo id.
  for (const l of scenario.lanterns ?? []) {
    const target = s.lanterns.find((x) => x.id === l.id);
    if (!target) throw new Error(`unknown lantern id ${l.id}`);
    if (l.pos) target.pos = [...l.pos];
    if (l.deposited !== undefined) target.deposited = l.deposited;
    if (l.lit !== undefined) target.lit = l.lit;
    if (target.lit || target.deposited >= TUNING.lantern_cost) {
      target.lit = true;
      target.deposited = TUNING.lantern_cost;
    }
  }

  // Đom đóm: scenario thay danh sách; không thì 20 điểm đầu sau khi xáo danh sách điểm của Đêm.
  if (scenario.motes) {
    s.motes = scenario.motes.map((m) => ({
      id: `M${s.nextMoteId++}`,
      pos: [m[0], map.groundAt(m[0], m[2]) ?? 0, m[2]],
      kind: 'random',
      ttl: null,
    }));
  } else if (s.randomMotes) {
    s.motes = shuffled(map.moteSpawns, s.rng)
      .slice(0, MOTE_INITIAL_COUNT)
      .map((pt) => ({ id: `M${s.nextMoteId++}`, pos: [...pt], kind: 'random', ttl: null }));
  }

  // Bóng Mực: chỉ có trong scenario; con ngẫu nhiên sinh theo lịch (bước 10).
  if (scenario.shades) {
    const named = scenario.shades.filter((x) => x.id !== undefined).map((x) => shadeNum(x.id!));
    s.nextShadeId = Math.max(0, ...named) + 1;
    s.shades = scenario.shades.map((x) => {
      let state: ShadeState = x.state ?? 'wander';
      let ticks = x.state_ticks_left ?? DEFAULT_STATE_TICKS[state] ?? 0;
      if (DEFAULT_STATE_TICKS[state] === undefined) ticks = 0;
      else if (ticks <= 0) state = 'wander';
      const sh = newShade(x.id ?? `S${s.nextShadeId++}`, x.pos[0], x.pos[2], state, ticks);
      if (state === 'recoil') sh.recoilDir = dirXZ(p.pos, sh.pos);
      return sh;
    });
    s.nextShadeId = Math.max(s.nextShadeId, ...s.shades.map((x) => shadeNum(x.id) + 1));
  }

  // Gió Lạc / Bùa Gió: Đêm 1 không có; scenario có thể đặt (logic ở Việc 3).
  s.drifters = (scenario.drifters ?? []).map((d, i) => ({
    id: d.id ?? `D${i + 1}`,
    pos: [...d.pos] as Vec3,
    state: d.state ?? 'idle',
    stolen: d.stolen ?? 0,
  }));
  s.charms = (scenario.charms ?? []).map((c, i) => ({
    id: c.id ?? `C${i + 1}`,
    pos: [...c.pos] as Vec3,
    available: c.available ?? true,
    respawn: c.available === false ? (c.respawn_ticks ?? 0) : 0,
  }));

  return s;
}
