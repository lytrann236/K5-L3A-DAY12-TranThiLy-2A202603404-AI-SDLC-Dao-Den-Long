export type Vec3 = [number, number, number];

/** Một frame trong file inputs (Test Contract mục C). Trường vắng giữ giá trị cũ. */
export interface InputFrame {
  tick: number;
  move?: [number, number];
  cam_yaw_deg?: number;
  jump?: boolean;
  interact?: boolean;
  pulse?: boolean;
}

/** Trạng thái input đầy đủ đang áp dụng ở một tick. */
export interface InputState {
  move: [number, number];
  cam_yaw_deg: number;
  jump: boolean;
  interact: boolean;
  pulse: boolean;
}

export const DEFAULT_INPUT: Readonly<InputState> = {
  move: [0, 0],
  cam_yaw_deg: 0,
  jump: false,
  interact: false,
  pulse: false,
};

/** File scenario (Test Contract mục D). Mọi trường đều tùy chọn. */
export interface Scenario {
  player?: { pos?: Vec3; carried?: number; flames?: number };
  random_motes?: boolean;
  random_shades?: boolean;
  motes?: Vec3[];
  shades?: { id?: string; pos: Vec3 }[];
  lanterns?: { id: string; pos?: Vec3; deposited?: number; lit?: boolean }[];
  time_left_s?: number;
}

export interface Player {
  pos: Vec3;
  vy: number;
  grounded: boolean;
  flames: number;
  carried: number;
  /** Số tick bất tử còn lại. */
  invuln: number;
  /** Số tick cooldown pulse còn lại. */
  pulseCooldown: number;
}

export interface Lantern {
  id: string;
  pos: Vec3;
  lit: boolean;
  deposited: number;
}

export type ShadeState = 'chase' | 'stunned';

export interface Shade {
  id: string;
  pos: Vec3;
  state: ShadeState;
  /** Số tick choáng còn lại. */
  stun: number;
}

export interface Mote {
  id: string;
  pos: Vec3;
}

export type GameStatus = 'playing' | 'won' | 'lost';

export type SimEvent =
  | { name: 'mote_picked'; data: { carried: number } }
  | { name: 'deposit'; data: { lantern_id: string; amount: number; deposited: number } }
  | { name: 'lantern_lit'; data: { lantern_id: string } }
  | { name: 'pulse'; data: { stunned_ids: string[] } }
  | { name: 'player_hit'; data: { by: 'shade' | 'fall'; flames: number; dropped: number } }
  | { name: 'shade_spawned'; data: { id: string } }
  | {
      name: 'game_over';
      data: { result: 'won' | 'lost'; reason: 'all_lit' | 'dawn' | 'no_flames' };
    };

export interface GameState {
  /** Số bước đã chạy (= sim_tick). */
  tick: number;
  status: GameStatus;
  score: number;
  /** Thời lượng Đêm (giây) lúc dựng scenario. */
  durationS: number;
  /** time_left_s = durationS − tick / 60. */
  timeLeft: number;
  player: Player;
  lanterns: Lantern[];
  shades: Shade[];
  motes: Mote[];
  randomMotes: boolean;
  randomShades: boolean;
  rng: () => number;
  /** Trạng thái nút ở tick trước, để bắt sườn false→true. */
  prevButtons: { jump: boolean; interact: boolean; pulse: boolean };
  nextMoteId: number;
  nextShadeId: number;
}
