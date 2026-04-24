import { isInCheck } from "./check";
import { evaluateBoard } from "./evaluation";
import { applyMove, generateAllLegalMoves } from "./moveGenerator";
import { PIECE_VALUES } from "../constants/pieceValues";
import type { Board, Move, Piece, PieceType, Side } from "../types/chess";

export const AI_SEARCH_DEPTH = 10;
export const AI_THINK_TIME_MS = 12000;
export const AI_MAX_TIME_MS = 55000;

const MATE_SCORE = 10_000_000;
const INF_SCORE = 100_000_000;
const QUIESCENCE_LIMIT = 6;
const KILLER_SLOTS = 2;
const TT_MAX_SIZE = 120_000;

type BoundFlag = "exact" | "lower" | "upper";

interface SearchOptions {
  maxDepth?: number;
  timeLimitMs?: number;
}

export interface SearchStats {
  bestMove: Move | null;
  depthReached: number;
  nodes: number;
  elapsedMs: number;
  score: number;
}

interface BookMovePattern {
  from: { row: number; col: number };
  to: { row: number; col: number };
}

interface TranspositionEntry {
  depth: number;
  score: number;
  flag: BoundFlag;
  bestMove?: Move;
}

class SearchTimeoutError extends Error {}

const PIECE_TYPE_INDEX: Record<PieceType, number> = {
  general: 0,
  advisor: 1,
  elephant: 2,
  horse: 3,
  rook: 4,
  cannon: 5,
  soldier: 6,
};

const SIDE_KEY = 0x9e3779b97f4a7c15n;

function createZobristTable(): bigint[][][] {
  let seed = 0x123456789abcdefn;
  const next = (): bigint => {
    seed = (seed + 0x9e3779b97f4a7c15n) & 0xffffffffffffffffn;
    let z = seed;
    z = ((z ^ (z >> 30n)) * 0xbf58476d1ce4e5b9n) & 0xffffffffffffffffn;
    z = ((z ^ (z >> 27n)) * 0x94d049bb133111ebn) & 0xffffffffffffffffn;
    return z ^ (z >> 31n);
  };

  return Array.from({ length: 10 }, () =>
    Array.from({ length: 9 }, () => Array.from({ length: 14 }, () => next())),
  );
}

const ZOBRIST = createZobristTable();

const RED_BOOK: BookMovePattern[] = [
  { from: { row: 7, col: 1 }, to: { row: 7, col: 4 } },
  { from: { row: 9, col: 1 }, to: { row: 7, col: 2 } },
  { from: { row: 9, col: 7 }, to: { row: 7, col: 6 } },
  { from: { row: 6, col: 4 }, to: { row: 5, col: 4 } },
];

const BLACK_BOOK: BookMovePattern[] = [
  { from: { row: 2, col: 1 }, to: { row: 2, col: 4 } },
  { from: { row: 0, col: 1 }, to: { row: 2, col: 2 } },
  { from: { row: 0, col: 7 }, to: { row: 2, col: 6 } },
  { from: { row: 3, col: 4 }, to: { row: 4, col: 4 } },
];

function pieceIndex(piece: Piece): number {
  return PIECE_TYPE_INDEX[piece.type] + (piece.side === "red" ? 7 : 0);
}

function computeHash(board: Board, side: Side): bigint {
  let hash = side === "red" ? SIDE_KEY : 0n;

  for (let row = 0; row < board.length; row += 1) {
    for (let col = 0; col < board[row].length; col += 1) {
      const piece = board[row][col];
      if (!piece) {
        continue;
      }
      hash ^= ZOBRIST[row][col][pieceIndex(piece)];
    }
  }

  return hash;
}

