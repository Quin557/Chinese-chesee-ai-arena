/// <reference lib="webworker" />

import { AI_THINK_TIME_MS, findBestMove } from "../engine/ai";
import type { Board, Move, Side } from "../types/chess";

interface AiWorkerRequest {
  requestId: number;
  board: Board;
  side: Side;
  maxDepth: number;
  timeLimitMs?: number;
  moveHistory?: Move[];
}

interface AiWorkerResponse {
  requestId: number;
  move: Move | null;
  depthReached: number;
  nodes: number;
  elapsedMs: number;
  score: number;
}

declare const self: DedicatedWorkerGlobalScope;

self.onmessage = (event: MessageEvent<AiWorkerRequest>) => {
  const { requestId, board, side, maxDepth, timeLimitMs, moveHistory } = event.data;
  const result = findBestMove(board, side, {
    maxDepth,
    timeLimitMs: timeLimitMs ?? AI_THINK_TIME_MS,
    moveHistory: moveHistory ?? [],
  });

  self.postMessage({
    requestId,
    move: result.bestMove,
    depthReached: result.depthReached,
    nodes: result.nodes,
    elapsedMs: result.elapsedMs,
    score: result.score,
  } satisfies AiWorkerResponse);
};

export {};
