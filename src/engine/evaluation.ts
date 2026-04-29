import { areGeneralsFacing, findGeneral, isInCheck } from "./check";
import { strategicBoardScore } from "./strategy";
import { CHECK_BONUS, PIECE_VALUES, SOLDIER_CROSS_RIVER_BONUS } from "../constants/pieceValues";
import type { Board, EvalBreakdown, Piece, Position, Side } from "../types/chess";

function forwardProgress(side: Side, row: number): number {
  return side === "red" ? 9 - row : row;
}

function pieceSquareBonus(piece: Piece, row: number, col: number, gamePhase: number): number {
  let bonus = 0;
  const centerFilePressure = 4 - Math.abs(4 - col);
  const progress = forwardProgress(piece.side, row);

  if (piece.type === "soldier") {
    const crossedRiver = piece.side === "red" ? row <= 4 : row >= 5;
    if (crossedRiver) {
      bonus += SOLDIER_CROSS_RIVER_BONUS + centerFilePressure * 18;
    }
    bonus += progress * 12;
  }

  if (piece.type === "horse") {
    bonus += centerFilePressure * 14;
    bonus += progress * 9;
  }

  if (piece.type === "rook") {
    bonus += centerFilePressure * 12;
    bonus += progress * (gamePhase >= 0.55 ? 10 : 6);
  }

  if (piece.type === "cannon") {
    bonus += centerFilePressure * 13;
    bonus += progress * 5;
  }

  if (piece.type === "advisor" || piece.type === "elephant") {
    bonus += gamePhase >= 0.55 ? 28 : 18;
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

function computeGamePhase(board: Board): number {
  let remainingForce = 0;
  const maxForce =
    4 * PIECE_VALUES.rook +
    4 * PIECE_VALUES.horse +
    4 * PIECE_VALUES.cannon +
    10 * PIECE_VALUES.soldier;

  for (let row = 0; row < board.length; row += 1) {
    for (let col = 0; col < board[row].length; col += 1) {
      const piece = board[row][col];
      if (!piece || piece.type === "general" || piece.type === "advisor" || piece.type === "elephant") {
        continue;
      }
      remainingForce += PIECE_VALUES[piece.type];
    }
  }

  return Math.min(1, remainingForce / maxForce);
}

function palaceSquares(side: Side): Position[] {
  const rows = side === "red" ? [7, 8, 9] : [0, 1, 2];
  const squares: Position[] = [];

  for (const row of rows) {
    for (let col = 3; col <= 5; col += 1) {
      squares.push({ row, col });
    }
  }

  return squares;
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
        score += (4 - Math.abs(4 - col)) * 12;
      }

      if (piece.type === "soldier") {
        const crossedRiver = piece.side === "red" ? row <= 4 : row >= 5;
        if (crossedRiver) {
          score += (4 - Math.abs(4 - col)) * 14;
        }
      }
    }
  }
  return score;
}

function generalSafety(board: Board, side: Side, gamePhase: number): number {
  const general = findGeneral(board, side);
  if (!general) {
    return -CHECK_BONUS * 10;
  }

  const palaceRows = side === "red" ? [7, 8, 9] : [0, 1, 2];
  let guards = 0;
  let cover = 0;

  for (const row of palaceRows) {
    for (let col = 3; col <= 5; col += 1) {
      const piece = board[row][col];
      if (piece?.side === side && (piece.type === "advisor" || piece.type === "elephant")) {
        guards += 1;
      }
    }
  }

  const directions = [
    { row: -1, col: 0 },
    { row: 1, col: 0 },
    { row: 0, col: -1 },
    { row: 0, col: 1 },
  ];

  for (const direction of directions) {
    const next = board[general.row + direction.row]?.[general.col + direction.col];
    if (next?.side === side) {
      cover += 1;
    }
  }

  let score = guards * 58 + cover * 18;
  if (general.col === 4) {
    score += 26;
  }
  if (gamePhase <= 0.4 && guards <= 1) {
    score -= 70;
  }

  return score;
}

function cannonBatteryScore(board: Board, side: Side): number {
  const opponent: Side = side === "red" ? "black" : "red";
  const enemyGeneral = findGeneral(board, opponent);
  if (!enemyGeneral) {
    return 0;
  }

  let score = 0;

  for (let col = 0; col < 9; col += 1) {
    let blockers = 0;
    let heavyPieces = 0;

    for (let row = 0; row < 10; row += 1) {
      const piece = board[row][col];
      if (!piece) {
        continue;
      }
      if (piece.side === side && (piece.type === "rook" || piece.type === "cannon")) {
        heavyPieces += piece.type === "rook" ? 2 : 1;
      } else {
        blockers += 1;
      }
    }

    if (col === enemyGeneral.col && heavyPieces > 0) {
      score += heavyPieces * 28;
      if (blockers <= 2) {
        score += 30;
      }
    }
  }

  return score;
}

function palaceAttackScore(board: Board, side: Side): number {
  const opponent: Side = side === "red" ? "black" : "red";
  const targets = palaceSquares(opponent);
  let score = 0;

  for (let row = 0; row < board.length; row += 1) {
    for (let col = 0; col < board[row].length; col += 1) {
      const piece = board[row][col];
      if (!piece || piece.side !== side) {
        continue;
      }

      const progress = forwardProgress(side, row);
      if (piece.type === "rook" || piece.type === "cannon" || piece.type === "horse") {
        score += Math.max(0, progress - 3) * 7;
      }

      if (piece.type === "soldier") {
        const crossedRiver = side === "red" ? row <= 4 : row >= 5;
        if (crossedRiver) {
          score += targets.some((target) => Math.abs(target.row - row) + Math.abs(target.col - col) <= 2)
            ? 28
            : 10;
        }
      }
    }
  }

  return score;
}

