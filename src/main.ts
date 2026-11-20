import './style.css';
import { createHud } from './render/hud';
import { createInput } from './render/input';
import { createWorld } from './render/scene';
import { advance } from './render/timestep';
import { step } from './sim/step';
import { createGame } from './sim/world';

/** ?seed=<số nguyên> cố định seed; không có thì ngẫu nhiên (Math.random chỉ dùng ở đây, không trong sim). */
const urlSeedRaw = new URLSearchParams(location.search).get('seed');
const urlSeed = urlSeedRaw !== null && /^-?\d+$/.test(urlSeedRaw) ? Number(urlSeedRaw) : null;
const pickSeed = () => urlSeed ?? Math.floor(Math.random() * 2 ** 31);

const canvas = document.querySelector<HTMLCanvasElement>('#game')!;
const world = createWorld(canvas);
const input = createInput(canvas);
const hud = createHud(
  document.querySelector<HTMLElement>('#hud')!,
  document.querySelector<HTMLElement>('#overlay')!,
);

let seed = pickSeed();
let state = createGame(seed);
let accMs = 0;

window.addEventListener('resize', () => world.resize());
world.resize();

let last = performance.now();
function frame(now: number): void {
  const dtMs = now - last;
  last = now;
  input.update(dtMs / 1000);

  if (input.consumeRestart()) {
    seed = pickSeed(); // có ?seed= thì giữ nguyên, không thì seed ngẫu nhiên mới
    state = createGame(seed);
    accMs = 0;
    input.reset();
  }

  if (state.status === 'playing') {
    const r = advance(accMs, dtMs);
    accMs = r.accMs;
    for (let i = 0; i < r.ticks && state.status === 'playing'; i++) {
      step(state, input.sample()); // CHÍNH logic của src/sim, không có logic game lần hai
    }
  }

  world.render(state, now / 1000, input.yawDeg, input.pitchDeg);
  hud.update(state, seed);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
