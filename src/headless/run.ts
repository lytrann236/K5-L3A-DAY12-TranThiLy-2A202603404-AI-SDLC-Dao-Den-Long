import { createGame } from '../sim/world';
import { step } from '../sim/step';
import { outputState, toSnapshot } from '../sim/snapshot';
import { DEFAULT_INPUT } from '../sim/types';
import type { InputFrame, InputState, Scenario } from '../sim/types';

export interface RunOptions {
  seed: number;
  night?: number;
  ticks: number;
  snapshotEvery: number;
  scenario?: Scenario;
  frames?: InputFrame[];
}

/** Chạy sim headless, trả về các dòng JSONL (snapshot / event / end). */
export function runHeadless(opts: RunOptions): string[] {
  const night = opts.night ?? 1;
  const s = createGame(opts.seed, opts.scenario ?? {}, night);
  const frames = opts.frames ?? [];
  // Tick 0: snapshot rồi night_start (phase-2.md 4.1).
  const lines: string[] = [
    JSON.stringify(toSnapshot(s)),
    JSON.stringify({ type: 'event', tick: 0, name: 'night_start', data: { night } }),
  ];
  const input: InputState = { ...DEFAULT_INPUT, move: [...DEFAULT_INPUT.move] };
  let fi = 0;

  for (let k = 0; k < opts.ticks && s.status === 'playing'; k++) {
    // 1. Áp frame của tick k (trường vắng giữ giá trị cũ).
    while (fi < frames.length && frames[fi].tick <= k) {
      const f = frames[fi++];
      if (f.tick !== k) continue;
      if (f.move) input.move = [f.move[0], f.move[1]];
      if (f.cam_yaw_deg !== undefined) input.cam_yaw_deg = f.cam_yaw_deg;
      if (f.jump !== undefined) input.jump = f.jump;
      if (f.interact !== undefined) input.interact = f.interact;
      if (f.pulse !== undefined) input.pulse = f.pulse;
      if (f.dash !== undefined) input.dash = f.dash;
      if (f.pause !== undefined) input.pause = f.pause;
    }
    for (const e of step(s, input)) {
      lines.push(JSON.stringify({ type: 'event', tick: s.tick, name: e.name, data: e.data }));
    }
    if (s.tick % opts.snapshotEvery === 0) lines.push(JSON.stringify(toSnapshot(s)));
  }

  lines.push(JSON.stringify({ type: 'end', ticks: s.tick, state: outputState(s), score: s.score }));
  return lines;
}