function horseTrapPenalty(board: Board, side: Side): number {
  let penalty = 0;
  for (let row = 0; row < board.length; row += 1) {
    for (let col = 0; col < board[row].length; col += 1) {
      const piece = board[row][col];
      if (!piece || piece.side !== side || piece.type !== "horse") {
        continue;
      }

      let blockedLegs = 0;
      const legs = [
        { row: -1, col: 0 },
        { row: 1, col: 0 },
        { row: 0, col: -1 },
        { row: 0, col: 1 },
      ];

      for (const leg of legs) {
        if (board[row + leg.row]?.[col + leg.col]) {
          blockedLegs += 1;
        }
      }

      if (blockedLegs >= 2) {
        penalty += blockedLegs * 20;
      }
    }
  }

  return penalty;
}

function soldierStructureScore(board: Board, side: Side): number {
  const soldierRows = new Map<number, number[]>();
  let score = 0;

  for (let row = 0; row < board.length; row += 1) {
    for (let col = 0; col < board[row].length; col += 1) {
      const piece = board[row][col];
      if (!piece || piece.side !== side || piece.type !== "soldier") {
        continue;
      }

      const crossedRiver = side === "red" ? row <= 4 : row >= 5;
      const progress = forwardProgress(side, row);
      score += progress * 9;
      if (crossedRiver) {
        score += 44 + (4 - Math.abs(4 - col)) * 8;
      }

      const existing = soldierRows.get(row) ?? [];
      existing.push(col);
      soldierRows.set(row, existing);
    }
  }

  for (const cols of soldierRows.values()) {
    cols.sort((a, b) => a - b);
    for (let index = 1; index < cols.length; index += 1) {
      if (cols[index] - cols[index - 1] === 1) {
        score += 28;
      }
    }
  }

  return score;
}

function developmentScore(board: Board, side: Side, gamePhase: number): number {
  let score = 0;

  for (let row = 0; row < board.length; row += 1) {
    for (let col = 0; col < board[row].length; col += 1) {
      const piece = board[row][col];
      if (!piece || piece.side !== side) {
        continue;
      }

      const progress = forwardProgress(side, row);
      if (piece.type === "horse" || piece.type === "cannon" || piece.type === "rook") {
        score += progress * (gamePhase >= 0.55 ? 8 : 5);
      }

      if (piece.type === "rook" && progress >= 3) {
        score += 20;
      }

      if (piece.type === "cannon" && progress >= 2) {
        score += 16;
      }
    }
  }

  return score - horseTrapPenalty(board, side) + soldierStructureScore(board, side);
}

function conversionPressure(board: Board, side: Side, materialLead: number, gamePhase: number): number {
  if (materialLead <= 250) {
    return 0;
  }

  const remainingPieces =
    countPieces(board, side, "rook") +
    countPieces(board, side, "horse") +
    countPieces(board, side, "cannon") +
    countPieces(board, side, "soldier");

  return Math.round((materialLead / 20) * (1 - gamePhase) + remainingPieces * 6);
}

export function evaluateDetailedBoard(board: Board, perspective: Side): EvalBreakdown {
  const opponent: Side = perspective === "red" ? "black" : "red";
  const gamePhase = computeGamePhase(board);
  let material = 0;

  for (let row = 0; row < board.length; row += 1) {
    for (let col = 0; col < board[row].length; col += 1) {
      const piece = board[row][col];
      if (!piece) {
        continue;
      }

      const value = PIECE_VALUES[piece.type] + pieceSquareBonus(piece, row, col, gamePhase);
      material += piece.side === perspective ? value : -value;
    }
  }

  const centerControl = centralControl(board, perspective) - centralControl(board, opponent);
  const kingSafety =
    generalSafety(board, perspective, gamePhase) -
    generalSafety(board, opponent, gamePhase) +
    palaceAttackScore(board, perspective) -
    palaceAttackScore(board, opponent);
  const filePressure =
    cannonBatteryScore(board, perspective) - cannonBatteryScore(board, opponent);
  let development =
    developmentScore(board, perspective, gamePhase) -
    developmentScore(board, opponent, gamePhase);

  const myRooks = countPieces(board, perspective, "rook");
  const myCannons = countPieces(board, perspective, "cannon");
  const myHorses = countPieces(board, perspective, "horse");
  development += myRooks >= 2 ? 80 : 0;
  development += myCannons >= 2 ? 52 : 0;
  development += myHorses >= 2 ? 36 : 0;
  development += conversionPressure(board, perspective, material, gamePhase);
  development -= conversionPressure(board, opponent, -material, gamePhase);
  development += strategicBoardScore(board, perspective, gamePhase);
  development -= strategicBoardScore(board, opponent, gamePhase);

  let tactical = 0;

  if (isInCheck(board, opponent)) {
    tactical += CHECK_BONUS + 130;
  }

  if (isInCheck(board, perspective)) {
    tactical -= CHECK_BONUS + 130;
  }

  if (areGeneralsFacing(board)) {
    tactical += 150;
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
