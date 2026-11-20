import { TUNING } from '../sim/contract';
import { lanternIds } from '../sim/world';
import type { InputFrame, Scenario, Vec3 } from '../sim/types';

/** Lỗi tham số / định dạng file → CLI thoát với mã 2. */
export class FormatError extends Error {}

export interface HeadlessArgs {
  seed: number;
  night: number;
  ticks: number;
  out: string;
  scenario?: string;
  inputs?: string;
  snapshotEvery: number;
}

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isInt = (v: unknown): v is number => Number.isSafeInteger(v);

function parseIntArg(name: string, raw: string, min: number): number {
  if (!/^-?\d+$/.test(raw)) throw new FormatError(`${name} phải là số nguyên: "${raw}"`);
  const n = Number(raw);
  if (!Number.isSafeInteger(n) || n < min) throw new FormatError(`${name} phải ≥ ${min}: ${raw}`);
  return n;
}

export function parseArgs(argv: string[]): HeadlessArgs {
  const known = ['--seed', '--night', '--ticks', '--out', '--scenario', '--inputs', '--snapshot-every'];
  const v: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    if (!known.includes(flag)) throw new FormatError(`tham số không hợp lệ: ${flag}`);
    if (flag in v) throw new FormatError(`tham số bị lặp: ${flag}`);
    const val = argv[i + 1];
    if (val === undefined || val.startsWith('--')) throw new FormatError(`thiếu giá trị cho ${flag}`);
    v[flag] = val;
    i++;
  }
  for (const req of ['--seed', '--night', '--ticks', '--out']) {
    if (!(req in v)) throw new FormatError(`thiếu tham số bắt buộc ${req}`);
  }
  const night = parseIntArg('--night', v['--night'], 1);
  if (night !== 1) throw new FormatError(`chỉ hỗ trợ --night 1, nhận ${night}`);
  return {
    seed: parseIntArg('--seed', v['--seed'], Number.MIN_SAFE_INTEGER),
    night,
    ticks: parseIntArg('--ticks', v['--ticks'], 0),
    out: v['--out'],
    scenario: v['--scenario'],
    inputs: v['--inputs'],
    snapshotEvery: v['--snapshot-every'] ? parseIntArg('--snapshot-every', v['--snapshot-every'], 1) : 10,
  };
}

function parseJson(text: string, what: string): unknown {
  try {
    return JSON.parse(text);
  } catch (e) {
    throw new FormatError(`${what}: JSON hỏng (${(e as Error).message})`);
  }
}

function bool(v: unknown, where: string): boolean {
  if (typeof v !== 'boolean') throw new FormatError(`${where} phải là boolean`);
  return v;
}

function vec3(v: unknown, where: string): Vec3 {
  if (!Array.isArray(v) || v.length !== 3 || !v.every(isNum)) {
    throw new FormatError(`${where} phải là [x, y, z] số`);
  }
  return [v[0], v[1], v[2]];
}

/** File inputs (Test Contract mục C). */
export function parseInputs(text: string): InputFrame[] {
  const root = parseJson(text, 'inputs');
  if (!isObj(root) || !Array.isArray(root.frames)) {
    throw new FormatError('inputs: cần đối tượng có mảng "frames"');
  }
  const frames: InputFrame[] = [];
  let lastTick = -1;
  root.frames.forEach((f: unknown, i: number) => {
    const at = `inputs.frames[${i}]`;
    if (!isObj(f)) throw new FormatError(`${at} phải là đối tượng`);
    if (!isInt(f.tick) || f.tick < 0) throw new FormatError(`${at}.tick phải là số nguyên ≥ 0`);
    if (f.tick <= lastTick) throw new FormatError(`${at}.tick phải tăng nghiêm ngặt (${f.tick} ≤ ${lastTick})`);
    lastTick = f.tick;
    const frame: InputFrame = { tick: f.tick };
    if (f.move !== undefined) {
      const m = f.move;
      if (!Array.isArray(m) || m.length !== 2 || !m.every((x) => isNum(x) && x >= -1 && x <= 1)) {
        throw new FormatError(`${at}.move phải là [x, z] trong [-1, 1]`);
      }
      frame.move = [m[0], m[1]];
    }
    if (f.cam_yaw_deg !== undefined) {
      if (!isNum(f.cam_yaw_deg)) throw new FormatError(`${at}.cam_yaw_deg phải là số`);
      frame.cam_yaw_deg = f.cam_yaw_deg;
    }
    for (const k of ['jump', 'interact', 'pulse'] as const) {
      if (f[k] !== undefined) frame[k] = bool(f[k], `${at}.${k}`);
    }
    // "dash" (nếu có) không dùng ở Phase 1 nhưng vẫn phải đúng kiểu.
    if (f.dash !== undefined) bool(f.dash, `${at}.dash`);
    frames.push(frame);
  });
  return frames;
}

