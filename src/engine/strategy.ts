import { isInCheck } from "./check";
import { applyMove } from "./moveGenerator";
import { PIECE_VALUES } from "../constants/pieceValues";
import type { Board, Move, PieceType, Side } from "../types/chess";

interface WeightedBookMove {
  from: { row: number; col: number };
  to: { row: number; col: number };
  weight: number;
}

const OPENING_OCCUPIED_THRESHOLD = 28;

const RED_BOOK: WeightedBookMove[] = [
  { from: { row: 7, col: 1 }, to: { row: 7, col: 4 }, weight: 380 },
  { from: { row: 7, col: 7 }, to: { row: 7, col: 4 }, weight: 378 },
  { from: { row: 9, col: 1 }, to: { row: 7, col: 2 }, weight: 320 },
  { from: { row: 9, col: 7 }, to: { row: 7, col: 6 }, weight: 318 },
  { from: { row: 9, col: 2 }, to: { row: 7, col: 4 }, weight: 250 },
  { from: { row: 9, col: 6 }, to: { row: 7, col: 4 }, weight: 246 },
  { from: { row: 9, col: 3 }, to: { row: 8, col: 4 }, weight: 184 },
  { from: { row: 9, col: 5 }, to: { row: 8, col: 4 }, weight: 182 },
];

const BLACK_BOOK: WeightedBookMove[] = [
  { from: { row: 2, col: 1 }, to: { row: 2, col: 4 }, weight: 380 },
  { from: { row: 2, col: 7 }, to: { row: 2, col: 4 }, weight: 378 },
  { from: { row: 0, col: 1 }, to: { row: 2, col: 2 }, weight: 320 },
  { from: { row: 0, col: 7 }, to: { row: 2, col: 6 }, weight: 318 },
  { from: { row: 0, col: 2 }, to: { row: 2, col: 4 }, weight: 250 },
  { from: { row: 0, col: 6 }, to: { row: 2, col: 4 }, weight: 246 },
  { from: { row: 0, col: 3 }, to: { row: 1, col: 4 }, weight: 184 },
  { from: { row: 0, col: 5 }, to: { row: 1, col: 4 }, weight: 182 },
];

function countOccupied(board: Board): number {
  let count = 0;
  for (let row = 0; row < board.length; row += 1) {
    for (let col = 0; col < board[row].length; col += 1) {
      if (board[row][col]) {
        count += 1;
      }
    }
  }
  return count;
}

function hasDevelopedCorePieces(board: Board, side: Side): number {
  let developed = 0;

  const targets: Array<{ row: number; col: number; type: PieceType }> =
    side === "red"
      ? [
          { row: 7, col: 2, type: "horse" },
          { row: 7, col: 6, type: "horse" },
          { row: 7, col: 4, type: "cannon" },
          { row: 7, col: 4, type: "elephant" },
        ]
      : [
          { row: 2, col: 2, type: "horse" },
          { row: 2, col: 6, type: "horse" },
          { row: 2, col: 4, type: "cannon" },
          { row: 2, col: 4, type: "elephant" },
        ];

  for (const target of targets) {
    const piece = board[target.row][target.col];
    if (piece?.side === side && piece.type === target.type) {
      developed += 1;
    }
  }

  return developed;
}

function isOpening(board: Board): boolean {
  return countOccupied(board) >= OPENING_OCCUPIED_THRESHOLD;
}

function isCentralSoldierAdvance(move: Move): boolean {
  return (
    move.piece.type === "soldier" &&
    move.from.col === 4 &&
    Math.abs(move.to.row - move.from.row) === 1 &&
    move.to.col === 4
  );
}

function isSideSoldierAdvance(move: Move): boolean {
  return (
    move.piece.type === "soldier" &&
    (move.from.col === 0 || move.from.col === 8) &&
    Math.abs(move.to.row - move.from.row) === 1
  );
}

function isEarlyRookLift(move: Move, side: Side): boolean {
  return (
    move.piece.type === "rook" &&
    ((side === "red" && move.from.row === 9) || (side === "black" && move.from.row === 0))
  );
}

