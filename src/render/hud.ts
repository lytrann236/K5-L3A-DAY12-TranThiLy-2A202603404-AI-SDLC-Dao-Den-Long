import { TUNING } from '../sim/contract';
import { distXZ } from '../sim/geom';
import type { GameState } from '../sim/types';
import { NOTICE_MS } from './feedback';

export interface Hud {
  update(state: GameState, seed: number, nowMs: number): void;
  /** Hiện thông báo ngắn (NOTICE_MS); chuỗi rỗng = xóa thông báo. */
  notify(message: string, nowMs: number): void;
}

const KEY_HINTS =
  'WASD: di chuyển · ←/→ hoặc kéo chuột: xoay camera · Space: nhảy · Shift: lướt · E: nạp đèn · F: tỏa sáng · Esc/P: tạm dừng · R: chơi lại';

export const NIGHT_NAMES: Record<number, string> = { 1: 'Đêm 1 — Đảo Đèn', 2: 'Đêm 2 — Đảo Cau', 3: 'Đêm 3 — Đảo Chuông' };

/** Hồi chiêu hiển thị: 0 tick → "sẵn sàng", còn lại → giây (1 chữ số). */
export function formatCooldown(ticks: number): string {
  return ticks <= 0 ? 'sẵn sàng' : `${(ticks / 60).toFixed(1)} s`;
}

function formatTime(sec: number): string {
  const s = Math.max(0, Math.ceil(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function createHud(hud: HTMLElement): Hud {
  hud.innerHTML = `
    <div class="stats">
      <div>🔥 Ngọn lửa: <b data-k="flames"></b></div>
      <div>✨ Đom đóm: <b data-k="carried"></b></div>
      <div>🏮 Đèn đã thắp: <b data-k="lanterns"></b></div>
      <div>⏳ Còn lại: <b data-k="time"></b></div>
      <div>⭐ Điểm: <b data-k="score"></b></div>
      <div>💨 Lướt (Shift): <b data-k="dash"></b></div>
      <div>🌟 Tỏa Sáng (F): <b data-k="pulse"></b></div>
      <div data-k-row="charm" hidden>🍃 Bùa Gió: <b data-k="charm"></b></div>
    </div>
    <div class="seed"><span data-k="night"></span> · <span data-k="seed"></span></div>
    <div class="prompt" data-k="prompt" hidden>Có thể nạp đèn (E)</div>
    <div class="toast" data-k="toast" hidden></div>
    <div class="keys">${KEY_HINTS}</div>`;
  const el = (k: string) => hud.querySelector<HTMLElement>(`[data-k="${k}"]`)!;
  const nodes = {
    flames: el('flames'),
    carried: el('carried'),
    lanterns: el('lanterns'),
    time: el('time'),
    score: el('score'),
    dash: el('dash'),
    pulse: el('pulse'),
    charm: el('charm'),
    night: el('night'),
    seed: el('seed'),
    prompt: el('prompt'),
    toast: el('toast'),
  };
  // Chỉ ghi DOM khi giá trị đổi.
  const last = new Map<string, string>();
  const set = (k: keyof typeof nodes, v: string) => {
    if (last.get(k) === v) return;
    last.set(k, v);
    nodes[k].textContent = v;
  };
  const charmRow = hud.querySelector<HTMLElement>('[data-k-row="charm"]')!;
  let noticeUntil = 0;

  return {
    notify(message, nowMs) {
      nodes.toast.textContent = message;
      noticeUntil = message ? nowMs + NOTICE_MS : 0;
      nodes.toast.hidden = !message;
    },
    update(state, seed, nowMs) {
      if (noticeUntil !== 0 && nowMs >= noticeUntil) {
        noticeUntil = 0;
        nodes.toast.hidden = true;
      }
      const p = state.player;
      const lit = state.lanterns.filter((l) => l.lit).length;
      set('flames', String(p.flames));
      set('carried', `${p.carried}/${TUNING.carry_capacity}`);
      set('lanterns', `${lit}/${state.lanterns.length}`);
      set('time', formatTime(state.timeLeft));
      set('score', String(state.score));
      set('seed', `Seed: ${seed}`);
      set('night', NIGHT_NAMES[state.night] ?? `Đêm ${state.night}`);
      // Có Bùa Gió thì lướt không hồi chiêu (phase-2.md AC2-36).
      set('dash', p.charm > 0 ? 'sẵn sàng (bùa)' : formatCooldown(p.dashCooldown));
      set('pulse', formatCooldown(p.pulseCooldown));
      charmRow.hidden = p.charm <= 0;
      set('charm', `${(p.charm / 60).toFixed(1)} s`);

      const near =
        state.status === 'playing' &&
        state.lanterns.some((l) => !l.lit && distXZ(l.pos, p.pos) <= TUNING.interact_radius);
      nodes.prompt.hidden = !near;
    },
  };
}
