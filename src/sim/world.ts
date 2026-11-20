import {
  LANTERN_RING_RADIUS,
  LANTERN_START_ANGLE_DEG,
  MOTE_COUNT,
  MOTE_MIN_ORIGIN_DIST,
  MOTE_SPAWN_RADIUS,
  SHADE_INITIAL_COUNT,
  SHADE_INITIAL_MIN_DIST,
  SHADE_SPAWN_RADIUS,
  SHADE_Y,
  TICK_RATE,
} from './constants';
import { TUNING } from './contract';
import { distXZ, randomPointInDisk } from './geom';
import { mulberry32 } from './rng';
import type { GameState, Lantern, Mote, Scenario, Shade, Vec3 } from './types';

/** Id đèn của Đêm 1: L1…Ln. */
export function lanternIds(): string[] {
  return Array.from({ length: TUNING.lantern_count_night1 }, (_, k) => `L${k + 1}`);
}

function defaultLanterns(): Lantern[] {
  const n = TUNING.lantern_count_night1;
  return lanternIds().map((id, k) => {
    const a = ((LANTERN_START_ANGLE_DEG + (360 / n) * k) * Math.PI) / 180;
    return {
      id,
      pos: [LANTERN_RING_RADIUS * Math.cos(a), 0, LANTERN_RING_RADIUS * Math.sin(a)],
      lit: false,
      deposited: 0,
    };
  });
}

/** Sinh một đom đóm ngẫu nhiên (trong 38 m, cách gốc ≥ 3 m). */
export function spawnRandomMote(s: GameState): Mote {
  const origin: Vec3 = [0, 0, 0];
  const pos = randomPointInDisk(
    s.rng,
    MOTE_SPAWN_RADIUS,
    0,
    (p) => distXZ(p, origin) >= MOTE_MIN_ORIGIN_DIST,
  );
  return { id: `M${s.nextMoteId++}`, pos };
}

/** Sinh một Bóng Mực ngẫu nhiên cách người chơi ≥ minDist. */
export function spawnRandomShade(s: GameState, minDist: number): Shade {
  const pos = randomPointInDisk(
    s.rng,
    SHADE_SPAWN_RADIUS,
    SHADE_Y,
    (p) => distXZ(p, s.player.pos) >= minDist,
  );
  return { id: `S${s.nextShadeId++}`, pos, state: 'chase', stun: 0 };
}

function shadeNum(id: string): number {
  const m = /^S(\d+)$/.exec(id);
  return m ? Number(m[1]) : 0;
}

/**
 * Dựng trạng thái tick 0: mặc định của game rồi áp scenario.
 * Không phát sự kiện, không cộng điểm.
 */
export function createGame(seed: number, scenario: Scenario = {}): GameState {
  const sp = scenario.player ?? {};
  const durationS = scenario.time_left_s ?? TUNING.night1_duration_s;

  const s: GameState = {
    tick: 0,
    status: 'playing',
    score: 0,
    durationS,
    durationTicks: Math.round(durationS * TICK_RATE),
    timeLeft: durationS,
    player: {
      pos: sp.pos ? [...sp.pos] : [0, 0, 0],
      vy: 0,
      grounded: true,
      flames: sp.flames ?? TUNING.flames,
      carried: sp.carried ?? 0,
      invuln: 0,
      pulseCooldown: 0,
    },
    lanterns: defaultLanterns(),
    shades: [],
    motes: [],
    randomMotes: scenario.random_motes ?? true,
    randomShades: scenario.random_shades ?? true,
    rng: mulberry32(seed),
    prevButtons: { jump: false, interact: false, pulse: false },
    nextMoteId: 1,
    nextShadeId: 1,
  };
  s.player.grounded = s.player.pos[1] <= 0;

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

  // Đom đóm.
  if (scenario.motes) {
    s.motes = scenario.motes.map((p) => ({ id: `M${s.nextMoteId++}`, pos: [p[0], 0, p[2]] }));
  } else if (s.randomMotes) {
    for (let i = 0; i < MOTE_COUNT; i++) s.motes.push(spawnRandomMote(s));
  }

  // Bóng Mực.
  if (scenario.shades) {
    const named = scenario.shades.filter((x) => x.id !== undefined).map((x) => shadeNum(x.id!));
    s.nextShadeId = Math.max(0, ...named) + 1;
    s.shades = scenario.shades.map((x) => ({
      id: x.id ?? `S${s.nextShadeId++}`,
      pos: [x.pos[0], SHADE_Y, x.pos[2]],
      state: 'chase',
      stun: 0,
    }));
    s.nextShadeId = Math.max(s.nextShadeId, ...s.shades.map((x) => shadeNum(x.id) + 1));
  } else if (s.randomShades) {
    for (let i = 0; i < SHADE_INITIAL_COUNT; i++) {
      s.shades.push(spawnRandomShade(s, SHADE_INITIAL_MIN_DIST));
    }
  }

  return s;
}
