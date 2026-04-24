import { generatePseudoLegalMovesForPiece } from "./rules";
import type { Board, Position, Side } from "../types/chess";

export function findGeneral(board: Board, side: Side): Position | null {
  for (let row = 0; row < board.length; row += 1) {
    for (let col = 0; col < board[row].length; col += 1) {
      const piece = board[row][col];
      if (piece?.side === side && piece.type === "general") {
        return { row, col };
      }
    }
  }

  return null;
}

export function areGeneralsFacing(board: Board): boolean {
  const blackGeneral = findGeneral(board, "black");
  const redGeneral = findGeneral(board, "red");

  if (!blackGeneral || !redGeneral || blackGeneral.col !== redGeneral.col) {
    return false;
  }

  const start = Math.min(blackGeneral.row, redGeneral.row) + 1;
  const end = Math.max(blackGeneral.row, redGeneral.row);

  for (let row = start; row < end; row += 1) {
    if (board[row][blackGeneral.col]) {
      return false;
    }
  }

  return true;
}

export function isInCheck(board: Board, side: Side): boolean {
  const general = findGeneral(board, side);
  if (!general) {
    return true;
  }

  if (areGeneralsFacing(board)) {
    return true;
  }

  const attackerSide: Side = side === "red" ? "black" : "red";

  for (let row = 0; row < board.length; row += 1) {
    for (let col = 0; col < board[row].length; col += 1) {
      const piece = board[row][col];
      if (!piece || piece.side !== attackerSide) {
        continue;
      }

      const moves = generatePseudoLegalMovesForPiece(board, { row, col });
      if (moves.some((move) => move.to.row === general.row && move.to.col === general.col)) {
        return true;
      }
    }
  }

  return false;
}
