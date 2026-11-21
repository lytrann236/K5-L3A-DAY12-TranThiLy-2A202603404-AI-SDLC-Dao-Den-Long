export type Vec3 = [number, number, number];

/** Một frame trong file inputs (Test Contract mục C, v1.1). Trường vắng giữ giá trị cũ. */
export interface InputFrame {
  tick: number;
  move?: [number, number];
  cam_yaw_deg?: number;
  jump?: boolean;
  interact?: boolean;
  pulse?: boolean;
  dash?: boolean;
  pause?: boolean;
}

/** Trạng thái input đầy đủ đang áp dụng ở một tick. */
export interface InputState {
  move: [number, number];
  cam_yaw_deg: number;
  jump: boolean;
  interact: boolean;
  pulse: boolean;
  dash: boolean;
  pause: boolean;
}

export const DEFAULT_INPUT: Readonly<InputState> = {
  move: [0, 0],
  cam_yaw_deg: 0,
  jump: false,
  interact: false,
  pulse: false,
  dash: false,
  pause: false,
};

export type Buttons = Pick<InputState, 'jump' | 'interact' | 'pulse' | 'dash' | 'pause'>;

/** Trạng thái Bóng Mực (tên bắt buộc từ Test Contract v1.1). */
export type ShadeState = 'spawning' | 'wander' | 'chase' | 'recoil' | 'stunned';
export const SHADE_STATES: readonly ShadeState[] = ['spawning', 'wander', 'chase', 'recoil', 'stunned'];

export type DrifterState = 'idle' | 'chase' | 'flee' | 'removed';
export const DRIFTER_STATES: readonly DrifterState[] = ['idle', 'chase', 'flee', 'removed'];

/** File scenario (Test Contract mục D, v1.1). Mọi trường đều tùy chọn. */
export interface Scenario {
  player?: {
    pos?: Vec3;
    carried?: number;
    flames?: number;
    invuln_ticks?: number;
    dash_cd_ticks?: number;
    pulse_cd_ticks?: number;
    charm_ticks?: number;
  };
  random_motes?: boolean;
  random_shades?: boolean;
  random_drifters?: boolean;
  wind_enabled?: boolean;
  motes?: Vec3[];
  shades?: { id?: string; pos: Vec3; state?: ShadeState; state_ticks_left?: number }[];
  drifters?: { id?: string; pos: Vec3; state?: DrifterState; stolen?: number }[];
  charms?: { id?: string; pos?: Vec3; available?: boolean; respawn_ticks?: number }[];
  lanterns?: { id: string; pos?: Vec3; deposited?: number; lit?: boolean }[];
  time_left_s?: number;
}

export interface Player {
  pos: Vec3;
  /** Vận tốc của tick vừa chạy (m/s). */
  vel: Vec3;
  grounded: boolean;
  /** Hướng quay mặt (XZ, đơn vị): hướng di chuyển gần nhất. */
  facing: [number, number];
  flames: number;
  carried: number;
  /** Số tick bất tử còn lại. */
  invuln: number;
  /** Số tick cooldown pulse còn lại. */
  pulseCooldown: number;
  /** Số tick hồi chiêu lướt còn lại. */
  dashCooldown: number;
  /** Số tick lướt còn lại (0 = không lướt) và hướng lướt. */
  dashTicks: number;
  dashDir: [number, number];
  /** Số tick hiệu lực Bùa Gió còn lại. */
  charm: number;
  /** Số tick chờ hồi sinh còn lại sau khi rơi khỏi đảo (0 = không chờ). */
  respawn: number;
  /** Đang bay từ bục nhảy: vận tốc ngang phóng [vx, vz] giữ tới khi chạm đất; null = không bay. */
  launch: [number, number] | null;
  /** Vy lúc bắt đầu lướt trong khi bay từ bục (lướt giữ độ cao); hết lướt thì bay tiếp với vy này. */
  heldVy: number | null;
}

export interface Lantern {
  id: string;
  pos: Vec3;
  lit: boolean;
  deposited: number;
}

