import type { Board, Piece, PieceType, Side } from "../types/chess";

const ROWS = 10;
const COLS = 9;

const RED_LABELS: Record<PieceType, string> = {
  general: "帅",
  advisor: "仕",
  elephant: "相",
  horse: "马",
  rook: "车",
  cannon: "炮",
  soldier: "兵",
};

const BLACK_LABELS: Record<PieceType, string> = {
  general: "将",
  advisor: "士",
  elephant: "象",
  horse: "马",
  rook: "车",
  cannon: "炮",
  soldier: "卒",
};

function createPiece(side: Side, type: PieceType, id: string): Piece {
  return {
    id,
    side,
    type,
    label: side === "red" ? RED_LABELS[type] : BLACK_LABELS[type],
  };
}

export function createInitialBoard(): Board {
  const board: Board = Array.from({ length: ROWS }, () =>
    Array.from({ length: COLS }, () => null),
  );

  const backRow: PieceType[] = [
    "rook",
    "horse",
    "elephant",
    "advisor",
    "general",
    "advisor",
    "elephant",
    "horse",
    "rook",
  ];

  backRow.forEach((type, col) => {
    board[0][col] = createPiece("black", type, `black-${type}-${col}-0`);
    board[9][col] = createPiece("red", type, `red-${type}-${col}-9`);
  });

  board[2][1] = createPiece("black", "cannon", "black-cannon-1-2");
  board[2][7] = createPiece("black", "cannon", "black-cannon-7-2");
  board[7][1] = createPiece("red", "cannon", "red-cannon-1-7");
  board[7][7] = createPiece("red", "cannon", "red-cannon-7-7");

  [0, 2, 4, 6, 8].forEach((col) => {
    board[3][col] = createPiece("black", "soldier", `black-soldier-${col}-3`);
    board[6][col] = createPiece("red", "soldier", `red-soldier-${col}-6`);
  });

  return board;
}
