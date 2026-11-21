// Chụp ảnh giao diện để tự kiểm tra bằng mắt: npm run shot [-- <thư mục>]  (mặc định /tmp/shots)
// Dùng Vite dev server qua API + Chromium của Playwright, mở ?seed=1.
// WebGL phần mềm rất chậm, nên mọi bước chờ đều tính theo THỜI GIAN GAME trên HUD (không theo giây thật).
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from 'playwright';
import type { Page } from 'playwright';
import { createServer } from 'vite';

const outDir = resolve(process.argv[2] ?? '/tmp/shots');
mkdirSync(outDir, { recursive: true });

const server = await createServer({ logLevel: 'warn', server: { port: 5199 } });
await server.listen();
const base = server.resolvedUrls?.local[0] ?? 'http://localhost:5199/';

const browser = await chromium.launch({
  // WebGL phần mềm: chạy được cả khi không có GPU.
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const errors: string[] = [];

/** Thời gian game còn lại (giây) đọc từ HUD, hoặc null nếu chưa có. */
async function timeLeft(page: Page): Promise<number | null> {
  const text = await page.locator('[data-k="time"]').textContent();
  const m = /^(\d+):(\d{2})$/.exec(text ?? '');
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

/** Chờ cho tới khi `gameSeconds` giây game trôi qua (theo HUD). */
async function waitGame(page: Page, gameSeconds: number): Promise<void> {
  const start = (await timeLeft(page)) ?? 300;
  await page.waitForFunction(
    ([from, n]) => {
      const t = document.querySelector('[data-k="time"]')?.textContent ?? '';
      const m = /^(\d+):(\d{2})$/.exec(t);
      return m !== null && Number(m[1]) * 60 + Number(m[2]) <= from - n;
    },
    [start, gameSeconds] as const,
    { timeout: 120_000, polling: 100 },
  );
}

async function open(width: number, height: number, dpr: number, night = 1, extra = ''): Promise<Page> {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: dpr });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => m.type() === 'error' && errors.push(`console: ${m.text()}`));
  await page.goto(`${base}?seed=1&night=${night}${extra}`);
  await page.waitForSelector('[data-k="time"]');
  await waitGame(page, 1); // đã có khung hình và sim đang chạy
  return page;
}

const shot = async (page: Page, name: string) => {
  const path = `${outDir}/${name}.png`;
  await page.screenshot({ path });
  console.log(path);
};
/** Giữ phím cho tới khi `gameSeconds` giây game trôi qua. */
async function holdGame(page: Page, key: string, gameSeconds: number): Promise<void> {
  await page.keyboard.down(key);
  await waitGame(page, gameSeconds);
  await page.keyboard.up(key);
}
/** Giữ phím theo giây thật (xoay camera dùng dt thật, không phải tick). */
async function holdReal(page: Page, key: string, ms: number): Promise<void> {
  await page.keyboard.down(key);
  await page.waitForTimeout(ms);
  await page.keyboard.up(key);
}

try {
  // Toàn cảnh.
  const wide = await open(1280, 800, 1);
  await shot(wide, '01-start');
  await holdGame(wide, 'KeyW', 3.4); // đi về phía đèn L1 (0,0,22)
  await shot(wide, '02-near-lantern');
  // Tạm dừng (Esc): overlay Tiếp tục / Chơi lại Đêm / Về menu.
  await wide.keyboard.press('Escape');
  await wide.waitForSelector('#overlay.paused');
  await shot(wide, '05-paused');
  await wide.click('button[data-action="resume"]');
  await wide.waitForSelector('#overlay[hidden]', { state: 'attached' });
  await wide.click('canvas', { position: { x: 5, y: 5 } }).catch(() => {});
  // Về menu qua phím + nút.
  await wide.keyboard.press('Escape');
  await wide.click('button[data-action="menu"]');
  await wide.waitForSelector('#overlay.menu');
  await shot(wide, '06-menu');
  await wide.close();

  // Đêm 2: hai đảo, cầu, bục. Đêm 3: tầng, dốc, tháp.
  const n2 = await open(1280, 800, 1, 2);
  await shot(n2, '07-night2-start');
  await n2.close();
  const n3 = await open(1280, 800, 1, 3);
  await shot(n3, '08-night3-start');
  await n3.close();
  // Toàn cảnh bản đồ (camera kéo xa) để kiểm tra hình học.
  const n2far = await open(1280, 800, 1, 2, '&cam=75');
  await shot(n2far, '09-night2-overview');
  await n2far.close();
  const n3far = await open(1280, 800, 1, 3, '&cam=60');
  await shot(n3far, '10-night3-overview');
  await n3far.close();

  // Cận cảnh nhân vật (cửa sổ nhỏ, độ phân giải gấp đôi).
  const close = await open(640, 480, 2);
  await shot(close, '03-player-back');
  await holdGame(close, 'KeyW', 0.6); // đi một đoạn để nhân vật quay mặt theo hướng đi
  await holdReal(close, 'ArrowLeft', 1500); // xoay camera ~180° để nhìn mặt trước
  await close.waitForTimeout(1500);
  await shot(close, '04-player-front');
  await close.close();
} finally {
  await browser.close();
  await server.close();
}
if (errors.length > 0) {
  console.error(errors.join('\n'));
  process.exitCode = 1;
}