export interface Shade {
  id: string;
  pos: Vec3;
  state: ShadeState;
  /** Số tick còn lại của trạng thái có thời hạn (spawning / recoil / stunned); 0 với wander/chase. */
  stateTicks: number;
  /** Đẩy lùi do Tỏa Sáng: số tick đẩy còn lại và hướng (XZ). */
  pushTicks: number;
  pushDir: [number, number];
  /** Hướng lùi khi recoil (XZ). */
  recoilDir: [number, number];
  /** Bị đẩy ra khỏi vùng an toàn: số tick còn lại và độ dời mỗi tick (XZ). Không gây hit khi > 0. */
  safeTicks: number;
  safeStep: [number, number];
}

export type MoteKind = 'random' | 'dropped';

export interface Mote {
  id: string;
  pos: Vec3;
  kind: MoteKind;
  /** Số tick còn lại của đom đóm `dropped`; null với `random`. */
  ttl: number | null;
}

export interface Drifter {
  id: string;
  pos: Vec3;
  state: DrifterState;
  stolen: number;
  /** `idle`: tâm vòng lượn (XZ) và góc hiện tại (rad, ngược chiều kim đồng hồ từ +X). */
  center: [number, number];
  angle: number;
  /** `flee`: số tick bay trốn còn lại; hết thì `removed`. */
  fleeTicks: number;
}

export interface Charm {
  id: string;
  pos: Vec3;
  available: boolean;
  /** Số tick tới lúc xuất hiện lại (0 khi đang available). */
  respawn: number;
}

export type GameStatus = 'playing' | 'won' | 'lost';

export type SimEvent =
  | { name: 'mote_picked'; data: { carried: number } }
  | { name: 'deposit'; data: { lantern_id: string; amount: number; deposited: number } }
  | { name: 'lantern_lit'; data: { lantern_id: string } }
  | { name: 'pulse'; data: { stunned_ids: string[] } }
  | { name: 'player_hit'; data: { by: 'shade'; flames: number; dropped: number } }
  | { name: 'player_hit'; data: { by: 'fall'; flames: number; dropped: number; lost: number } }
  | { name: 'shade_spawned'; data: { id: string } }
  | { name: 'dash'; data: Record<string, never> }
  | { name: 'charm_picked'; data: { charm_id: string; charm_ticks: number } }
  | { name: 'drifter_steal'; data: { drifter_id: string; amount: number; carried: number } }
  | { name: 'drifter_drop'; data: { drifter_id: string; amount: number } }
  | { name: 'night_start'; data: { night: number } }
  | { name: 'paused'; data: Record<string, never> }
  | { name: 'resumed'; data: Record<string, never> }
  | {
      name: 'game_over';
      data: { result: 'won' | 'lost'; reason: 'all_lit' | 'dawn' | 'no_flames' };
    };

export interface GameState {
  night: number;
  /** Số bước đã chạy, kể cả lúc tạm dừng (= `tick` trong output). */
  tick: number;
  /** Số bước gameplay đã chạy (đứng yên khi tạm dừng). */
  simTick: number;
  status: GameStatus;
  paused: boolean;
  score: number;
  /** Thời lượng Đêm (giây) lúc dựng scenario. */
  durationS: number;
  /** Thời lượng quy ra số tick nguyên = round(durationS × 60). Logic hết giờ và thưởng chỉ dùng số tick này. */
  durationTicks: number;
  /** time_left_s hiển thị = max(0, durationS − simTick / 60). Không dùng cho logic. */
  timeLeft: number;
  player: Player;
  lanterns: Lantern[];
  shades: Shade[];
  motes: Mote[];
  drifters: Drifter[];
  charms: Charm[];
  /**
   * Gió mạnh (Đêm 3). `active`: đang thổi (không tính 2 s báo trước). `warning`: đang báo trước (chỉ
   * dùng cho UI, không có trong snapshot). `dirDeg`: hướng của cơn gần nhất (0 nếu chưa có cơn nào).
   */
  wind: { active: boolean; warning: boolean; dirDeg: number };
  randomMotes: boolean;
  randomShades: boolean;
  randomDrifters: boolean;
  windEnabled: boolean;
  rng: () => number;
  /** Luồng RNG riêng cho hướng gió (sinh từ seed), không ảnh hưởng lịch sinh. */
  windRng: () => number;
  /** Trạng thái nút ở tick trước, để bắt sườn false→true. */
  prevButtons: Buttons;
  nextMoteId: number;
  nextShadeId: number;
  nextDrifterId: number;
}
