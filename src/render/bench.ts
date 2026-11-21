// Chế độ benchmark (Ticket-04 mục 1): ?bench=1&seed=42&duration=30. Cảnh chuẩn, không input, camera bay vòng.
// Chỉ chạy trong trình duyệt; headless/sim không đụng tới file này. Kết quả đọc qua window.__bench.
import { TUNING } from '../sim/contract';
import { ISLAND_RADIUS } from '../sim/constants';
import { distXZ } from '../sim/geom';
import { getMap } from '../sim/maps';
import { mulberry32 } from '../sim/rng';
import { step } from '../sim/step';
import { DEFAULT_INPUT } from '../sim/types';
import type { GameState, Scenario, Vec3 } from '../sim/types';
import { createGame } from '../sim/world';
import { FUEL_MAX_U } from '../sim/fuel';
import type { World } from './scene';
import { advance } from './timestep';

export const BENCH_SHADES = 200;
export const BENCH_MOTES = 100;
const WARMUP_S = 3;
const CAM_RADIUS = 30;
const CAM_HEIGHT = 15;
const CAM_PERIOD_S = 15;
/** Đủ xa Mây (0,0,0) để không bị nhặt hay trúng ngay lúc đầu. */
const MIN_FROM_ORIGIN = 3;

export interface BenchRaw {
  done: boolean;
  /** `performance.timeOrigin + performance.now()` của khung hình bench đầu tiên (ms, epoch). */
  firstFrameEpochMs: number;
  /** dt (ms) từng khung trong khoảng đo. */
  dts: number[];
  shades: number;
  motes: number;
}

declare global {
  interface Window {
    __bench?: BenchRaw;
  }
}

/** Điểm ngẫu nhiên đều trên đĩa bán kính (ISLAND_RADIUS − 2), theo seed. */
function scatter(rng: () => number, n: number, keepClear: (x: number, z: number) => boolean): Vec3[] {
  const out: Vec3[] = [];
  const r = ISLAND_RADIUS - 2;
  while (out.length < n) {
    const a = rng() * Math.PI * 2;
    const d = Math.sqrt(rng()) * r;
    const x = d * Math.cos(a);
    const z = d * Math.sin(a);
    if (Math.hypot(x, z) < MIN_FROM_ORIGIN || !keepClear(x, z)) continue;
    out.push([x, 0, z]);
  }
  return out;
}

export function benchScenario(seed: number): Scenario {
  const rng = mulberry32(seed);
  const lanterns = getMap(1).lanterns;
  const lit = ['L1', 'L2', 'L3'];
  const litPos = lanterns.filter((l) => lit.includes(l.id)).map((l) => l.pos);
  // Bóng Mực không đặt trong vùng an toàn đèn sáng (sim sẽ đẩy ra).
  const shades = scatter(rng, BENCH_SHADES, (x, z) => litPos.every((p) => distXZ([x, 0, z], p) > TUNING.safe_radius + 0.5));
  const motes = scatter(rng, BENCH_MOTES, () => true);
  return {
    player: { pos: [0, 0, 0] },
    random_motes: false,
    random_shades: false,
    random_drifters: false,
    wind_enabled: false,
    motes,
    shades: shades.map((pos, i) => ({ id: `S${i + 1}`, pos, state: 'wander' as const })),
    lanterns: lit.map((id) => ({ id, lit: true, fuel: TUNING.fuel_max })),
  };
}

/**
 * Sau mỗi tick: giữ cảnh chuẩn. Sim chạy nguyên luật; phần "tắt" của bench (sát thương, nhặt, hao dầu,
 * kết thúc Đêm) thực hiện ở đây bằng cách đặt lại trạng thái, không sửa sim.
 */
function pinScene(s: GameState): void {
  const p = s.player;
  p.pos = [0, 0, 0];
  p.invuln = 1e9; // không sát thương
  p.flames = 3;
  p.carried = 0; // không nhặt (đom đóm cách ≥ 3 m, túi luôn trống)
  p.vel = [0, 0, 0];
  s.status = 'playing'; // không kết thúc Đêm
  s.durationTicks = 1e9;
  for (const l of s.lanterns) if (l.lit) l.fuelU = FUEL_MAX_U; // không hao / bị hút dầu
  // Mây đứng yên ở (0,0,0): Bóng Mực trong tầm phát hiện sẽ chase 1 tick; trả về wander để chạy đúng luật wander.
  for (const sh of s.shades) if (sh.state === 'chase') sh.state = 'wander';
}

export function runBench(world: World, params: URLSearchParams): void {
  const seed = Number(params.get('seed') ?? 42);
  const duration = Number(params.get('duration') ?? 30);
  const state = createGame(seed, benchScenario(seed), 1);
  pinScene(state);
  const raw: BenchRaw = { done: false, firstFrameEpochMs: 0, dts: [], shades: state.shades.length, motes: state.motes.length };
  window.__bench = raw;

  let accMs = 0;
  let last = 0;
  let t0 = 0; // mốc khung đầu tiên
  const render = (now: number) => {
    const t = (now - t0) / 1000;
    const a = (2 * Math.PI * t) / CAM_PERIOD_S; // ngược chiều kim đồng hồ khi nhìn từ trên xuống (+X → −Z)
    world.render(state, now / 1000, 0, 0, {
      pos: [CAM_RADIUS * Math.cos(a), CAM_HEIGHT, -CAM_RADIUS * Math.sin(a)],
      look: [0, 0, 0],
    });
  };
  const frame = (now: number) => {
    if (t0 === 0) {
      t0 = now;
      last = now;
      raw.firstFrameEpochMs = performance.timeOrigin + performance.now();
    }
    const dt = now - last;
    last = now;
    const r = advance(accMs, dt);
    accMs = r.accMs;
    for (let i = 0; i < r.ticks; i++) {
      step(state, DEFAULT_INPUT);
      pinScene(state);
    }
    render(now);
    const t = (now - t0) / 1000;
    if (t >= WARMUP_S && dt > 0) raw.dts.push(dt);
    if (t >= WARMUP_S + duration) {
      raw.done = true;
      return;
    }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}