/** File scenario (Test Contract mục D). */
export function parseScenario(text: string): Scenario {
  const root = parseJson(text, 'scenario');
  if (!isObj(root)) throw new FormatError('scenario phải là đối tượng JSON');
  const sc: Scenario = {};

  if (root.player !== undefined) {
    const p = root.player;
    if (!isObj(p)) throw new FormatError('scenario.player phải là đối tượng');
    sc.player = {};
    if (p.pos !== undefined) sc.player.pos = vec3(p.pos, 'scenario.player.pos');
    if (p.carried !== undefined) {
      if (!isInt(p.carried) || p.carried < 0) throw new FormatError('scenario.player.carried phải là số nguyên ≥ 0');
      sc.player.carried = p.carried;
    }
    if (p.flames !== undefined) {
      if (!isInt(p.flames) || p.flames < 1) throw new FormatError('scenario.player.flames phải là số nguyên ≥ 1');
      sc.player.flames = p.flames;
    }
  }
  if (root.random_motes !== undefined) sc.random_motes = bool(root.random_motes, 'scenario.random_motes');
  if (root.random_shades !== undefined) sc.random_shades = bool(root.random_shades, 'scenario.random_shades');

  if (root.motes !== undefined) {
    if (!Array.isArray(root.motes)) throw new FormatError('scenario.motes phải là mảng');
    sc.motes = root.motes.map((m: unknown, i: number) => vec3(m, `scenario.motes[${i}]`));
  }

  if (root.shades !== undefined) {
    if (!Array.isArray(root.shades)) throw new FormatError('scenario.shades phải là mảng');
    const seen = new Set<string>();
    sc.shades = root.shades.map((x: unknown, i: number) => {
      const at = `scenario.shades[${i}]`;
      if (!isObj(x)) throw new FormatError(`${at} phải là đối tượng`);
      const out: { id?: string; pos: Vec3 } = { pos: vec3(x.pos, `${at}.pos`) };
      if (x.id !== undefined) {
        if (typeof x.id !== 'string' || x.id === '') throw new FormatError(`${at}.id phải là chuỗi`);
        if (seen.has(x.id)) throw new FormatError(`${at}.id bị trùng: ${x.id}`);
        seen.add(x.id);
        out.id = x.id;
      }
      return out;
    });
  }

  if (root.lanterns !== undefined) {
    if (!Array.isArray(root.lanterns)) throw new FormatError('scenario.lanterns phải là mảng');
    const ids = lanternIds();
    sc.lanterns = root.lanterns.map((x: unknown, i: number) => {
      const at = `scenario.lanterns[${i}]`;
      if (!isObj(x)) throw new FormatError(`${at} phải là đối tượng`);
      if (typeof x.id !== 'string' || !ids.includes(x.id)) {
        throw new FormatError(`${at}.id phải là một trong ${ids.join(', ')}`);
      }
      const out: { id: string; pos?: Vec3; deposited?: number; lit?: boolean } = { id: x.id };
      if (x.pos !== undefined) out.pos = vec3(x.pos, `${at}.pos`);
      if (x.deposited !== undefined) {
        if (!isInt(x.deposited) || x.deposited < 0 || x.deposited > TUNING.lantern_cost) {
          throw new FormatError(`${at}.deposited phải là số nguyên trong [0, ${TUNING.lantern_cost}]`);
        }
        out.deposited = x.deposited;
      }
      if (x.lit !== undefined) out.lit = bool(x.lit, `${at}.lit`);
      return out;
    });
  }

  if (root.time_left_s !== undefined) {
    if (!isNum(root.time_left_s) || root.time_left_s <= 0) {
      throw new FormatError('scenario.time_left_s phải là số > 0');
    }
    sc.time_left_s = root.time_left_s;
  }
  return sc;
}
