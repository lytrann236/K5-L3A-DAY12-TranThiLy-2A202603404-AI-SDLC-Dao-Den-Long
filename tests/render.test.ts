import { PerspectiveCamera, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { placeCamera } from '../src/render/camera';
import {
  cameraForward,
  clampPitch,
  moveFromKeys,
  normalizeYaw,
  yawDeltaFromKeys,
} from '../src/render/controls';
import { MAX_TICKS_PER_FRAME, TICK_MS, advance } from '../src/render/timestep';
import { step } from '../src/sim/step';
import { DEFAULT_INPUT } from '../src/sim/types';
import { createGame } from '../src/sim/world';

describe('timestep (fixed 60 tick/s)', () => {
  it('một khung 16.7 ms → 1 tick, phần dư được giữ lại', () => {
    const r = advance(0, 16.7);
    expect(r.ticks).toBe(1);
    expect(r.accMs).toBeCloseTo(16.7 - TICK_MS, 9);
  });

  it('khung ngắn hơn 1 tick → 0 tick, tích lũy qua các khung', () => {
    let r = advance(0, 10);
    expect(r).toEqual({ ticks: 0, accMs: 10 });
    r = advance(r.accMs, 10);
    expect(r.ticks).toBe(1);
    expect(r.accMs).toBeCloseTo(20 - TICK_MS, 9);
  });

  it('60 khung đúng 1000/60 ms → đúng 60 tick (không mất tick do số thực)', () => {
    let acc = 0;
    let total = 0;
    for (let i = 0; i < 60; i++) {
      const r = advance(acc, 1000 / 60);
      acc = r.accMs;
      total += r.ticks;
    }
    expect(total).toBe(60);
  });

  it('khung 100 ms (6 tick) bị kẹp 5 tick và bỏ phần dư', () => {
    expect(advance(0, 100)).toEqual({ ticks: MAX_TICKS_PER_FRAME, accMs: 0 });
  });

  it('dt âm hoặc 0 không làm lùi accumulator', () => {
    expect(advance(5, -20)).toEqual({ ticks: 0, accMs: 5 });
    expect(advance(0, 0)).toEqual({ ticks: 0, accMs: 0 });
  });
});

describe('controls', () => {
  const keys = (...k: string[]) => new Set(k);

  it('bảng phím → move [x, z]', () => {
    expect(moveFromKeys(keys())).toEqual([0, 0]);
    expect(moveFromKeys(keys('KeyW'))).toEqual([0, 1]);
    expect(moveFromKeys(keys('KeyS'))).toEqual([0, -1]);
    expect(moveFromKeys(keys('KeyA'))).toEqual([1, 0]);
    expect(moveFromKeys(keys('KeyD'))).toEqual([-1, 0]);
    expect(moveFromKeys(keys('KeyW', 'KeyD'))).toEqual([-1, 1]);
    expect(moveFromKeys(keys('KeyW', 'KeyS'))).toEqual([0, 0]);
  });

  it('mũi tên: ← tăng yaw, → giảm yaw, 120 độ/giây', () => {
    expect(yawDeltaFromKeys(keys('ArrowLeft'), 0.5)).toBe(60);
    expect(yawDeltaFromKeys(keys('ArrowRight'), 0.5)).toBe(-60);
    expect(yawDeltaFromKeys(keys('ArrowLeft', 'ArrowRight'), 1)).toBe(0);
    expect(yawDeltaFromKeys(keys(), 1)).toBe(0);
  });

  it('chuẩn hóa yaw về [0, 360) và kẹp pitch', () => {
    expect(normalizeYaw(-90)).toBe(270);
    expect(normalizeYaw(450)).toBe(90);
    expect(clampPitch(0)).toBe(12);
    expect(clampPitch(90)).toBe(70);
    expect(clampPitch(40)).toBe(40);
  });

  it('cameraForward khớp hướng của move [0,1] trong sim: yaw 90 → +X', () => {
    const [x, z] = cameraForward(90);
    expect(x).toBeCloseTo(1, 12);
    expect(z).toBeCloseTo(0, 12);
  });
});

/** Đi 60 tick bằng chính sim, trả về độ dời XZ. */
function walk(keys: string[], yawDeg: number): [number, number] {
  const s = createGame(1, { random_motes: false, random_shades: false, motes: [], shades: [] });
  const input = { ...DEFAULT_INPUT, move: moveFromKeys(new Set(keys)), cam_yaw_deg: yawDeg };
  for (let i = 0; i < 60; i++) step(s, input);
  return [s.player.pos[0], s.player.pos[2]];
}

describe('hướng di chuyển khớp camera (kiểm bằng camera three.js thật + sim)', () => {
  for (const yaw of [0, 90, 180, 270, 37]) {
    it(`yaw ${yaw}°: W đi ra xa camera, S lại gần, D sang phải, A sang trái`, () => {
      const cam = new PerspectiveCamera();
      placeCamera(cam, [0, 0, 0], yaw, 35);
      const look = new Vector3();
      cam.getWorldDirection(look);
      look.y = 0;
      look.normalize();
      const right = new Vector3().setFromMatrixColumn(cam.matrixWorld, 0);
      right.y = 0;
      right.normalize();

      const dot = (d: [number, number], v: Vector3) => d[0] * v.x + d[1] * v.z;

      const w = walk(['KeyW'], yaw);
      expect(dot(w, look)).toBeCloseTo(6, 2); // đi đúng 6 m theo hướng nhìn
      expect(dot(w, right)).toBeCloseTo(0, 2);

      const s = walk(['KeyS'], yaw);
      expect(dot(s, look)).toBeCloseTo(-6, 2);

      const d = walk(['KeyD'], yaw);
      expect(dot(d, right)).toBeCloseTo(6, 2);
      expect(dot(d, look)).toBeCloseTo(0, 2);

      const a = walk(['KeyA'], yaw);
      expect(dot(a, right)).toBeCloseTo(-6, 2);
    });
  }

  it('yaw 90 + W → người chơi tới (6,0,0) như AC2', () => {
    const [x, z] = walk(['KeyW'], 90);
    expect(x).toBeCloseTo(6, 3);
    expect(z).toBeCloseTo(0, 3);
  });

  it('W + D (chéo) vẫn được sim chuẩn hóa: đi đúng 6 m', () => {
    const [x, z] = walk(['KeyW', 'KeyD'], 0);
    expect(Math.hypot(x, z)).toBeCloseTo(6, 3);
    expect(x).toBeLessThan(0);
    expect(z).toBeGreaterThan(0);
  });
});
