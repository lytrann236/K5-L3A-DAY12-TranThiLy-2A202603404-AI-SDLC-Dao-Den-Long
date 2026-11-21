// Headless CLI theo Test Contract v1.2:
//   --seed <int> --night 1|2|3 [--scenario f.json] [--inputs f.json] --ticks <int> --out f.jsonl
//   [--snapshot-every <int, mặc định 10>]
// Đêm ngoài SUPPORTED_NIGHTS → mã thoát 2.
// Mã thoát: 0 = OK, 2 = tham số / file sai định dạng, 1 = lỗi khác.
import { readFileSync, writeFileSync } from 'node:fs';
import { SUPPORTED_NIGHTS } from '../sim/maps';
import { FormatError, parseArgs, parseInputs, parseScenario } from './parse';
import { runHeadless } from './run';

function readText(path: string, what: string): string {
  try {
    return readFileSync(path, 'utf8');
  } catch (e) {
    throw new FormatError(`không đọc được file ${what} "${path}": ${(e as Error).message}`);
  }
}

function main(): number {
  try {
    const args = parseArgs(process.argv.slice(2));
    if (!SUPPORTED_NIGHTS.includes(args.night)) {
      throw new FormatError(`--night ${args.night} chưa hỗ trợ`);
    }
    const scenario = args.scenario
      ? parseScenario(readText(args.scenario, 'scenario'), args.night)
      : undefined;
    const frames = args.inputs ? parseInputs(readText(args.inputs, 'inputs')) : undefined;
    const lines = runHeadless({
      seed: args.seed,
      night: args.night,
      ticks: args.ticks,
      snapshotEvery: args.snapshotEvery,
      scenario,
      frames,
    });
    writeFileSync(args.out, lines.join('\n') + '\n');
    return 0;
  } catch (e) {
    process.stderr.write(`lỗi: ${(e as Error).message}\n`);
    return e instanceof FormatError ? 2 : 1;
  }
}

process.exitCode = main();
