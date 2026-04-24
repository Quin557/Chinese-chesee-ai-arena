import { areGeneralsFacing, isInCheck } from "./check";
import { CHECK_BONUS, PIECE_VALUES, SOLDIER_CROSS_RIVER_BONUS } from "../constants/pieceValues";
import type { Board, EvalBreakdown, Piece, Side } from "../types/chess";

function pieceSquareBonus(piece: Piece, row: number, col: number): number {
  let bonus = 0;
  const centerFilePressure = 4 - Math.abs(4 - col);

  if (piece.type === "soldier") {
    const crossedRiver = piece.side === "red" ? row <= 4 : row >= 5;
    if (crossedRiver) {
      bonus += SOLDIER_CROSS_RIVER_BONUS + centerFilePressure * 16;
    }
    bonus += piece.side === "red" ? 9 - row : row;
  }

  if (piece.type === "horse") {
    bonus += centerFilePressure * 12;
    bonus += piece.side === "red" ? 9 - row : row;
  }

  if (piece.type === "rook") {
    bonus += centerFilePressure * 10;
    bonus += (piece.side === "red" ? 9 - row : row) * 8;
  }

  if (piece.type === "cannon") {
    bonus += centerFilePressure * 11;
  }

  if (piece.type === "advisor" || piece.type === "elephant") {
    bonus += 24;
  }

  return bonus;
}

function countPieces(board: Board, side: Side, type: Piece["type"]): number {
  let count = 0;
  for (let row = 0; row < board.length; row += 1) {
    for (let col = 0; col < board[row].length; col += 1) {
      const piece = board[row][col];
      if (piece?.side === side && piece.type === type) {
        count += 1;
      }
    }
  }
  return count;
}

function centralControl(board: Board, side: Side): number {
  let score = 0;
  for (let row = 0; row < board.length; row += 1) {
    for (let col = 0; col < board[row].length; col += 1) {
      const piece = board[row][col];
      if (!piece || piece.side !== side) {
        continue;
      }

      if (piece.type === "rook" || piece.type === "cannon" || piece.type === "horse") {
        score += 4 - Math.abs(4 - col);
      }
    }
  }
  return score * 10;
}

function generalSafety(board: Board, side: Side): number {
  const palaceRows = side === "red" ? [7, 8, 9] : [0, 1, 2];
  let guards = 0;

  for (const row of palaceRows) {
    for (let col = 3; col <= 5; col += 1) {
      const piece = board[row][col];
      if (piece?.side === side && (piece.type === "advisor" || piece.type === "elephant")) {
        guards += 1;
      }
    }
  }

  return guards * 45;
}

function openLinePressure(board: Board, side: Side): number {
  const opponent: Side = side === "red" ? "black" : "red";
  let score = 0;

  for (let col = 0; col < 9; col += 1) {
    let friendlyHeavy = 0;
    let enemyGeneralSeen = false;

    for (let row = 0; row < 10; row += 1) {
      const piece = board[row][col];
      if (!piece) {
        continue;
      }

      if (piece.side === side && (piece.type === "rook" || piece.type === "cannon")) {
        friendlyHeavy += 1;
      }

      if (piece.side === opponent && piece.type === "general") {
        enemyGeneralSeen = true;
      }
    }

    if (friendlyHeavy > 0 && enemyGeneralSeen) {
      score += friendlyHeavy * 40;
    }
  }

  return score;
}

function developmentScore(board: Board, side: Side): number {
  let score = 0;

  for (let row = 0; row < board.length; row += 1) {
    for (let col = 0; col < board[row].length; col += 1) {
      const piece = board[row][col];
      if (!piece || piece.side !== side) {
        continue;
      }

      if (piece.type === "horse" || piece.type === "cannon" || piece.type === "rook") {
        score += side === "red" ? (9 - row) * 6 : row * 6;
      }
    }
  }

  return score;
}

export function evaluateDetailedBoard(board: Board, perspective: Side): EvalBreakdown {
  const opponent: Side = perspective === "red" ? "black" : "red";
  let material = 0;

  for (let row = 0; row < board.length; row += 1) {
    for (let col = 0; col < board[row].length; col += 1) {
      const piece = board[row][col];
      if (!piece) {
        continue;
      }

      const value = PIECE_VALUES[piece.type] + pieceSquareBonus(piece, row, col);
      material += piece.side === perspective ? value : -value;
    }
  }

  const centerControl =
    centralControl(board, perspective) - centralControl(board, opponent);
  const kingSafety = generalSafety(board, perspective) - generalSafety(board, opponent);
  const filePressure =
    openLinePressure(board, perspective) - openLinePressure(board, opponent);
  let development =
    developmentScore(board, perspective) - developmentScore(board, opponent);

  const myRooks = countPieces(board, perspective, "rook");
  const myCannons = countPieces(board, perspective, "cannon");
  const myHorses = countPieces(board, perspective, "horse");
  development += myRooks >= 2 ? 70 : 0;
  development += myCannons >= 2 ? 40 : 0;
  development += myHorses >= 2 ? 30 : 0;

  let tactical = 0;

  if (isInCheck(board, opponent)) {
    tactical += CHECK_BONUS + 100;
  }

  if (isInCheck(board, perspective)) {
    tactical -= CHECK_BONUS + 100;
  }

  if (areGeneralsFacing(board)) {
    tactical += 120;
  }

  const total = material + centerControl + kingSafety + filePressure + development + tactical;

  return {
    material,
    kingSafety: kingSafety + tactical,
    centerControl,
    openLinePressure: filePressure,
    development,
    total,
  };
}

export function evaluateBoard(board: Board, perspective: Side): number {
  return evaluateDetailedBoard(board, perspective).total;
}
