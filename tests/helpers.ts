import { runHeadless } from '../src/headless/run';
import type { InputFrame, Scenario } from '../src/sim/types';

type V3 = [number, number, number];

export interface EventLine {
  type: 'event';
  tick: number;
  name: string;
  data: Record<string, unknown>;
}
export interface SnapshotLine {
  type: 'snapshot';
  tick: number;
  sim_tick: number;
  state: string;
  night: number;
  time_left_s: number;
  score: number;
  wind: { active: boolean; dir_deg: number };
  player: {
    pos: V3;
    vel: V3;
    grounded: boolean;
    flames: number;
    carried: number;
    invuln: boolean;
    dash_cd_s: number;
    pulse_cd_s: number;
    charm_s: number;
    capacity: number;
  };
  lanterns: {
    id: string;
    pos: V3;
    lit: boolean;
    deposited: number;
    fuel: number;
    ever_lit: boolean;
    relit_count: number;
  }[];
  shades: { id: string; pos: V3; state: string }[];
  drifters: { id: string; pos: V3; state: string; stolen: number }[];
  charms: { id: string; available: boolean; respawn_s: number }[];
  motes_active: number;
  motes: { id: string; pos: V3; kind: 'random' | 'dropped'; ttl_s: number | null }[];
}
export interface EndLine {
  type: 'end';
  ticks: number;
  state: string;
  score: number;
}

/** Scenario tắt mọi thứ ngẫu nhiên, ghi đè bằng `sc`. */
export const quiet = (sc: Scenario = {}): Scenario => ({
  random_motes: false,
  random_shades: false,
  random_drifters: false,
  motes: [],
  shades: [],
  ...sc,
});

/**
 * Chạy headless (snapshot mỗi tick) và tách các dòng JSONL ra.
 * `events` bỏ sự kiện `night_start` ở tick 0 (luôn có, v1.1) để các test luật chỉ so sự kiện
 * gameplay; `allEvents` giữ nguyên toàn bộ (test định dạng dùng cái này).
 */
export function run(opts: {
  scenario?: Scenario;
  frames?: InputFrame[];
  ticks: number;
  seed?: number;
  night?: number;
}) {
  const lines = runHeadless({
    seed: opts.seed ?? 1,
    night: opts.night ?? 1,
    ticks: opts.ticks,
    snapshotEvery: 1,
    scenario: opts.scenario,
    frames: opts.frames,
  }).map((l) => JSON.parse(l));
  const allEvents: EventLine[] = lines.filter((l) => l.type === 'event');
  const events = allEvents.filter((e) => e.name !== 'night_start');
  const snaps = new Map<number, SnapshotLine>();
  for (const l of lines) if (l.type === 'snapshot') snaps.set(l.tick, l);
  const end = lines[lines.length - 1] as EndLine;
  const snap = (t: number): SnapshotLine => {
    const s = snaps.get(t);
    if (!s) throw new Error(`không có snapshot tick ${t}`);
    return s;
  };
  return { lines, allEvents, events, snap, end };
}

/** Các tick có sự kiện tên `name`. */
export const ticksOf = (events: EventLine[], name: string) =>
  events.filter((e) => e.name === name).map((e) => e.tick);
