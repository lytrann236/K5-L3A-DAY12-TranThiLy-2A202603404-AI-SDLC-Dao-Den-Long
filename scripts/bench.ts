// Benchmark Phase 4: npx tsx scripts/bench.ts --seed 42 --duration 30 --out bench.json
// Dựng bản build (nếu chưa có), phục vụ bằng vite preview, mở Chromium CÓ CỬA SỔ 1280×720
// với ?bench=1 và tính số liệu từ dt từng khung do trang trả về (công thức: ticket-04 mục 1).
import { execSync } from 'node:child_process';
import { existsSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import { resolve } from 'node:path';
import { chromium } from 'playwright';
import { preview } from 'vite';
import contract from '../game.contract.json' with { type: 'json' };
import type { BenchRaw } from '../src/render/bench';

const startEpochMs = Date.now() - process.uptime() * 1000; // lúc tiến trình bắt đầu

function arg(name: string, def: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] !== undefined ? process.argv[i + 1] : def;
}
const seed = Number(arg('seed', '42'));
const duration = Number(arg('duration', '30'));
const out = resolve(arg('out', 'bench.json'));

/** Tính các số liệu từ dt (ms) từng khung. */
export function metrics(dts: number[]) {
  const n = dts.length;
  const sum = dts.reduce((a, b) => a + b, 0);
  const sorted = [...dts].sort((a, b) => b - a); // giảm dần
  const k = Math.max(1, Math.ceil(0.01 * n));
  const worst = sorted.slice(0, k).reduce((a, b) => a + b, 0) / k;
  const asc = [...dts].sort((a, b) => a - b);
  // Phân vị 95 (nearest-rank): phần tử thứ ceil(0.95 × N) theo thứ tự tăng dần.
  const p95 = asc[Math.max(1, Math.ceil(0.95 * n)) - 1];
  return { frames: n, avg_fps: (1000 * n) / sum, p1_low_fps: 1000 / worst, frame_ms_p95: p95 };
}

if (!existsSync('dist/index.html')) execSync('npm run build', { stdio: 'inherit' });
const server = await preview({ logLevel: 'warn', preview: { port: 4199, strictPort: true } });
const base = server.resolvedUrls?.local[0] ?? 'http://localhost:4199/';

// Có cửa sổ (headless: false). Tắt vsync / giới hạn tốc độ khung của Chromium bằng cờ dòng lệnh.
const browser = await chromium.launch({
  headless: false,
  args: ['--window-size=1280,720', '--disable-gpu-vsync', '--disable-frame-rate-limit'],
});
let code = 0;
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${base}?bench=1&seed=${seed}&duration=${duration}`);
  await page.waitForFunction(() => window.__bench?.done === true, undefined, {
    timeout: (duration + 60) * 1000,
    polling: 250,
  });
  const raw = (await page.evaluate(() => window.__bench)) as BenchRaw;
  const gl = await page.evaluate(() => {
    const c = document.createElement('canvas');
    const g = c.getContext('webgl2');
    const ext = g?.getExtension('WEBGL_debug_renderer_info');
    return g && ext ? String(g.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : 'không rõ';
  });
  const m = metrics(raw.dts);
  const round1 = (x: number) => Math.round(x * 10) / 10;
  const result = {
    contract_version: contract.contract_version,
    avg_fps: round1(m.avg_fps),
    p1_low_fps: round1(m.p1_low_fps),
    frame_ms_p95: round1(m.frame_ms_p95),
    frames: m.frames,
    load_ms: Math.round(raw.firstFrameEpochMs - startEpochMs),
    // Bản web: trình duyệt không cho trang đọc RSS của tiến trình; đo từ ngoài sẽ lẫn RSS của cả Chromium
    // (nhiều tiến trình), không phải "bộ nhớ của game" nên ghi null.
    peak_mem_mb: null,
    vsync_off: m.avg_fps > 75, // cờ tắt vsync đã truyền; chỉ coi là tắt được khi fps vượt hẳn 60 Hz
    renderer: `Three.js r187 (WebGL2) trên Chromium ${browser.version()} (Playwright, có cửa sổ 1280×720); GPU: ${gl}`,
    os: `${os.type()} ${os.release()} ${os.arch()}, ${os.cpus()[0]?.model ?? 'CPU?'}, ${Math.round(os.totalmem() / 2 ** 30)} GB RAM`,
    scene: { shades: raw.shades, motes: raw.motes, seed, duration_s: duration },
  };
  writeFileSync(out, JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result, null, 2));
  if (errors.length > 0) {
    console.error(errors.join('\n'));
    code = 1;
  }
} finally {
  await browser.close();
  await new Promise<void>((r) => server.httpServer.close(() => r()));
}
process.exit(code);
