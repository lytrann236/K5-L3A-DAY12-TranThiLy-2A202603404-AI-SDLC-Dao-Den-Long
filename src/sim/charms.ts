// Bùa Gió (ticket-02 Phần 3): nhặt như đom đóm; hiệu lực 600 tick (nhặt lại làm mới):
// chạy 7.2 m/s, lướt không hồi chiêu. Bùa xuất hiện lại sau 2700 tick.
import { CHARM_RESPAWN_TICKS, CHARM_TICKS, PICKUP_MAX_DY } from './constants';
import { TUNING } from './contract';
import { distXZ } from './geom';
import type { GameState, SimEvent } from './types';

// Bước 2 (phần bùa): đếm lùi thời gian xuất hiện lại; về 0 thì bùa có mặt lại (nhặt được ngay bước 4).
export function tickCharms(s: GameState): void {
  for (const c of s.charms) {
    if (!c.available && c.respawn > 0) {
      c.respawn--;
      if (c.respawn === 0) c.available = true;
    }
  }
}

/**
 * Bước 4 (phần bùa): cùng luật nhặt đom đóm (XZ ≤ pickup_radius, chênh cao ≤ 1.5 m), không phụ thuộc
 * túi đầy. Đặt hiệu lực = 600 tick (làm mới), xóa hồi chiêu lướt, bùa biến mất 2700 tick.
 */
export function pickupCharms(s: GameState, events: SimEvent[]): void {
  const p = s.player;
  if (p.respawn > 0) return;
  for (const c of s.charms) {
    if (!c.available) continue;
    if (distXZ(c.pos, p.pos) > TUNING.pickup_radius || Math.abs(p.pos[1] - c.pos[1]) > PICKUP_MAX_DY) continue;
    c.available = false;
    c.respawn = CHARM_RESPAWN_TICKS;
    p.charm = CHARM_TICKS;
    p.dashCooldown = 0;
    events.push({ name: 'charm_picked', data: { charm_id: c.id, charm_ticks: CHARM_TICKS } });
  }
}
