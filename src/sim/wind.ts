// Gió mạnh Đêm 3 (ticket-02 Phần 2; phase-2.md 4.1 "Gió mạnh Đêm 3").
// Cơn k ≥ 1 thổi trong sim_tick [1800k, 1800k + 300); báo trước từ 1800k − 120. `dir_deg` nguyên
// trong [0, 360) theo seed, chốt lúc bắt đầu báo trước, đo từ +X ngược chiều kim đồng hồ (nhìn từ
// trên), là hướng gió thổi TỚI. Lịch theo sim_tick nên đứng yên khi tạm dừng.
import { WIND_GUST_TICKS, WIND_PERIOD_TICKS, WIND_WARN_TICKS } from './constants';
import { getMap } from './maps';
import type { GameState } from './types';

// Bước 2 (phần gió): cập nhật trạng thái gió theo sim_tick hiện tại (đã tăng ở bước 1).
export function tickWind(s: GameState): void {
  if (!s.windEnabled || !getMap(s.night).wind) return;
  const t = s.simTick;
  const k = Math.floor((t + WIND_WARN_TICKS) / WIND_PERIOD_TICKS); // cơn sắp tới / đang thổi
  const phase = t - k * WIND_PERIOD_TICKS; // ∈ [−120, 1680)
  if (k >= 1 && phase === -WIND_WARN_TICKS) s.wind.dirDeg = Math.floor(s.windRng() * 360);
  s.wind.warning = k >= 1 && phase < 0;
  s.wind.active = k >= 1 && phase >= 0 && phase < WIND_GUST_TICKS;
}
