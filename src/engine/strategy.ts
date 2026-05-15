import { isInCheck } from "./check";
import { generatePseudoLegalMovesForPiece } from "./rules";
import { applyMove, generateAllLegalMoves, generateLegalMovesForPiece } from "./moveGenerator";
import { PIECE_VALUES } from "../constants/pieceValues";
import type { Board, Move, PieceType, Position, Side } from "../types/chess";

interface WeightedBookMove {
  from: { row: number; col: number };
  to: { row: number; col: number };
  weight: number;
  required?: Array<{ row: number; col: number; side: Side; type: PieceType }>;
  forbidden?: Array<{ row: number; col: number; side?: Side; type?: PieceType }>;
}

const OPENING_OCCUPIED_THRESHOLD = 28;
const CLASSIC_BOOK_THRESHOLD = 260;
const HIGH_VALUE_THREAT = PIECE_VALUES.horse;

export interface StrategicJudgement {
  initiative: number;
  forcingMoves: number;
  stableThreats: number;
  futileChases: number;
  mobility: number;
}

const RED_BOOK: WeightedBookMove[] = [
  { from: { row: 7, col: 1 }, to: { row: 7, col: 4 }, weight: 380 },
  { from: { row: 7, col: 7 }, to: { row: 7, col: 4 }, weight: 378 },
  { from: { row: 9, col: 1 }, to: { row: 7, col: 2 }, weight: 320 },
  { from: { row: 9, col: 7 }, to: { row: 7, col: 6 }, weight: 318 },
  { from: { row: 9, col: 0 }, to: { row: 8, col: 0 }, weight: 292, required: [{ row: 7, col: 4, side: "red", type: "cannon" }] },
  { from: { row: 9, col: 8 }, to: { row: 8, col: 8 }, weight: 286, required: [{ row: 7, col: 4, side: "red", type: "cannon" }] },
  { from: { row: 6, col: 4 }, to: { row: 5, col: 4 }, weight: 268, required: [{ row: 7, col: 4, side: "red", type: "cannon" }] },
  { from: { row: 9, col: 2 }, to: { row: 7, col: 4 }, weight: 250 },
  { from: { row: 9, col: 6 }, to: { row: 7, col: 4 }, weight: 246 },
  { from: { row: 7, col: 4 }, to: { row: 2, col: 4 }, weight: 230, required: [{ row: 7, col: 4, side: "red", type: "cannon" }] },
  { from: { row: 9, col: 3 }, to: { row: 8, col: 4 }, weight: 184 },
  { from: { row: 9, col: 5 }, to: { row: 8, col: 4 }, weight: 182 },
];

const BLACK_BOOK: WeightedBookMove[] = [
  { from: { row: 2, col: 1 }, to: { row: 2, col: 4 }, weight: 380 },
  { from: { row: 2, col: 7 }, to: { row: 2, col: 4 }, weight: 378 },
  { from: { row: 0, col: 1 }, to: { row: 2, col: 2 }, weight: 320 },
  { from: { row: 0, col: 7 }, to: { row: 2, col: 6 }, weight: 318 },
  { from: { row: 0, col: 0 }, to: { row: 1, col: 0 }, weight: 292, required: [{ row: 2, col: 4, side: "black", type: "cannon" }] },
  { from: { row: 0, col: 8 }, to: { row: 1, col: 8 }, weight: 286, required: [{ row: 2, col: 4, side: "black", type: "cannon" }] },
  { from: { row: 3, col: 4 }, to: { row: 4, col: 4 }, weight: 268, required: [{ row: 2, col: 4, side: "black", type: "cannon" }] },
  { from: { row: 0, col: 2 }, to: { row: 2, col: 4 }, weight: 250 },
  { from: { row: 0, col: 6 }, to: { row: 2, col: 4 }, weight: 246 },
  { from: { row: 2, col: 4 }, to: { row: 7, col: 4 }, weight: 230, required: [{ row: 2, col: 4, side: "black", type: "cannon" }] },
  { from: { row: 0, col: 3 }, to: { row: 1, col: 4 }, weight: 184 },
  { from: { row: 0, col: 5 }, to: { row: 1, col: 4 }, weight: 182 },
];

function matchesBookCondition(board: Board, candidate: WeightedBookMove): boolean {
  const required = candidate.required ?? [];
  const forbidden = candidate.forbidden ?? [];

  for (const condition of required) {
    const piece = board[condition.row]?.[condition.col];
    if (piece?.side !== condition.side || piece.type !== condition.type) {
      return false;
    }
  }

  for (const condition of forbidden) {
    const piece = board[condition.row]?.[condition.col];
    if (!piece) {
      continue;
    }
    if ((!condition.side || piece.side === condition.side) && (!condition.type || piece.type === condition.type)) {
      return false;
    }
  }

  return true;
}

