import { TUNING } from '../sim/contract';
import { distXZ } from '../sim/geom';
import type { GameState, InputState, SimEvent } from '../sim/types';

/** Thời gian hiện thông báo trên HUD (ms). */
export const NOTICE_MS = 1500;

export const MSG_PULSE_NEED_MOTES = `Cần ≥ ${TUNING.pulse_cost} đom đóm để tỏa sáng`;
export const MSG_PULSE_COOLDOWN = 'Đang hồi chiêu';
export const MSG_DEPOSIT_NEED_MOTES = 'Cần mang đom đóm để nạp đèn';
export const MSG_DEPOSIT_NEED_LANTERN = 'Đứng gần đèn chưa thắp để nạp';

/**
 * Thông báo cho cú bấm E/F không có tác dụng (chỉ ở giao diện, không đổi sim).
 * `prev` = trạng thái nút ở tick trước (state.prevButtons TRƯỚC khi step), `events` = sự kiện
 * của tick vừa chạy, `state` = trạng thái SAU step. Cú bấm có hiệu lực luôn sinh sự kiện
 * (deposit / pulse), nên "không có sự kiện" = bị từ chối; lý do suy ra từ state.
 * Trả về null nếu không cần thông báo.
 */
export function failureMessage(
  prev: { interact: boolean; pulse: boolean },
  input: InputState,
  events: readonly SimEvent[],
  state: GameState,
): string | null {
  if (state.status !== 'playing') return null;
  const p = state.player;

  const interactEdge = input.interact && !prev.interact;
  if (interactEdge && !events.some((e) => e.name === 'deposit')) {
    const near = state.lanterns.some(
      (l) => !l.lit && distXZ(l.pos, p.pos) <= TUNING.interact_radius,
    );
    if (!near) return MSG_DEPOSIT_NEED_LANTERN;
    if (p.carried <= 0) return MSG_DEPOSIT_NEED_MOTES;
  }

  const pulseEdge = input.pulse && !prev.pulse;
  if (pulseEdge && !events.some((e) => e.name === 'pulse')) {
    // Cùng thứ tự kiểm tra với sim: cooldown trước, rồi số đom đóm.
    if (p.pulseCooldown > 0) return MSG_PULSE_COOLDOWN;
    if (p.carried < TUNING.pulse_cost) return MSG_PULSE_NEED_MOTES;
  }
  return null;
}
