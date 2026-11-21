import type { InputState } from '../sim/types';
import {
  MOUSE_PITCH_DEG_PER_PX,
  MOUSE_YAW_DEG_PER_PX,
  clampPitch,
  moveFromKeys,
  normalizeYaw,
  yawDeltaFromKeys,
} from './controls';

const GAME_KEYS = new Set([
  'KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyE', 'KeyF', 'KeyR', 'KeyP', 'Escape', 'ShiftLeft', 'ShiftRight', 'Space', 'ArrowLeft', 'ArrowRight',
]);

export interface GameInput {
  /** Gọi mỗi khung hình (dt thật, giây): xoay camera bằng mũi tên. */
  update(dtSec: number): void;
  /** Gọi mỗi tick sim: trả input hiện tại (có cam_yaw_deg) và tiêu thụ các cú nhấn chờ. */
  sample(): InputState;
  readonly yawDeg: number;
  readonly pitchDeg: number;
  /** true một lần sau khi nhấn Esc hoặc P. */
  consumePause(): boolean;
  /** true một lần sau khi nhấn R. */
  consumeRestart(): boolean;
  /** Xóa các cú nhấn đang chờ (khi chơi lại). */
  reset(): void;
}

export function createInput(canvas: HTMLElement): GameInput {
  const down = new Set<string>();
  const pending = { jump: false, interact: false, pulse: false, dash: false };
  let pauseKey = false;
  let restart = false;
  let yaw = 0;
  let pitch = 35;
  let dragging = false;

  const onKeyDown = (e: KeyboardEvent) => {
    if (!GAME_KEYS.has(e.code)) return;
    e.preventDefault();
    if (e.repeat) return;
    down.add(e.code);
    // Latch: cú nhấn ngắn hơn một tick vẫn được gửi ít nhất một tick `true`.
    if (e.code === 'Space') pending.jump = true;
    if (e.code === 'KeyE') pending.interact = true;
    if (e.code === 'KeyF') pending.pulse = true;
    if (e.code === 'KeyR') restart = true;
    if (e.code === 'KeyP' || e.code === 'Escape') pauseKey = true;
    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') pending.dash = true;
  };
  const onKeyUp = (e: KeyboardEvent) => {
    down.delete(e.code);
  };
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', () => down.clear());

  canvas.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    dragging = true;
    canvas.setPointerCapture(e.pointerId);
    canvas.classList.add('dragging');
  });
  const endDrag = () => {
    dragging = false;
    canvas.classList.remove('dragging');
  };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);
  canvas.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    // Kéo sang phải → tầm nhìn quay sang phải (yaw giảm); kéo xuống → camera lên cao.
    yaw = normalizeYaw(yaw - e.movementX * MOUSE_YAW_DEG_PER_PX);
    pitch = clampPitch(pitch + e.movementY * MOUSE_PITCH_DEG_PER_PX);
  });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  return {
    update(dtSec) {
      const d = yawDeltaFromKeys(down, dtSec);
      if (d !== 0) yaw = normalizeYaw(yaw + d);
    },
    sample() {
      const input: InputState = {
        move: moveFromKeys(down),
        cam_yaw_deg: yaw,
        jump: down.has('Space') || pending.jump,
        interact: down.has('KeyE') || pending.interact,
        pulse: down.has('KeyF') || pending.pulse,
        dash: down.has('ShiftLeft') || down.has('ShiftRight') || pending.dash,
        // Tạm dừng do giao diện điều khiển (main.ts gửi cặp bước pause), không đi qua đây.
        pause: false,
      };
      pending.jump = pending.interact = pending.pulse = pending.dash = false;
      return input;
    },
    get yawDeg() {
      return yaw;
    },
    get pitchDeg() {
      return pitch;
    },
    consumePause() {
      const r = pauseKey;
      pauseKey = false;
      return r;
    },
    consumeRestart() {
      const r = restart;
      restart = false;
      return r;
    },
    reset() {
      pending.jump = pending.interact = pending.pulse = pending.dash = false;
      pauseKey = false;
    },
  };
}
