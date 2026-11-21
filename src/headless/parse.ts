import { TUNING } from '../sim/contract';
import { getMap } from '../sim/maps';
import { lanternIds } from '../sim/world';
import { DRIFTER_STATES, SHADE_STATES } from '../sim/types';
import type { DrifterState, InputFrame, Scenario, ShadeState, Vec3 } from '../sim/types';

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
  if (night > 3) throw new FormatError(`--night phải là 1, 2 hoặc 3, nhận ${night}`);
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
    for (const k of ['jump', 'interact', 'pulse', 'dash', 'pause'] as const) {
      if (f[k] !== undefined) frame[k] = bool(f[k], `${at}.${k}`);
    }
    frames.push(frame);
  });
  return frames;
}

function nonNegInt(v: unknown, where: string): number {
  if (!isInt(v) || v < 0) throw new FormatError(`${where} phải là số nguyên ≥ 0`);
  return v;
}

function optId(v: unknown, where: string, seen: Set<string>): string | undefined {
  if (v === undefined) return undefined;
  if (typeof v !== 'string' || v === '') throw new FormatError(`${where} phải là chuỗi`);
  if (seen.has(v)) throw new FormatError(`${where} bị trùng: ${v}`);
  seen.add(v);
  return v;
}

function oneOf<T extends string>(v: unknown, allowed: readonly T[], where: string): T {
  if (typeof v !== 'string' || !(allowed as readonly string[]).includes(v)) {
    throw new FormatError(`${where} phải là một trong ${allowed.join(', ')}`);
  }
  return v as T;
}

function arr(v: unknown, where: string): unknown[] {
  if (!Array.isArray(v)) throw new FormatError(`${where} phải là mảng`);
  return v;
}

/** File scenario (Test Contract mục D, v1.1). Id đèn kiểm theo bản đồ của Đêm. */
export function parseScenario(text: string, night = 1): Scenario {
  const root = parseJson(text, 'scenario');
  if (!isObj(root)) throw new FormatError('scenario phải là đối tượng JSON');
  const sc: Scenario = {};

  if (root.player !== undefined) {
    const p = root.player;
    if (!isObj(p)) throw new FormatError('scenario.player phải là đối tượng');
    sc.player = {};
    if (p.pos !== undefined) sc.player.pos = vec3(p.pos, 'scenario.player.pos');
    for (const k of [
      'carried',
      'flames',
      'invuln_ticks',
      'dash_cd_ticks',
      'pulse_cd_ticks',
      'charm_ticks',
    ] as const) {
      if (p[k] !== undefined) sc.player[k] = nonNegInt(p[k], `scenario.player.${k}`);
    }
  }
  for (const k of ['random_motes', 'random_shades', 'random_drifters', 'wind_enabled'] as const) {
    if (root[k] !== undefined) sc[k] = bool(root[k], `scenario.${k}`);
  }

  if (root.motes !== undefined) {
    if (!Array.isArray(root.motes)) throw new FormatError('scenario.motes phải là mảng');
    sc.motes = root.motes.map((m: unknown, i: number) => vec3(m, `scenario.motes[${i}]`));
  }

  if (root.shades !== undefined) {
    const seen = new Set<string>();
    sc.shades = arr(root.shades, 'scenario.shades').map((x, i) => {
      const at = `scenario.shades[${i}]`;
      if (!isObj(x)) throw new FormatError(`${at} phải là đối tượng`);
      const out: { id?: string; pos: Vec3; state?: ShadeState; state_ticks_left?: number } = {
        pos: vec3(x.pos, `${at}.pos`),
      };
      const id = optId(x.id, `${at}.id`, seen);
      if (id !== undefined) out.id = id;
      if (x.state !== undefined) out.state = oneOf(x.state, SHADE_STATES, `${at}.state`);
      if (x.state_ticks_left !== undefined) {
        out.state_ticks_left = nonNegInt(x.state_ticks_left, `${at}.state_ticks_left`);
      }
      return out;
    });
  }

  if (root.drifters !== undefined) {
    const seen = new Set<string>();
    sc.drifters = arr(root.drifters, 'scenario.drifters').map((x, i) => {
      const at = `scenario.drifters[${i}]`;
      if (!isObj(x)) throw new FormatError(`${at} phải là đối tượng`);
      const out: { id?: string; pos: Vec3; state?: DrifterState; stolen?: number } = {
        pos: vec3(x.pos, `${at}.pos`),
      };
      const id = optId(x.id, `${at}.id`, seen);
      if (id !== undefined) out.id = id;
      if (x.state !== undefined) out.state = oneOf(x.state, DRIFTER_STATES, `${at}.state`);
      if (x.stolen !== undefined) out.stolen = nonNegInt(x.stolen, `${at}.stolen`);
      return out;
    });
  }

  if (root.charms !== undefined) {
    const seen = new Set<string>();
    sc.charms = arr(root.charms, 'scenario.charms').map((x, i) => {
      const at = `scenario.charms[${i}]`;
      if (!isObj(x)) throw new FormatError(`${at} phải là đối tượng`);
      const out: { id?: string; pos?: Vec3; available?: boolean; respawn_ticks?: number } = {};
      const id = optId(x.id, `${at}.id`, seen);
      if (id !== undefined) out.id = id;
      if (x.pos !== undefined) out.pos = vec3(x.pos, `${at}.pos`);
      else {
        // Thiếu pos → vị trí chuẩn theo id (id vắng thì là C<i+1>).
        const std = getMap(night).charms.map((c) => c.id);
        const want = id ?? `C${i + 1}`;
        if (!std.includes(want)) {
          throw new FormatError(
            `${at}.pos bắt buộc khi id ${want} không phải bùa chuẩn của Đêm ${night}` +
              (std.length ? ` (${std.join(', ')})` : ''),
          );
        }
      }
      if (x.available !== undefined) out.available = bool(x.available, `${at}.available`);
      if (x.respawn_ticks !== undefined) out.respawn_ticks = nonNegInt(x.respawn_ticks, `${at}.respawn_ticks`);
      return out;
    });
  }

  if (root.lanterns !== undefined) {
    if (!Array.isArray(root.lanterns)) throw new FormatError('scenario.lanterns phải là mảng');
    const ids = lanternIds(night);
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
    if (!isNum(root.time_left_s) || root.time_left_s < 0) {
      throw new FormatError('scenario.time_left_s phải là số ≥ 0');
    }
    sc.time_left_s = root.time_left_s;
  }
  return sc;
}
