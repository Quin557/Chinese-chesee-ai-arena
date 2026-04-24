export type Side = "red" | "black";

export type PieceType =
  | "general"
  | "advisor"
  | "elephant"
  | "horse"
  | "rook"
  | "cannon"
  | "soldier";

export interface Piece {
  id: string;
  side: Side;
  type: PieceType;
  label: string;
}

export interface Position {
  row: number;
  col: number;
}

export interface Move {
  from: Position;
  to: Position;
  piece: Piece;
  captured?: Piece;
  notation: string;
}

export interface EvalBreakdown {
  material: number;
  kingSafety: number;
  centerControl: number;
  openLinePressure: number;
  development: number;
  total: number;
}

export interface WinProbabilityPoint {
  ply: number;
  redWinRate: number;
  blackWinRate: number;
  scoreFromRed: number;
  explanation: string;
  breakdown: EvalBreakdown;
  decisive?: Side;
}

export type BoardCell = Piece | null;
export type Board = BoardCell[][];

export interface GameSnapshot {
  board: Board;
  currentTurn: Side;
  playerSide: Side;
  aiSide: Side;
  moveHistory: Move[];
  lastMove?: Move;
  isCheck: boolean;
  isCheckmate: boolean;
  winner?: Side;
  hasStarted: boolean;
  statusMessage: string;
  winRateHistory: WinProbabilityPoint[];
  lastEvaluation?: WinProbabilityPoint;
}
