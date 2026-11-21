import './style.css';
import { failureMessage } from './render/feedback';
import { createHud } from './render/hud';
import { createInput } from './render/input';
import { createMenu } from './render/menu';
import { runBench } from './render/bench';
import { createWorld } from './render/scene';
import { advance } from './render/timestep';
import { SUPPORTED_NIGHTS } from './sim/maps';
import { step } from './sim/step';
import { DEFAULT_INPUT } from './sim/types';
import type { Scenario } from './sim/types';
import { createGame } from './sim/world';

const params = new URLSearchParams(location.search);
/** ?seed=<số nguyên> cố định seed; không có thì ngẫu nhiên (Math.random chỉ dùng ở đây, không trong sim). */
const urlSeedRaw = params.get('seed');
const urlSeed = urlSeedRaw !== null && /^-?\d+$/.test(urlSeedRaw) ? Number(urlSeedRaw) : null;
const pickSeed = () => urlSeed ?? Math.floor(Math.random() * 2 ** 31);
/** ?night=1|2|3 bỏ qua menu và vào thẳng Đêm đó. */
const urlNightRaw = params.get('night');
const urlNight = urlNightRaw !== null && /^\d+$/.test(urlNightRaw) && SUPPORTED_NIGHTS.includes(Number(urlNightRaw)) ? Number(urlNightRaw) : null;

/**
 * ?demo=fuel (chỉ trình duyệt, dùng cho ảnh kiểm tra Phase 3): L1 sáng fuel 25 (nhấp nháy), L2 sáng fuel 80,
 * successful_lights 2 (HUD x/14). Không ảnh hưởng headless.
 */
const demoScenario: Scenario =
  params.get('demo') === 'fuel'
    ? {
        player: { carried: 6, successful_lights: 2 },
        lanterns: [
          { id: 'L1', lit: true, fuel: 25 },
          { id: 'L2', lit: true, fuel: 80 },
        ],
      }
    : {};

const canvas = document.querySelector<HTMLCanvasElement>('#game')!;
const world = createWorld(canvas);
const input = createInput(canvas);
const hud = createHud(document.querySelector<HTMLElement>('#hud')!);

/** 'menu': chưa chơi; 'playing': sim chạy (kể cả khi sim tạm dừng, xem state.paused); 'ended': thắng/thua. */
/** ?bench=1: chế độ đo hiệu năng (Phase 4), cảnh chuẩn riêng, không có menu/HUD. */
const benchMode = params.get('bench') === '1';
let mode: 'menu' | 'playing' | 'ended' = urlNight === null && !benchMode ? 'menu' : 'playing';
let night = urlNight ?? 1;
let seed = pickSeed();
let state = createGame(seed, demoScenario, night);
let accMs = 0;

function startNight(n: number): void {
  night = n;
  seed = pickSeed();
  state = createGame(seed, {}, night);
  accMs = 0;
  input.reset();
  hud.notify('', performance.now());
  mode = 'playing';
  menu.hide();
}

/** Bật/tắt tạm dừng bằng chính input `pause` của sim (sườn false → true), kèm một bước nhả nút. */
function togglePause(): void {
  if (mode !== 'playing' || state.status !== 'playing') return;
  step(state, { ...DEFAULT_INPUT, pause: true });
  step(state, { ...DEFAULT_INPUT, pause: false });
  if (state.paused) menu.show('paused', { night, score: state.score, hasNext: false });
  else menu.hide();
}

const menu = createMenu(document.querySelector<HTMLElement>('#overlay')!, {
  startNight,
  resume: togglePause,
  restart: () => startNight(night),
  toMenu: () => {
    mode = 'menu';
    state = createGame(seed, {}, night); // cảnh nền cho menu
    menu.show('menu', { night, score: 0, hasNext: false });
  },
  next: () => startNight(Math.min(night + 1, SUPPORTED_NIGHTS.length)),
});
if (mode === 'menu') menu.show('menu', { night, score: 0, hasNext: false });

window.addEventListener('resize', () => world.resize());
world.resize();

let last = performance.now();
function frame(now: number): void {
  const dtMs = now - last;
  last = now;
  input.update(dtMs / 1000);

  if (input.consumePause()) togglePause();
  if (input.consumeRestart() && mode !== 'menu') startNight(night);

  if (mode === 'playing' && !state.paused && state.status === 'playing') {
    const r = advance(accMs, dtMs);
    accMs = r.accMs;
    for (let i = 0; i < r.ticks && state.status === 'playing'; i++) {
      const prev = { interact: state.prevButtons.interact, pulse: state.prevButtons.pulse };
      const sampled = input.sample();
      const events = step(state, sampled); // CHÍNH logic của src/sim, không có logic game lần hai
      const notice = failureMessage(prev, sampled, events, state); // chỉ hiển thị, không đổi sim
      if (notice) hud.notify(notice, now);
    }
    if (state.status !== 'playing') {
      mode = 'ended';
      const over = state.status === 'won' ? 'won' : 'lost';
      menu.show(over, {
        night,
        score: state.score,
        hasNext: night < SUPPORTED_NIGHTS.length,
        reason: state.player.flames <= 0 ? 'no_flames' : 'dawn',
      });
    }
  }

  world.render(state, now / 1000, input.yawDeg, input.pitchDeg);
  hud.update(state, seed, now);
  requestAnimationFrame(frame);
}
if (benchMode) {
  document.querySelector<HTMLElement>('#hud')!.hidden = true;
  runBench(world, params);
} else {
  requestAnimationFrame(frame);
}
