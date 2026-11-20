import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { runHeadless } from '../src/headless/run';
import { FormatError, parseArgs, parseInputs, parseScenario } from '../src/headless/parse';

const dir = mkdtempSync(join(tmpdir(), 'ddl-'));
const tsx = join(process.cwd(), 'node_modules', '.bin', 'tsx');

function cli(args: string[]) {
  const r = spawnSync(tsx, ['src/headless/cli.ts', ...args], { encoding: 'utf8' });
  return { code: r.status, stderr: r.stderr };
}
function file(name: string, content: string) {
  const p = join(dir, name);
  writeFileSync(p, content);
  return p;
}

const walk = {
  frames: [
    { tick: 0, move: [0.3, 1], cam_yaw_deg: 30 },
    { tick: 200, pulse: true },
    { tick: 201, pulse: false, move: [-1, 0] },
    { tick: 900, jump: true },
  ],
};

describe('Headless', () => {
  it('AC14: cùng seed + input → output giống hệt; seed khác → khác', () => {
    const frames = parseInputs(JSON.stringify(walk));
    const a = runHeadless({ seed: 42, ticks: 3000, snapshotEvery: 10, frames });
    const b = runHeadless({ seed: 42, ticks: 3000, snapshotEvery: 10, frames });
    const c = runHeadless({ seed: 43, ticks: 3000, snapshotEvery: 10, frames });
    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
    expect(a.length).toBeGreaterThan(10);
  });

  it('AC14: hai lần chạy CLI cho file giống hệt từng byte', () => {
    const inputs = file('walk.json', JSON.stringify(walk));
    const o1 = join(dir, 'o1.jsonl');
    const o2 = join(dir, 'o2.jsonl');
    expect(cli(['--seed', '7', '--night', '1', '--inputs', inputs, '--ticks', '1200', '--out', o1]).code).toBe(0);
    expect(cli(['--seed', '7', '--night', '1', '--inputs', inputs, '--ticks', '1200', '--out', o2]).code).toBe(0);
    expect(readFileSync(o1, 'utf8')).toBe(readFileSync(o2, 'utf8'));
  });

  it('AC15: tick không tăng nghiêm ngặt → mã thoát 2', () => {
    const bad = file('dup.json', JSON.stringify({ frames: [{ tick: 5 }, { tick: 5 }] }));
    const r = cli(['--seed', '1', '--night', '1', '--inputs', bad, '--ticks', '10', '--out', join(dir, 'x.jsonl')]);
    expect(r.code).toBe(2);
    expect(r.stderr).toMatch(/tăng nghiêm ngặt/);
    const dec = file('dec.json', JSON.stringify({ frames: [{ tick: 5 }, { tick: 3 }] }));
    expect(cli(['--seed', '1', '--night', '1', '--inputs', dec, '--ticks', '10', '--out', join(dir, 'x.jsonl')]).code).toBe(2);
  });

  it('AC15: JSON hỏng / file không tồn tại / scenario sai → mã thoát 2', () => {
    const out = join(dir, 'x.jsonl');
    const broken = file('broken.json', '{"frames": [ {"tick": 0, ');
    const r = cli(['--seed', '1', '--night', '1', '--inputs', broken, '--ticks', '10', '--out', out]);
    expect(r.code).toBe(2);
    expect(r.stderr).toMatch(/JSON hỏng/);
    expect(cli(['--seed', '1', '--night', '1', '--inputs', join(dir, 'nope.json'), '--ticks', '10', '--out', out]).code).toBe(2);
    const badSc = file('sc.json', JSON.stringify({ lanterns: [{ id: 'L9' }] }));
    expect(cli(['--seed', '1', '--night', '1', '--scenario', badSc, '--ticks', '10', '--out', out]).code).toBe(2);
  });

  it('AC15: sai tham số → mã thoát 2', () => {
    const out = join(dir, 'x.jsonl');
    expect(cli(['--seed', '1', '--night', '1', '--out', out]).code).toBe(2); // thiếu --ticks
    expect(cli(['--seed', 'abc', '--night', '1', '--ticks', '5', '--out', out]).code).toBe(2);
    expect(cli(['--seed', '1', '--night', '2', '--ticks', '5', '--out', out]).code).toBe(2);
    expect(cli(['--seed', '1', '--night', '1', '--ticks', '5', '--out', out, '--bogus', '1']).code).toBe(2);
  });

  it('AC16: chạy hợp lệ → mã thoát 0, snapshot tick 0/10/20, dòng cuối là end', () => {
    const out = join(dir, 'ok.jsonl');
    const sc = file('quiet.json', JSON.stringify({ random_motes: false, random_shades: false, motes: [], shades: [] }));
    const r = cli(['--seed', '1', '--night', '1', '--scenario', sc, '--ticks', '25', '--out', out]);
    expect(r.code).toBe(0);
    const lines = readFileSync(out, 'utf8').trimEnd().split('\n').map((l) => JSON.parse(l));
    expect(lines.filter((l) => l.type === 'snapshot').map((l) => l.tick)).toEqual([0, 10, 20]);
    expect(lines.at(-1)).toEqual({ type: 'end', ticks: 25, state: 'playing', score: 0 });
    expect(lines[0]).toMatchObject({ type: 'snapshot', tick: 0, sim_tick: 0, state: 'playing', time_left_s: 300 });
    expect(Object.keys(lines[0])).toEqual([
      'type', 'tick', 'sim_tick', 'state', 'time_left_s', 'score', 'player', 'lanterns', 'shades', 'motes_active', 'motes',
    ]);
  });

  it('AC16: --snapshot-every tùy chỉnh và game kết thúc sớm vẫn có end cuối cùng', () => {
    const out = join(dir, 'dawn.jsonl');
    const sc = file('dawn.json', JSON.stringify({ random_motes: false, random_shades: false, time_left_s: 0.2 }));
    const r = cli(['--seed', '1', '--night', '1', '--scenario', sc, '--ticks', '500', '--out', out, '--snapshot-every', '5']);
    expect(r.code).toBe(0);
    const lines = readFileSync(out, 'utf8').trimEnd().split('\n').map((l) => JSON.parse(l));
    expect(lines.filter((l) => l.type === 'snapshot').map((l) => l.tick)).toEqual([0, 5, 10]);
    expect(lines.at(-1)).toEqual({ type: 'end', ticks: 12, state: 'lost', score: 0 });
  });

  it('parser: kiểm tra kiểu từng trường', () => {
    expect(() => parseInputs('{"frames":[{"tick":0,"move":[2,0]}]}')).toThrow(FormatError);
    expect(() => parseInputs('{"frames":[{"tick":-1}]}')).toThrow(FormatError);
    expect(() => parseInputs('{"frames":[{"tick":0,"pulse":"yes"}]}')).toThrow(FormatError);
    expect(() => parseInputs('[]')).toThrow(FormatError);
    expect(() => parseScenario('{"player":{"pos":[0,0]}}')).toThrow(FormatError);
    expect(() => parseScenario('{"shades":[{"id":"S1","pos":[1,0,0]},{"id":"S1","pos":[2,0,0]}]}')).toThrow(FormatError);
    expect(parseArgs(['--seed', '3', '--night', '1', '--ticks', '9', '--out', 'o'])).toEqual({
      seed: 3, night: 1, ticks: 9, out: 'o', scenario: undefined, inputs: undefined, snapshotEvery: 10,
    });
  });
});