function sameMove(a?: Move, b?: Move): boolean {
  return Boolean(
    a &&
      b &&
      a.from.row === b.from.row &&
      a.from.col === b.from.col &&
      a.to.row === b.to.row &&
      a.to.col === b.to.col,
  );
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

function findBookMove(board: Board, side: Side, legalMoves: Move[]): Move | null {
  if (countOccupied(board) < 28) {
    return null;
  }

  const patterns = side === "red" ? RED_BOOK : BLACK_BOOK;
  for (const pattern of patterns) {
    const match = legalMoves.find(
      (move) =>
        move.from.row === pattern.from.row &&
        move.from.col === pattern.from.col &&
        move.to.row === pattern.to.row &&
        move.to.col === pattern.to.col,
    );
    if (match) {
      return match;
    }
  }

  return null;
}

function moveIndex(position: { row: number; col: number }): number {
  return position.row * 9 + position.col;
}

function isCheckingMove(board: Board, move: Move, side: Side): boolean {
  const nextBoard = applyMove(board, move);
  const opponent: Side = side === "red" ? "black" : "red";
  return isInCheck(nextBoard, opponent);
}

function tacticalScore(board: Board, move: Move, side: Side): number {
  let score = 0;

  if (move.captured) {
    score += PIECE_VALUES[move.captured.type] * 16 - PIECE_VALUES[move.piece.type];
  }

  if (isCheckingMove(board, move, side)) {
    score += 9000;
  }

  if (move.piece.type === "rook") {
    score += 120;
  } else if (move.piece.type === "cannon") {
    score += 90;
  } else if (move.piece.type === "horse") {
    score += 80;
  } else if (move.piece.type === "soldier") {
    score += side === "red" ? 9 - move.to.row : move.to.row;
  }

  return score;
}

function isTacticalMove(board: Board, move: Move, side: Side): boolean {
  return Boolean(move.captured) || isCheckingMove(board, move, side);
}

function orderMoves(
  board: Board,
  moves: Move[],
  side: Side,
  historyTable: number[][],
  killerMoves: Array<Array<Move | undefined>>,
  ply: number,
  preferredMove?: Move,
): Move[] {
  return moves
    .map((move) => {
      let priority = tacticalScore(board, move, side);

      if (sameMove(move, preferredMove)) {
        priority += 2_000_000;
      }

      const killers = killerMoves[ply] ?? [];
      if (sameMove(move, killers[0])) {
        priority += 900_000;
      } else if (sameMove(move, killers[1])) {
        priority += 750_000;
      }

      priority += historyTable[moveIndex(move.from)][moveIndex(move.to)] ?? 0;

      return { move, priority };
    })
    .sort((a, b) => b.priority - a.priority)
    .map(({ move }) => move);
}

function updateKillerMove(
  killerMoves: Array<Array<Move | undefined>>,
  ply: number,
  move: Move,
): void {
  if (!killerMoves[ply]) {
    killerMoves[ply] = Array.from({ length: KILLER_SLOTS }, () => undefined);
  }

  if (sameMove(killerMoves[ply][0], move)) {
    return;
  }

  killerMoves[ply][1] = killerMoves[ply][0];
  killerMoves[ply][0] = move;
}

function quiescence(
  board: Board,
  side: Side,
  alpha: number,
  beta: number,
  ply: number,
  state: SearchState,
): number {
  state.throwIfTimedOut();
  state.nodes += 1;

  const standPat = evaluateBoard(board, side);
  if (standPat >= beta) {
    return beta;
  }
  if (standPat > alpha) {
    alpha = standPat;
  }

  if (ply >= QUIESCENCE_LIMIT) {
    return alpha;
  }

  const legalMoves = generateAllLegalMoves(board, side).filter((move) =>
    isTacticalMove(board, move, side),
  );

  if (legalMoves.length === 0) {
    return alpha;
  }

  const ordered = orderMoves(
    board,
    legalMoves,
    side,
    state.historyTable,
    state.killerMoves,
    ply,
  );

  const opponent: Side = side === "red" ? "black" : "red";

  for (const move of ordered) {
    const score = -quiescence(
      applyMove(board, move),
      opponent,
      -beta,
      -alpha,
      ply + 1,
      state,
    );

    if (score >= beta) {
      return beta;
    }

    if (score > alpha) {
      alpha = score;
    }
  }

  return alpha;
}

interface SearchState {
  startTime: number;
  deadline: number;
  nodes: number;
  historyTable: number[][];
  killerMoves: Array<Array<Move | undefined>>;
  transpositionTable: Map<bigint, TranspositionEntry>;
  throwIfTimedOut: () => void;
}

function negamax(
  board: Board,
  side: Side,
  depth: number,
  alpha: number,
  beta: number,
  ply: number,
  state: SearchState,
): number {
  state.throwIfTimedOut();

  const alphaOriginal = alpha;
  const betaOriginal = beta;
  const hash = computeHash(board, side);
  const cached = state.transpositionTable.get(hash);

  if (cached && cached.depth >= depth) {
    if (cached.flag === "exact") {
      return cached.score;
    }
    if (cached.flag === "lower") {
      alpha = Math.max(alpha, cached.score);
    } else {
      beta = Math.min(beta, cached.score);
    }
    if (alpha >= beta) {
      return cached.score;
    }
  }

  if (depth <= 0) {
    return quiescence(board, side, alpha, beta, ply, state);
  }

  state.nodes += 1;

  const sideInCheck = isInCheck(board, side);
  if (!sideInCheck && depth >= 3) {
    const opponent: Side = side === "red" ? "black" : "red";
    const reduction = depth >= 6 ? 3 : 2;
    const nullScore = -negamax(board, opponent, depth - 1 - reduction, -beta, -beta + 1, ply + 1, state);
    if (nullScore >= beta) {
      return beta;
    }
  }

  const legalMoves = generateAllLegalMoves(board, side);
  if (legalMoves.length === 0) {
    return -MATE_SCORE + ply;
  }

  const orderedMoves = orderMoves(
    board,
    legalMoves,
    side,
    state.historyTable,
    state.killerMoves,
    ply,
    cached?.bestMove,
  );

  const opponent: Side = side === "red" ? "black" : "red";
  let bestScore = -INF_SCORE;
  let bestMove = orderedMoves[0];

  for (let moveOrder = 0; moveOrder < orderedMoves.length; moveOrder += 1) {
    const move = orderedMoves[moveOrder];
    const nextBoard = applyMove(board, move);
    const extension = isInCheck(nextBoard, opponent) ? 1 : 0;
    const isQuiet = !move.captured && extension === 0;
    const reduction =
      depth >= 4 && isQuiet && !sideInCheck && moveOrder >= 4 ? 1 : 0;

    let score = -negamax(
      nextBoard,
      opponent,
      depth - 1 - reduction + extension,
      -alpha - 1,
      -alpha,
      ply + 1,
      state,
    );

    if (score > alpha && score < beta) {
      score = -negamax(
        nextBoard,
        opponent,
        depth - 1 + extension,
        -beta,
        -alpha,
        ply + 1,
        state,
      );
    }

    if (score > bestScore) {
      bestScore = score;
      bestMove = move;
    }

    if (score > alpha) {
      alpha = score;
    }

    if (alpha >= beta) {
      if (!move.captured) {
        updateKillerMove(state.killerMoves, ply, move);
        state.historyTable[moveIndex(move.from)][moveIndex(move.to)] += depth * depth * 24;
      }
      break;
    }
  }

  if (state.transpositionTable.size > TT_MAX_SIZE) {
    state.transpositionTable.clear();
  }

  state.transpositionTable.set(hash, {
    depth,
    score: bestScore,
    flag:
      bestScore <= alphaOriginal
        ? "upper"
        : bestScore >= betaOriginal
          ? "lower"
          : "exact",
    bestMove,
  });

  return bestScore;
}

function createSearchState(timeLimitMs: number): SearchState {
  const startTime = performance.now();
  const deadline = startTime + Math.min(timeLimitMs, AI_MAX_TIME_MS);

  return {
    startTime,
    deadline,
    nodes: 0,
    historyTable: Array.from({ length: 90 }, () => Array.from({ length: 90 }, () => 0)),
    killerMoves: [],
    transpositionTable: new Map<bigint, TranspositionEntry>(),
    throwIfTimedOut: () => {
      if (performance.now() >= deadline) {
        throw new SearchTimeoutError("Search timed out");
      }
    },
  };
}

export function findBestMove(
  board: Board,
  side: Side,
  options: SearchOptions = {},
): SearchStats {
  const maxDepth = options.maxDepth ?? AI_SEARCH_DEPTH;
  const timeLimitMs = options.timeLimitMs ?? AI_THINK_TIME_MS;
  const state = createSearchState(timeLimitMs);
  const rootMoves = generateAllLegalMoves(board, side);

  if (rootMoves.length === 0) {
    return {
      bestMove: null,
      depthReached: 0,
      nodes: state.nodes,
      elapsedMs: performance.now() - state.startTime,
      score: -MATE_SCORE,
    };
  }

  const bookMove = findBookMove(board, side, rootMoves);
  if (bookMove) {
    return {
      bestMove: bookMove,
      depthReached: 0,
      nodes: 0,
      elapsedMs: 0,
      score: tacticalScore(board, bookMove, side),
    };
  }

  let bestMove = rootMoves[0];
  let bestScore = -INF_SCORE;
  let depthReached = 0;

  try {
    let aspirationCenter = 0;
    for (let depth = 1; depth <= maxDepth; depth += 1) {
      const orderedRootMoves = orderMoves(
        board,
        rootMoves,
        side,
        state.historyTable,
        state.killerMoves,
        0,
        bestMove,
      );

      let currentBestMove = orderedRootMoves[0];
      let currentBestScore = -INF_SCORE;
      let alpha = depth >= 3 ? Math.max(-INF_SCORE, aspirationCenter - 180) : -INF_SCORE;
      let beta = depth >= 3 ? Math.min(INF_SCORE, aspirationCenter + 180) : INF_SCORE;

      while (true) {
        const alphaStart = alpha;
        const betaStart = beta;
        currentBestScore = -INF_SCORE;
        currentBestMove = orderedRootMoves[0];
        let localAlpha = alpha;

        for (const move of orderedRootMoves) {
          state.throwIfTimedOut();
          const nextBoard = applyMove(board, move);
          const opponent: Side = side === "red" ? "black" : "red";
          const extension = isInCheck(nextBoard, opponent) ? 1 : 0;
          const score = -negamax(
            nextBoard,
            opponent,
            depth - 1 + extension,
            -beta,
            -localAlpha,
            1,
            state,
          );

          if (score > currentBestScore) {
            currentBestScore = score;
            currentBestMove = move;
          }

          if (score > localAlpha) {
            localAlpha = score;
          }
        }

        if (currentBestScore <= alphaStart && alphaStart !== -INF_SCORE) {
          alpha = Math.max(-INF_SCORE, alphaStart - 260);
          beta = Math.min(INF_SCORE, betaStart + 120);
          continue;
        }
        if (currentBestScore >= betaStart && betaStart !== INF_SCORE) {
          alpha = Math.max(-INF_SCORE, alphaStart - 120);
          beta = Math.min(INF_SCORE, betaStart + 260);
          continue;
        }
        break;
      }

      bestMove = currentBestMove;
      bestScore = currentBestScore;
      depthReached = depth;
      aspirationCenter = bestScore;
    }
  } catch (error) {
    if (!(error instanceof SearchTimeoutError)) {
      throw error;
    }
  }

  return {
    bestMove,
    depthReached,
    nodes: state.nodes,
    elapsedMs: performance.now() - state.startTime,
    score: bestScore,
  };
}
