// Màn phủ tối thiểu: menu chọn Đêm, tạm dừng, kết quả. Chỉ là giao diện, không chứa logic game.
import { NIGHT_NAMES } from './hud';

export type MenuKind = 'menu' | 'paused' | 'won' | 'lost';

export interface MenuInfo {
  night: number;
  score: number;
  /** Có Đêm kế tiếp để nút "Đêm kế tiếp" (chỉ khi thắng). */
  hasNext: boolean;
  /** Lý do thua: 'no_flames' | 'dawn'. */
  reason?: string;
}

export interface MenuHandlers {
  startNight(night: number): void;
  resume(): void;
  restart(): void;
  toMenu(): void;
  next(): void;
}

export interface Menu {
  show(kind: MenuKind, info: MenuInfo): void;
  hide(): void;
  readonly visible: boolean;
}

export function createMenu(overlay: HTMLElement, h: MenuHandlers): Menu {
  const button = (label: string, action: string, extra = '') =>
    `<button data-action="${action}"${extra}>${label}</button>`;

  overlay.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-action]');
    if (!b) return;
    const a = b.dataset.action!;
    if (a === 'night') h.startNight(Number(b.dataset.night));
    else if (a === 'resume') h.resume();
    else if (a === 'restart') h.restart();
    else if (a === 'menu') h.toMenu();
    else if (a === 'next') h.next();
  });

  return {
    get visible() {
      return !overlay.hidden;
    },
    hide() {
      overlay.hidden = true;
      overlay.className = '';
      overlay.innerHTML = '';
    },
    show(kind, info) {
      overlay.hidden = false;
      overlay.className = kind;
      if (kind === 'menu') {
        overlay.innerHTML = `
          <h1>Đảo Đèn Lồng</h1>
          <p>Chọn một Đêm để bắt đầu</p>
          <div class="buttons">
            ${[1, 2, 3].map((n) => button(NIGHT_NAMES[n], 'night', ` data-night="${n}"`)).join('')}
          </div>
          <p class="hint">WASD di chuyển · Space nhảy · Shift lướt · E nạp đèn · F tỏa sáng · Esc/P tạm dừng</p>`;
      } else if (kind === 'paused') {
        overlay.innerHTML = `
          <h1>Tạm dừng</h1>
          <p>${NIGHT_NAMES[info.night] ?? `Đêm ${info.night}`}</p>
          <div class="buttons">
            ${button('Tiếp tục', 'resume')}${button('Chơi lại Đêm', 'restart')}${button('Về menu', 'menu')}
          </div>`;
      } else {
        const won = kind === 'won';
        overlay.innerHTML = `
          <h1>${won ? 'Chiến thắng!' : 'Thất bại'}</h1>
          <p>${
            won
              ? `Mọi ngọn đèn của ${NIGHT_NAMES[info.night] ?? `Đêm ${info.night}`} đã sáng.`
              : info.reason === 'no_flames'
                ? 'Ngọn lửa của bạn đã tắt.'
                : 'Trời đã sáng, đèn chưa thắp đủ.'
          }</p>
          <p>Điểm: <b>${info.score}</b></p>
          <div class="buttons">
            ${won && info.hasNext ? button('Đêm kế tiếp', 'next') : ''}${button('Chơi lại Đêm', 'restart')}${button('Về menu', 'menu')}
          </div>
          <p class="hint">Nhấn R để chơi lại</p>`;
      }
    },
  };
}
