import { TUNING } from '../sim/contract';
import { distXZ } from '../sim/geom';
import type { GameState } from '../sim/types';

export interface Hud {
  update(state: GameState, seed: number): void;
}

const KEY_HINTS =
  'WASD: di chuyển · ←/→ hoặc kéo chuột: xoay camera · Space: nhảy · E: nạp đèn · F: tỏa sáng · R: chơi lại';

function formatTime(sec: number): string {
  const s = Math.max(0, Math.ceil(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function createHud(hud: HTMLElement, overlay: HTMLElement): Hud {
  hud.innerHTML = `
    <div class="stats">
      <div>🔥 Ngọn lửa: <b data-k="flames"></b></div>
      <div>✨ Đom đóm: <b data-k="carried"></b></div>
      <div>🏮 Đèn đã thắp: <b data-k="lanterns"></b></div>
      <div>⏳ Còn lại: <b data-k="time"></b></div>
      <div>⭐ Điểm: <b data-k="score"></b></div>
    </div>
    <div class="seed" data-k="seed"></div>
    <div class="prompt" data-k="prompt" hidden>Có thể nạp đèn (E)</div>
    <div class="keys">${KEY_HINTS}</div>`;
  const el = (k: string) => hud.querySelector<HTMLElement>(`[data-k="${k}"]`)!;
  const nodes = {
    flames: el('flames'),
    carried: el('carried'),
    lanterns: el('lanterns'),
    time: el('time'),
    score: el('score'),
    seed: el('seed'),
    prompt: el('prompt'),
  };
  // Chỉ ghi DOM khi giá trị đổi.
  const last = new Map<string, string>();
  const set = (k: keyof typeof nodes, v: string) => {
    if (last.get(k) === v) return;
    last.set(k, v);
    nodes[k].textContent = v;
  };
  let overlayKey = '';

  return {
    update(state, seed) {
      const p = state.player;
      const lit = state.lanterns.filter((l) => l.lit).length;
      set('flames', String(p.flames));
      set('carried', `${p.carried}/${TUNING.carry_capacity}`);
      set('lanterns', `${lit}/${state.lanterns.length}`);
      set('time', formatTime(state.timeLeft));
      set('score', String(state.score));
      set('seed', `Seed: ${seed}`);

      const near =
        state.status === 'playing' &&
        state.lanterns.some((l) => !l.lit && distXZ(l.pos, p.pos) <= TUNING.interact_radius);
      nodes.prompt.hidden = !near;

      // Lý do thua suy ra từ state: chỉ có hai cách thua (hết ngọn lửa hoặc trời sáng).
      const key = state.status === 'playing' ? '' : `${state.status}|${p.flames <= 0}|${state.score}`;
      if (key === overlayKey) return;
      overlayKey = key;
      if (state.status === 'playing') {
        overlay.hidden = true;
        overlay.className = '';
        overlay.innerHTML = '';
        return;
      }
      const won = state.status === 'won';
      overlay.hidden = false;
      overlay.className = won ? 'won' : 'lost';
      overlay.innerHTML = `
        <h1>${won ? 'Chiến thắng!' : 'Thất bại'}</h1>
        <p>${
          won
            ? 'Cả năm ngọn đèn đã sáng.'
            : p.flames <= 0
              ? 'Ngọn lửa của bạn đã tắt.'
              : 'Trời đã sáng, đèn chưa thắp đủ.'
        }</p>
        <p>Điểm: <b>${state.score}</b></p>
        <p class="hint">Nhấn R để chơi lại</p>`;
    },
  };
}
