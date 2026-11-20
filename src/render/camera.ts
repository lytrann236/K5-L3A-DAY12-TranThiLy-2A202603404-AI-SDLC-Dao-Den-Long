import type { PerspectiveCamera } from 'three';
import { cameraForward } from './controls';

export const CAM_DISTANCE = 11;
const LOOK_HEIGHT = 1.2;

/** Đặt camera góc nhìn thứ ba phía sau người chơi, nhìn theo hướng cam_yaw_deg. */
export function placeCamera(
  camera: PerspectiveCamera,
  target: readonly [number, number, number],
  yawDeg: number,
  pitchDeg: number,
  distance: number = CAM_DISTANCE,
): void {
  const [fx, fz] = cameraForward(yawDeg);
  const p = (pitchDeg * Math.PI) / 180;
  camera.position.set(
    target[0] - fx * Math.cos(p) * distance,
    target[1] + LOOK_HEIGHT + Math.sin(p) * distance,
    target[2] - fz * Math.cos(p) * distance,
  );
  camera.lookAt(target[0], target[1] + LOOK_HEIGHT, target[2]);
  camera.updateMatrixWorld();
}
