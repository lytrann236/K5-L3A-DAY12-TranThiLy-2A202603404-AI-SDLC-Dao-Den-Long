// Soak test Phase 4: npx tsx scripts/soak.ts --seed 7 --nights 10 --out soak.json
// 10 Đêm liên tiếp trong cùng một tiến trình (1→2→3 xoay vòng), Đêm i dùng seed = base + i (i = 1…N).
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import vm from 'node:vm';
import v8 from 'node:v8';
import { mulberry32 } from '../src/sim/rng';
import { step } from '../src/sim/step';
import { DEFAULT_INPUT } from '../src/sim/types';
import type { InputState } from '../src/sim/types';
import { createGame } from '../src/sim/world';

function arg(name: string, def: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] !== undefined ? process.argv[i + 1] : def;
}
const baseSeed = Number(arg('seed', '7'));
const nights = Number(arg('nights', '10'));
const out = resolve(arg('out', 'soak.json'));

// Ép GC trước khi đo RSS để số đo phản ánh rò rỉ thật, không phải rác chưa dọn.
v8.setFlagsFromString('--expose-gc');
const gc = vm.runInNewContext('gc') as () => void;
const rssMb = () => {
  gc();
  return Math.round(process.memoryUsage().rss / 2 ** 20);
};

/** Chạy một Đêm tới khi kết thúc với input ngẫu nhiên theo seed (ticket-04 mục 2). */
function playNight(night: number, seed: number): 'won' | 'lost' {
  const s = createGame(seed, {}, night);
  const rng = mulberry32(seed ^ 0x5eed);
  const input: InputState = { ...DEFAULT_INPUT, move: [0, 0] };
  for (let k = 0; s.status === 'playing'; k++) {
    if (k % 30 === 0) {
      const a = rng() * Math.PI * 2; // chọn lại hướng mỗi 30 tick
      input.move = [Math.cos(a), Math.sin(a)];
    }
    input.jump = rng() < 0.05;
    input.dash = rng() < 0.03;
    input.pulse = rng() < 0.02;
    input.interact = rng() < 0.1;
    step(s, input);
    if (k > 1_000_000) throw new Error('Đêm không kết thúc');
  }
  return s.status === 'won' ? 'won' : 'lost';
}

const t0 = performance.now();
let crashes = 0;
const results: string[] = [];
let memStart = 0;
for (let i = 1; i <= nights; i++) {
  const night = ((i - 1) % 3) + 1;
  try {
    if (i === 1) {
      // Tải xong Đêm đầu rồi chạy 600 tick làm nóng JIT: không có bước này RSS đầu đo lúc mã còn nguội,
      // nên mem_end/mem_start dao động 1.1–1.25 dù heap JS phẳng (kiểm tra heapUsed ≈ 9 MB qua 600 Đêm).
      const warm = createGame(baseSeed + i, {}, night);
      for (let k = 0; k < 600 && warm.status === 'playing'; k++) step(warm, DEFAULT_INPUT);
      memStart = rssMb();
    }
    results.push(playNight(night, baseSeed + i));
  } catch (e) {
    crashes++;
    results.push('crashed');
    console.error(`Đêm ${i} (night ${night}) lỗi:`, e);
  }
}
createGame(baseSeed + nights, {}, ((nights - 1) % 3) + 1); // reset về trạng thái đầu của Đêm cuối
const memEnd = rssMb();
const result = {
  nights,
  crashes,
  results,
  mem_start_mb: memStart,
  mem_end_mb: memEnd,
  duration_s: Math.round(((performance.now() - t0) / 1000) * 10) / 10,
};
writeFileSync(out, JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result));
process.exit(crashes === 0 && memEnd <= 1.2 * memStart ? 0 : 1);
