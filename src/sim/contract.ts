// Nguồn duy nhất của tuning: game.contract.json (không hard-code số trùng lặp).
import contract from '../../game.contract.json';

export const TUNING = contract.tuning;
export type Tuning = typeof TUNING;