export function findStrategicBookMove(board: Board, side: Side, legalMoves: Move[]): Move | null {
  if (!isOpening(board)) {
    return null;
  }

  const repertoire = side === "red" ? RED_BOOK : BLACK_BOOK;
  let bestMatch: Move | null = null;
  let bestWeight = -Infinity;

  for (const candidate of repertoire) {
    const matchedMove = legalMoves.find(
      (move) =>
        move.from.row === candidate.from.row &&
        move.from.col === candidate.from.col &&
        move.to.row === candidate.to.row &&
        move.to.col === candidate.to.col,
    );

    if (matchedMove && candidate.weight > bestWeight) {
      bestMatch = matchedMove;
      bestWeight = candidate.weight;
    }
  }

  return bestMatch;
}

export function strategicMoveScore(board: Board, move: Move, side: Side): number {
  let score = 0;
  const opening = isOpening(board);
  const developedCorePieces = hasDevelopedCorePieces(board, side);

  if (opening) {
    if (move.piece.type === "cannon" && move.to.col === 4) {
      score += 240;
    }

    if (move.piece.type === "horse") {
      const naturalHorseSquare =
        (side === "red" && move.to.row === 7 && (move.to.col === 2 || move.to.col === 6)) ||
        (side === "black" && move.to.row === 2 && (move.to.col === 2 || move.to.col === 6));
      if (naturalHorseSquare) {
        score += 220;
      }
    }

    if (move.piece.type === "elephant" && move.to.col === 4) {
      score += 160;
    }

    if (move.piece.type === "advisor" && move.to.col === 4) {
      score += 86;
    }

    if (isCentralSoldierAdvance(move) && !move.captured) {
      score -= developedCorePieces >= 3 ? 60 : 260;
    }

    if (isSideSoldierAdvance(move) && !move.captured) {
      score -= 120;
    }

    if (isEarlyRookLift(move, side) && developedCorePieces < 2 && !move.captured) {
      score -= 200;
    }
  }

  const nextBoard = applyMove(board, move);
  if (move.piece.type === "soldier" && !move.captured && opening) {
    const opponent: Side = side === "red" ? "black" : "red";
    if (isInCheck(nextBoard, opponent)) {
      score += 280;
    }
  }

  if (move.captured) {
    score += Math.round(PIECE_VALUES[move.captured.type] * 0.18);
  }

  return score;
}

export function strategicBoardScore(board: Board, side: Side, gamePhase: number): number {
  let score = 0;
  const opening = isOpening(board);

  if (opening) {
    const developedCorePieces = hasDevelopedCorePieces(board, side);
    score += developedCorePieces * 54;

    const centerPiece = board[side === "red" ? 7 : 2][4];
    if (centerPiece?.side === side && centerPiece.type === "cannon") {
      score += 108;
    }

    const centralSoldier = board[side === "red" ? 5 : 4][4];
    if (centralSoldier?.side === side && centralSoldier.type === "soldier") {
      score -= developedCorePieces >= 3 ? 24 : 150;
    }

    const leftRook = board[side === "red" ? 9 : 0][0];
    const rightRook = board[side === "red" ? 9 : 0][8];
    if ((leftRook?.side !== side || leftRook.type !== "rook") && developedCorePieces < 2) {
      score -= 80;
    }
    if ((rightRook?.side !== side || rightRook.type !== "rook") && developedCorePieces < 2) {
      score -= 80;
    }

    if (developedCorePieces >= 2) {
      score += 48;
    }
  }

  if (gamePhase <= 0.55) {
    let advancedSoldiers = 0;
    for (let row = 0; row < board.length; row += 1) {
      for (let col = 0; col < board[row].length; col += 1) {
        const piece = board[row][col];
        if (!piece || piece.side !== side || piece.type !== "soldier") {
          continue;
        }
        const crossedRiver = side === "red" ? row <= 4 : row >= 5;
        if (crossedRiver) {
          advancedSoldiers += 1;
        }
      }
    }

    if (advancedSoldiers >= 2) {
      score += 42;
    }
  }

  return score;
}