function centralFilesScore(col: number): number {
  return 4 - Math.abs(4 - col);
}
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

function opponentOf(side: Side): Side {
  return side === "red" ? "black" : "red";
}

function samePosition(a: Position, b: Position): boolean {
  return a.row === b.row && a.col === b.col;
}

function isSquareAttackedBy(board: Board, target: Position, attacker: Side): boolean {
  for (let row = 0; row < board.length; row += 1) {
    for (let col = 0; col < board[row].length; col += 1) {
      const piece = board[row][col];
      if (piece?.side !== attacker) {
        continue;
      }

      if (
        generatePseudoLegalMovesForPiece(board, { row, col }).some((move) =>
          samePosition(move.to, target),
        )
      ) {
        return true;
      }
    }
  }

  return false;
}

function attackedEnemyPieces(board: Board, side: Side): Position[] {
  const opponent = opponentOf(side);
  const attacked: Position[] = [];

  for (let row = 0; row < board.length; row += 1) {
    for (let col = 0; col < board[row].length; col += 1) {
      const piece = board[row][col];
      if (piece?.side === opponent && isSquareAttackedBy(board, { row, col }, side)) {
        attacked.push({ row, col });
      }
    }
  }

  return attacked;
}

function safeEscapeCount(board: Board, target: Position, attacker: Side): number {
  const targetPiece = board[target.row]?.[target.col];
  if (!targetPiece) {
    return 0;
  }

  let escapes = 0;
  const legalMoves = generateLegalMovesForPiece(board, target);

  for (const escape of legalMoves) {
    if (escape.captured) {
      continue;
    }

    const escapedBoard = applyMove(board, escape);
    if (!isSquareAttackedBy(escapedBoard, escape.to, attacker)) {
      escapes += 1;
    }
  }

  return escapes;
}

function quietChaseProfile(board: Board, move: Move, side: Side): { futile: number; stable: number } {
  if (move.captured || isInCheck(applyMove(board, move), opponentOf(side))) {
    return { futile: 0, stable: 0 };
  }

  const beforeAttacks = attackedEnemyPieces(board, side);
  const nextBoard = applyMove(board, move);
  const afterAttacks = attackedEnemyPieces(nextBoard, side);
  let futile = 0;
  let stable = 0;

  for (const target of afterAttacks) {
    const targetPiece = nextBoard[target.row]?.[target.col];
    if (!targetPiece || PIECE_VALUES[targetPiece.type] < HIGH_VALUE_THREAT) {
      continue;
    }

    const wasAlreadyAttacked = beforeAttacks.some((position) => samePosition(position, target));
    if (wasAlreadyAttacked) {
      continue;
    }

    const escapes = safeEscapeCount(nextBoard, target, side);
    if (escapes > 0 && escapes <= 2) {
      futile += escapes === 1 ? 1.25 : 1;
    } else if (escapes === 0) {
      stable += 1;
    }
  }

  return { futile, stable };
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
        move.to.col === candidate.to.col &&
        matchesBookCondition(board, candidate),
    );

    if (matchedMove && candidate.weight > bestWeight) {
      bestMatch = matchedMove;
      bestWeight = candidate.weight;
    }
  }

  return bestMatch;
}

export function classicBookMoveScore(board: Board, move: Move, side: Side): number {
  if (!isOpening(board)) {
    return 0;
  }

  const repertoire = side === "red" ? RED_BOOK : BLACK_BOOK;
  let score = 0;

  for (const candidate of repertoire) {
    if (
      move.from.row === candidate.from.row &&
      move.from.col === candidate.from.col &&
      move.to.row === candidate.to.row &&
      move.to.col === candidate.to.col &&
      matchesBookCondition(board, candidate)
    ) {
      score = Math.max(score, candidate.weight + CLASSIC_BOOK_THRESHOLD);
    }
  }

  return score;
}

