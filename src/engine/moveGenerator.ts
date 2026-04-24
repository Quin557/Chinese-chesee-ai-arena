import { isInCheck } from "./check";
import { generatePseudoLegalMovesForPiece } from "./rules";
import type { Board, Move, Piece, Position, Side } from "../types/chess";

function clonePiece(piece: Piece): Piece {
  return { ...piece };
}

export function cloneBoard(board: Board): Board {
  return board.map((row) => row.map((cell) => (cell ? clonePiece(cell) : null)));
}

function positionToText(position: Position): string {
  return `(${position.row + 1},${position.col + 1})`;
}

export function buildMoveNotation(move: Omit<Move, "notation">): string {
  const capturePart = move.captured ? `吃${move.captured.label}` : "至";
  return `${move.piece.side === "red" ? "红" : "黑"}${move.piece.label}${positionToText(move.from)}${capturePart}${positionToText(move.to)}`;
}

export function applyMove(board: Board, move: Move): Board {
  const nextBoard = cloneBoard(board);
  const movingPiece = nextBoard[move.from.row][move.from.col];

  if (!movingPiece) {
    return nextBoard;
  }

  nextBoard[move.from.row][move.from.col] = null;
  nextBoard[move.to.row][move.to.col] = clonePiece(movingPiece);

  return nextBoard;
}

export function generateLegalMovesForPiece(board: Board, from: Position): Move[] {
  const piece = board[from.row][from.col];
  if (!piece) {
    return [];
  }

  const pseudoMoves = generatePseudoLegalMovesForPiece(board, from);

  return pseudoMoves
    .map((move) => ({
      ...move,
      notation: buildMoveNotation(move),
    }))
    .filter((move) => !isInCheck(applyMove(board, move), piece.side));
}

export function generateAllLegalMoves(board: Board, side: Side): Move[] {
  const moves: Move[] = [];

  for (let row = 0; row < board.length; row += 1) {
    for (let col = 0; col < board[row].length; col += 1) {
      const piece = board[row][col];
      if (piece?.side === side) {
        moves.push(...generateLegalMovesForPiece(board, { row, col }));
      }
    }
  }

  return moves;
}
