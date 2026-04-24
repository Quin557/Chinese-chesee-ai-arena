import type { PieceType } from "../types/chess";

export const PIECE_VALUES: Record<PieceType, number> = {
  general: 100000,
  advisor: 200,
  elephant: 200,
  horse: 400,
  rook: 900,
  cannon: 450,
  soldier: 100,
};

export const SOLDIER_CROSS_RIVER_BONUS = 70;
export const CHECK_BONUS = 140;
export const CHECKMATE_BONUS = 1000000;
export const MOBILITY_WEIGHT = 4;
