import { runHeadless } from '../src/headless/run';
import type { InputFrame, Scenario } from '../src/sim/types';

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
  time_left_s: number;
  score: number;
  player: { pos: [number, number, number]; flames: number; carried: number };
  lanterns: { id: string; pos: [number, number, number]; lit: boolean; deposited: number }[];
  shades: { id: string; pos: [number, number, number]; state: string }[];
  motes_active: number;
  motes: { id: string; pos: [number, number, number] }[];
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
  motes: [],
  shades: [],
  ...sc,
});

/** Chạy headless (snapshot mỗi tick) và tách các dòng JSONL ra. */
export function run(opts: { scenario?: Scenario; frames?: InputFrame[]; ticks: number; seed?: number }) {
  const lines = runHeadless({
    seed: opts.seed ?? 1,
    ticks: opts.ticks,
    snapshotEvery: 1,
    scenario: opts.scenario,
    frames: opts.frames,
  }).map((l) => JSON.parse(l));
  const events: EventLine[] = lines.filter((l) => l.type === 'event');
  const snaps = new Map<number, SnapshotLine>();
  for (const l of lines) if (l.type === 'snapshot') snaps.set(l.tick, l);
  const end = lines[lines.length - 1] as EndLine;
  const snap = (t: number): SnapshotLine => {
    const s = snaps.get(t);
    if (!s) throw new Error(`không có snapshot tick ${t}`);
    return s;
  };
  return { lines, events, snap, end };
}
