import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { runHeadless } from '../src/headless/run';
import { FormatError, parseArgs, parseInputs, parseScenario } from '../src/headless/parse';
import { run } from './helpers';

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
    expect(cli(['--seed', '1', '--night', '1', '--ticks', '5', '--out', out, '--bogus', '1']).code).toBe(2);
  });

  // Sửa theo phase-2.md mục 2: "--night nhận 1, 2, 3". Ngoài 1…3 → mã 2. Việc 3 cài Đêm 2 nên
  // --night 2 chạy được (mã 0); Đêm 3 chưa cài (Việc 4) nên tạm thoát mã 2 "chưa hỗ trợ".
  it('AC2-51: --night ngoài 1…3 → mã 2; --night 2 chạy được; --night 3 tạm "chưa hỗ trợ" (mã 2)', () => {
    const out = join(dir, 'x.jsonl');
    for (const n of ['0', '4', '-1', '1.5']) {
      expect(cli(['--seed', '1', '--night', n, '--ticks', '5', '--out', out]).code).toBe(2);
    }
    const n2 = cli(['--seed', '1', '--night', '2', '--ticks', '5', '--out', out]);
    expect(n2.code).toBe(0);
    const n2lines = readFileSync(out, 'utf8').trim().split('\n').map((l) => JSON.parse(l));
    expect(n2lines[0]).toMatchObject({ type: 'snapshot', night: 2, time_left_s: 330 });
    expect(n2lines[1]).toEqual({ type: 'event', tick: 0, name: 'night_start', data: { night: 2 } });
    const n3 = cli(['--seed', '1', '--night', '3', '--ticks', '5', '--out', out]);
    expect(n3.code).toBe(2);
    expect(n3.stderr).toMatch(/chưa hỗ trợ/);
    expect(parseArgs(['--seed', '1', '--night', '3', '--ticks', '1', '--out', 'o']).night).toBe(3);
    expect(() => parseArgs(['--seed', '1', '--night', '4', '--ticks', '1', '--out', 'o'])).toThrow(FormatError);
  });

  // Sửa theo phase-2.md mục 2: thêm dòng night_start ở tick 0 và các trường snapshot v1.1.
  it('AC16 + AC2-52/53: mã thoát 0, snapshot tick 0/10/20, night_start sau snapshot tick 0, dòng cuối end', () => {
    const out = join(dir, 'ok.jsonl');
    const sc = file('quiet.json', JSON.stringify({ random_motes: false, random_shades: false, motes: [], shades: [] }));
    const r = cli(['--seed', '1', '--night', '1', '--scenario', sc, '--ticks', '25', '--out', out]);
    expect(r.code).toBe(0);
    const lines = readFileSync(out, 'utf8').trimEnd().split('\n').map((l) => JSON.parse(l));
    expect(lines.filter((l) => l.type === 'snapshot').map((l) => l.tick)).toEqual([0, 10, 20]);
    expect(lines.at(-1)).toEqual({ type: 'end', ticks: 25, state: 'playing', score: 0 });
    expect(lines[0]).toMatchObject({ type: 'snapshot', tick: 0, sim_tick: 0, state: 'playing', night: 1, time_left_s: 300 });
    expect(lines[1]).toEqual({ type: 'event', tick: 0, name: 'night_start', data: { night: 1 } });
    expect(lines.filter((l) => l.name === 'night_start')).toHaveLength(1);
    expect(Object.keys(lines[0])).toEqual([
      'type', 'tick', 'sim_tick', 'state', 'night', 'time_left_s', 'score', 'wind', 'player', 'lanterns',
      'shades', 'drifters', 'charms', 'motes_active', 'motes',
    ]);
    expect(lines[0].wind).toEqual({ active: false, dir_deg: 0 });
    expect(lines[0].player).toEqual({
      pos: [0, 0, 0], vel: [0, 0, 0], grounded: true, flames: 3, carried: 0,
      invuln: false, dash_cd_s: 0, pulse_cd_s: 0, charm_s: 0,
    });
    // Đêm 1 không có Gió Lạc / Bùa Gió: mảng rỗng nhưng vẫn có mặt.
    expect(lines[0].drifters).toEqual([]);
    expect(lines[0].charms).toEqual([]);
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

  it('AC2-52/53: snapshot mặc định có motes {id,pos,kind,ttl_s} và các bộ đếm theo giây', () => {
    const lines = runHeadless({
      seed: 2,
      ticks: 0,
      snapshotEvery: 1,
      scenario: { random_shades: false, player: { invuln_ticks: 30, dash_cd_ticks: 45, pulse_cd_ticks: 90, charm_ticks: 600 } },
    }).map((l) => JSON.parse(l));
    const s0 = lines[0];
    expect(s0.player).toMatchObject({ invuln: true, dash_cd_s: 0.75, pulse_cd_s: 1.5, charm_s: 10 });
    expect(Object.keys(s0.motes[0])).toEqual(['id', 'pos', 'kind', 'ttl_s']);
  });

  it('AC2-54/55: parser nhận trường v1.1 và từ chối sai kiểu', () => {
    const fr = parseInputs('{"frames":[{"tick":0,"dash":true,"pause":false}]}');
    expect(fr[0]).toEqual({ tick: 0, dash: true, pause: false });
    expect(() => parseInputs('{"frames":[{"tick":0,"dash":1}]}')).toThrow(FormatError);
    expect(() => parseInputs('{"frames":[{"tick":0,"pause":"yes"}]}')).toThrow(FormatError);

    const sc = parseScenario(
      JSON.stringify({
        player: { invuln_ticks: 5, dash_cd_ticks: 6, pulse_cd_ticks: 7, charm_ticks: 8 },
        random_drifters: false,
        wind_enabled: false,
        shades: [{ id: 'S1', pos: [1, 0, 0], state: 'stunned', state_ticks_left: 10 }],
        drifters: [{ id: 'D1', pos: [2, 0, 0], state: 'idle', stolen: 0 }],
        charms: [{ id: 'C1', pos: [3, 0, 0], available: false, respawn_ticks: 100 }],
        lanterns: [{ id: 'L1', deposited: 10 }],
      }),
    );
    expect(sc.player).toEqual({ invuln_ticks: 5, dash_cd_ticks: 6, pulse_cd_ticks: 7, charm_ticks: 8 });
    expect(sc.shades![0]).toEqual({ id: 'S1', pos: [1, 0, 0], state: 'stunned', state_ticks_left: 10 });
    expect(sc.drifters).toHaveLength(1);
    expect(sc.charms).toHaveLength(1);

    const bad = [
      '{"player":{"invuln_ticks":1.5}}',
      '{"player":{"dash_cd_ticks":-1}}',
      '{"random_drifters":"no"}',
      '{"wind_enabled":1}',
      '{"shades":[{"pos":[0,0,0],"state":"angry"}]}',
      '{"shades":[{"pos":[0,0,0],"state_ticks_left":-2}]}',
      '{"drifters":{}}',
      '{"drifters":[{"pos":[0,0,0],"state":"chasing"}]}',
      '{"charms":[{"id":"C1"}]}',
      '{"charms":[{"pos":[0,0,0],"available":"yes"}]}',
      '{"lanterns":[{"id":"L1","deposited":11}]}',
    ];
    for (const b of bad) expect(() => parseScenario(b), b).toThrow(FormatError);
  });


  // Chốt định dạng Việc 3 (phase-2.md 4.2): Gió Lạc thiếu state → idle, thiếu stolen → 0.
  it('AC2-54: drifters[] thiếu state → idle, thiếu stolen → 0 (trong snapshot tick 0)', () => {
    const sc = parseScenario('{"random_motes":false,"drifters":[{"pos":[5,0,5]},{"id":"D4","pos":[-5,0,5],"state":"flee"}]}', 2);
    const r = run({ night: 2, ticks: 0, scenario: sc });
    // Id vắng đặt tiếp sau id lớn nhất có tên (giống quy ước Bóng Mực): D4 có tên → con không tên là D5.
    expect(r.snap(0).drifters).toEqual([
      { id: 'D5', pos: [5, 1, 5], state: 'idle', stolen: 0 },
      { id: 'D4', pos: [-5, 1, 5], state: 'flee', stolen: 0 },
    ]);
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
