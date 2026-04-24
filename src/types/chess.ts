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
}