export function classicMoveScore(board: Board, move: Move, side: Side): number {
  let score = 0;
  const opening = isOpening(board);
  const homeRow = side === "red" ? 9 : 0;
  const palaceRow = side === "red" ? 8 : 1;
  const cannonRow = side === "red" ? 7 : 2;
  const riverEntryRow = side === "red" ? 5 : 4;
  const developedCorePieces = hasDevelopedCorePieces(board, side);

  if (move.piece.type === "cannon" && move.to.col === 4) {
    score += opening ? 520 : 150;
  }

  if (move.piece.type === "horse") {
    const naturalHorseSquare =
      move.to.row === cannonRow && (move.to.col === 2 || move.to.col === 6);
    const rimHorse = move.to.col === 0 || move.to.col === 8;
    score += naturalHorseSquare ? 420 : 0;
    score -= rimHorse ? 130 : 0;
  }

  if (move.piece.type === "rook") {
    const earlyRookOut = move.from.row === homeRow && (move.to.row === homeRow || move.to.row === palaceRow);
    const centralizingFile = centralFilesScore(move.to.col) - centralFilesScore(move.from.col);
    score += earlyRookOut && developedCorePieces >= 1 ? 210 : 0;
    score += centralizingFile * 32;
    if (opening && developedCorePieces === 0 && !move.captured) {
      score -= 170;
    }
  }

  if (move.piece.type === "elephant" && move.to.col === 4) {
    score += opening ? 240 : 80;
  }

  if (move.piece.type === "advisor" && move.to.row === palaceRow && move.to.col === 4) {
    score += opening ? 155 : 70;
  }

  if (move.piece.type === "soldier") {
    if (move.from.col === 4 && move.to.row === riverEntryRow) {
      score += developedCorePieces >= 2 ? 120 : -230;
    }
    if ((move.from.col === 0 || move.from.col === 8) && opening && !move.captured) {
      score -= 180;
    }
    if (move.to.col >= 3 && move.to.col <= 5) {
      score += 45;
    }
  }

  const nextBoard = applyMove(board, move);
  const profile = quietChaseProfile(board, move, side);
  const opponent = opponentOf(side);
  if (!move.captured && !isInCheck(nextBoard, opponent) && profile.futile > 0) {
    score -= profile.futile * 520;
  }
  score += profile.stable * 310;

  return Math.round(score);
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

export function masterMoveScore(board: Board, move: Move, side: Side): number {
  const profile = quietChaseProfile(board, move, side);
  let score = profile.stable * 340 - profile.futile * 460;

  if (move.captured) {
    score += Math.round(PIECE_VALUES[move.captured.type] * 0.28);
  }

  return score;
}

export function analyzeStrategicJudgement(board: Board, side: Side): StrategicJudgement {
  const opponent = opponentOf(side);
  const legalMoves = generateAllLegalMoves(board, side);
  let forcingMoves = 0;
  let stableThreats = 0;
  let futileChases = 0;

  for (const move of legalMoves) {
    const nextBoard = applyMove(board, move);
    if (move.captured && PIECE_VALUES[move.captured.type] >= HIGH_VALUE_THREAT) {
      forcingMoves += 1;
    }
    if (isInCheck(nextBoard, opponent)) {
      forcingMoves += 2;
    }

    const profile = quietChaseProfile(board, move, side);
    stableThreats += profile.stable;
    futileChases += profile.futile;
  }

  return {
    initiative: forcingMoves * 48 + stableThreats * 72 - futileChases * 66,
    forcingMoves,
    stableThreats,
    futileChases,
    mobility: legalMoves.length,
  };
}

function rookControlScore(board: Board, side: Side): number {
  let score = 0;

  for (let row = 0; row < board.length; row += 1) {
    for (let col = 0; col < board[row].length; col += 1) {
      const piece = board[row][col];
      if (piece?.side !== side || piece.type !== "rook") {
        continue;
      }

      let verticalSpace = 0;
      for (let targetRow = row - 1; targetRow >= 0 && !board[targetRow][col]; targetRow -= 1) {
        verticalSpace += 1;
      }
      for (let targetRow = row + 1; targetRow < 10 && !board[targetRow][col]; targetRow += 1) {
        verticalSpace += 1;
      }
      score += verticalSpace * 10 + centralFilesScore(col) * 18;
    }
  }

  return score;
}

function fortressScore(board: Board, side: Side): number {
  const homeRows = side === "red" ? [7, 8, 9] : [0, 1, 2];
  let guards = 0;
  let score = 0;

  for (const row of homeRows) {
    for (let col = 3; col <= 5; col += 1) {
      const piece = board[row][col];
      if (piece?.side === side && (piece.type === "advisor" || piece.type === "elephant")) {
        guards += 1;
      }
    }
  }

  score += guards * 34;
  if (guards >= 3) {
    score += 90;
  }

  return score;
}
export function strategicBoardScore(board: Board, side: Side, gamePhase: number): number {
  let score = 0;
  const opening = isOpening(board);

  score += rookControlScore(board, side);
  score += fortressScore(board, side) * (gamePhase >= 0.45 ? 1 : 0.65);

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
