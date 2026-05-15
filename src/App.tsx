import { useEffect, useMemo, useRef, useState } from "react";
import ChessBoard from "./components/ChessBoard";
import GameInfo from "./components/GameInfo";
import MoveHistory from "./components/MoveHistory";
import WinProbabilityChart from "./components/WinProbabilityChart";
import { createInitialBoard } from "./constants/initialBoard";
import { AI_SEARCH_DEPTH, AI_THINK_TIME_MS } from "./engine/ai";
import { isInCheck } from "./engine/check";
import {
  applyMove,
  cloneBoard,
  generateAllLegalMoves,
  generateLegalMovesForPiece,
} from "./engine/moveGenerator";
import { buildWinProbabilityPoint } from "./engine/probability";
import { isPositionEqual } from "./engine/rules";
import type {
  Board,
  GameSnapshot,
  Move,
  Position,
  Side,
  WinProbabilityPoint,
} from "./types/chess";
import {
  formatMoveForDisplay,
  getDisplayMode,
  getPieceDisplayLabel,
  getDisplaySide,
  type StarterChoice,
} from "./utils/presentation";

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

function cloneMove(move: Move): Move {
  return {
    ...move,
    piece: { ...move.piece },
    captured: move.captured ? { ...move.captured } : undefined,
    from: { ...move.from },
    to: { ...move.to },
  };
}

const PLAYER_SIDE: Side = "black";
const AI_SIDE: Side = "red";

function createSnapshot(snapshot: GameSnapshot): GameSnapshot {
  return {
    board: cloneBoard(snapshot.board),
    currentTurn: snapshot.currentTurn,
    playerSide: snapshot.playerSide,
    aiSide: snapshot.aiSide,
    moveHistory: snapshot.moveHistory.map(cloneMove),
    lastMove: snapshot.lastMove ? cloneMove(snapshot.lastMove) : undefined,
    isCheck: snapshot.isCheck,
    isCheckmate: snapshot.isCheckmate,
    winner: snapshot.winner,
    hasStarted: snapshot.hasStarted,
    statusMessage: snapshot.statusMessage,
    winRateHistory: snapshot.winRateHistory.map((point) => ({
      ...point,
      breakdown: { ...point.breakdown },
    })),
    lastEvaluation: snapshot.lastEvaluation
      ? {
          ...snapshot.lastEvaluation,
          breakdown: { ...snapshot.lastEvaluation.breakdown },
        }
      : undefined,
  };
}

function createPreGameSnapshot(starterChoice: StarterChoice): GameSnapshot {
  const initialBoard = createInitialBoard();
  const initialEval = buildWinProbabilityPoint(initialBoard, 0, "red");
  return {
    board: initialBoard,
    currentTurn: starterChoice === "player" ? PLAYER_SIDE : AI_SIDE,
    playerSide: PLAYER_SIDE,
    aiSide: AI_SIDE,
    moveHistory: [],
    lastMove: undefined,
    isCheck: false,
    isCheckmate: false,
    winner: undefined,
    hasStarted: false,
    statusMessage: "请选择先手方，然后点击开始游戏。",
    winRateHistory: [initialEval],
    lastEvaluation: initialEval,
  };
}

function createStartedSnapshot(starterChoice: StarterChoice): GameSnapshot {
  const initialBoard = createInitialBoard();
  const initialEval = buildWinProbabilityPoint(initialBoard, 0, "red");
  return {
    board: initialBoard,
    currentTurn: starterChoice === "player" ? PLAYER_SIDE : AI_SIDE,
    playerSide: PLAYER_SIDE,
    aiSide: AI_SIDE,
    moveHistory: [],
    lastMove: undefined,
    isCheck: false,
    isCheckmate: false,
    winner: undefined,
    hasStarted: true,
    statusMessage:
      starterChoice === "ai" ? "对局开始，AI 红方先手。" : "对局开始，玩家红方先手。",
    winRateHistory: [initialEval],
    lastEvaluation: initialEval,
  };
}

function App() {
  const [selectedStarter, setSelectedStarter] = useState<StarterChoice>("ai");
  const displayMode = getDisplayMode(selectedStarter);
  const [board, setBoard] = useState<Board>(() => createInitialBoard());
  const [currentTurn, setCurrentTurn] = useState<Side>(AI_SIDE);
  const [playerSideState, setPlayerSideState] = useState<Side>(PLAYER_SIDE);
  const [aiSideState, setAiSideState] = useState<Side>(AI_SIDE);
  const [moveHistory, setMoveHistory] = useState<Move[]>([]);
  const [lastMove, setLastMove] = useState<Move | undefined>();
  const [isCheck, setIsCheck] = useState(false);
  const [isCheckmate, setIsCheckmate] = useState(false);
  const [winner, setWinner] = useState<Side | undefined>();
  const [hasStarted, setHasStarted] = useState(false);
  const [selectedPosition, setSelectedPosition] = useState<Position | undefined>();
  const [legalTargets, setLegalTargets] = useState<Position[]>([]);
  const [statusMessage, setStatusMessage] = useState("请选择先手方，然后点击开始游戏。");
  const [winRateHistory, setWinRateHistory] = useState(() => [
    buildWinProbabilityPoint(createInitialBoard(), 0, "red"),
  ]);
  const [lastEvaluation, setLastEvaluation] = useState<WinProbabilityPoint | undefined>(() =>
    buildWinProbabilityPoint(createInitialBoard(), 0, "red"),
  );
  const [historyStack, setHistoryStack] = useState<GameSnapshot[]>(() => [
    createPreGameSnapshot("ai"),
  ]);
  const [aiThinking, setAiThinking] = useState(false);

  const workerRef = useRef<Worker | null>(null);
  const activeRequestIdRef = useRef(0);
  const latestStateRef = useRef({
    board,
    moveHistory,
    currentTurn,
    winner,
    hasStarted,
    playerSide: playerSideState,
    aiSide: aiSideState,
    winRateHistory,
    lastEvaluation,
  });

  useEffect(() => {
    latestStateRef.current = {
      board,
      moveHistory,
      currentTurn,
      winner,
      hasStarted,
      playerSide: playerSideState,
      aiSide: aiSideState,
      winRateHistory,
      lastEvaluation,
    };
  }, [
    aiSideState,
    board,
    currentTurn,
    hasStarted,
    lastEvaluation,
    moveHistory,
    playerSideState,
    winRateHistory,
    winner,
  ]);

  const applySnapshotState = (snapshot: GameSnapshot) => {
    setBoard(cloneBoard(snapshot.board));
    setCurrentTurn(snapshot.currentTurn);
    setPlayerSideState(snapshot.playerSide);
    setAiSideState(snapshot.aiSide);
    setMoveHistory(snapshot.moveHistory.map(cloneMove));
    setLastMove(snapshot.lastMove ? cloneMove(snapshot.lastMove) : undefined);
    setIsCheck(snapshot.isCheck);
    setIsCheckmate(snapshot.isCheckmate);
    setWinner(snapshot.winner);
    setHasStarted(snapshot.hasStarted);
    setStatusMessage(snapshot.statusMessage);
    setWinRateHistory(snapshot.winRateHistory.map((point) => ({ ...point, breakdown: { ...point.breakdown } })));
    setLastEvaluation(
      snapshot.lastEvaluation
        ? { ...snapshot.lastEvaluation, breakdown: { ...snapshot.lastEvaluation.breakdown } }
        : undefined,
    );
    setSelectedPosition(undefined);
    setLegalTargets([]);
  };

  const pushSnapshot = (snapshot: GameSnapshot) => {
    applySnapshotState(snapshot);
    setHistoryStack((prev) => [...prev, createSnapshot(snapshot)]);
  };

  useEffect(() => {
    const worker = new Worker(new URL("./workers/aiWorker.ts", import.meta.url), {
      type: "module",
    });
    workerRef.current = worker;

    worker.onmessage = (event: MessageEvent<AiWorkerResponse>) => {
      const { requestId, move, depthReached, elapsedMs } = event.data;
      if (requestId !== activeRequestIdRef.current) {
        return;
      }

      setAiThinking(false);
      const latest = latestStateRef.current;

      if (!latest.hasStarted || latest.currentTurn !== latest.aiSide || latest.winner) {
        return;
      }

      if (!move) {
        const finalEval = buildWinProbabilityPoint(
          latest.board,
          latest.moveHistory.length,
          "red",
          { winner: latest.playerSide },
        );
        const snapshot: GameSnapshot = {
          board: latest.board,
          currentTurn: latest.aiSide,
          playerSide: latest.playerSide,
          aiSide: latest.aiSide,
          moveHistory: latest.moveHistory,
          lastMove:
            latest.moveHistory.length > 0
              ? latest.moveHistory[latest.moveHistory.length - 1]
              : undefined,
          isCheck: isInCheck(latest.board, latest.aiSide),
          isCheckmate: true,
          winner: latest.playerSide,
          hasStarted: true,
          statusMessage: "AI 已无合法走法，你获胜了。",
          winRateHistory: [...latest.winRateHistory, finalEval],
          lastEvaluation: finalEval,
        };

        applySnapshotState(snapshot);
        return;
      }

      const nextBoard = applyMove(latest.board, move);
      const nextMoves = [...latest.moveHistory, move];
      const playerReplies = generateAllLegalMoves(nextBoard, latest.playerSide);
      const aiWon = playerReplies.length === 0;
      const nextEval = buildWinProbabilityPoint(nextBoard, nextMoves.length, "red", {
        winner: aiWon ? latest.aiSide : undefined,
      });
      const snapshot: GameSnapshot = {
        board: nextBoard,
        currentTurn: latest.playerSide,
        playerSide: latest.playerSide,
        aiSide: latest.aiSide,
        moveHistory: nextMoves,
        lastMove: move,
        isCheck: isInCheck(nextBoard, latest.playerSide),
        isCheckmate: aiWon,
        winner: aiWon ? latest.aiSide : undefined,
        hasStarted: true,
        statusMessage: aiWon
          ? `AI 落子：${formatMoveForDisplay(move, displayMode)}。你已无合法应对，AI 获胜。`
          : `AI 落子：${formatMoveForDisplay(move, displayMode)}。搜索深度 ${depthReached}，耗时 ${(elapsedMs / 1000).toFixed(1)} 秒。`,
        winRateHistory: [...latest.winRateHistory, nextEval],
        lastEvaluation: nextEval,
      };

      pushSnapshot(snapshot);
    };

    return () => {
      worker.terminate();
      workerRef.current = null;
    };
  }, [displayMode]);

  const selectableLegalMoves = useMemo(() => {
    if (!selectedPosition || !hasStarted || currentTurn !== playerSideState) {
      return [];
    }

    return generateLegalMovesForPiece(board, selectedPosition);
  }, [board, currentTurn, hasStarted, playerSideState, selectedPosition]);

  useEffect(() => {
    setLegalTargets(selectableLegalMoves.map((move) => move.to));
  }, [selectableLegalMoves]);

  useEffect(() => {
    if (!hasStarted || currentTurn !== aiSideState || winner || aiThinking) {
      return;
    }

    const requestId = activeRequestIdRef.current + 1;
    activeRequestIdRef.current = requestId;
    setAiThinking(true);
    setStatusMessage(
      moveHistory.length === 0
        ? `AI 正在计算开局主线，限时 ${(AI_THINK_TIME_MS / 1000).toFixed(0)} 秒。`
        : `AI 正在限时搜索压制方案，每步最多 ${(AI_THINK_TIME_MS / 1000).toFixed(0)} 秒。`,
    );

    workerRef.current?.postMessage({
      requestId,
      board: cloneBoard(board),
      side: aiSideState,
      maxDepth: AI_SEARCH_DEPTH,
      timeLimitMs: AI_THINK_TIME_MS,
      moveHistory: moveHistory.map(cloneMove),
    } satisfies AiWorkerRequest);
  }, [aiSideState, aiThinking, board, currentTurn, hasStarted, moveHistory.length, winner]);

  const resetToPreGame = (starterChoice = selectedStarter) => {
    activeRequestIdRef.current += 1;
    setAiThinking(false);
    const snapshot = createPreGameSnapshot(starterChoice);
    applySnapshotState(snapshot);
    setHistoryStack([createSnapshot(snapshot)]);
  };

  const handleSelectStarter = (starterChoice: StarterChoice) => {
    if (hasStarted || aiThinking) {
      return;
    }

    setSelectedStarter(starterChoice);
    activeRequestIdRef.current += 1;
    setAiThinking(false);
    const snapshot = createPreGameSnapshot(starterChoice);
    applySnapshotState(snapshot);
    setHistoryStack([createSnapshot(snapshot)]);
  };

  const handleStartGame = () => {
    if (hasStarted || aiThinking) {
      return;
    }

    activeRequestIdRef.current += 1;
    const preGameSnapshot = createPreGameSnapshot(selectedStarter);
    const startedSnapshot = createStartedSnapshot(selectedStarter);

    setAiThinking(false);
    applySnapshotState(startedSnapshot);
    setHistoryStack([createSnapshot(preGameSnapshot), createSnapshot(startedSnapshot)]);
  };

  const handleRestart = () => {
    resetToPreGame(selectedStarter);
  };

  const handleUndo = () => {
    if (!hasStarted || moveHistory.length === 0 || aiThinking) {
      return;
    }

    activeRequestIdRef.current += 1;
    setAiThinking(false);

    const targetIndex =
      currentTurn === playerSideState
        ? moveHistory.length === 1
          ? 1
          : Math.max(1, historyStack.length - 3)
        : Math.max(1, historyStack.length - 2);

    const targetSnapshot = createSnapshot(historyStack[targetIndex]);
    applySnapshotState(targetSnapshot);
    setHistoryStack(historyStack.slice(0, targetIndex + 1));
  };

  const handleCellClick = (position: Position) => {
    if (!hasStarted) {
      setStatusMessage("请先选择先手方并点击开始游戏。");
      return;
    }

    if (aiThinking || winner) {
      return;
    }

    if (currentTurn !== playerSideState) {
      setStatusMessage("当前轮到 AI 行棋，请稍候。");
      return;
    }

    const piece = board[position.row][position.col];

    if (piece?.side === playerSideState) {
      setSelectedPosition(position);
      setStatusMessage(
        `已选中${getPieceDisplayLabel(piece.type, piece.side, displayMode)}，请选择合法落点。`,
      );
      return;
    }

    if (!selectedPosition) {
      setStatusMessage("请先选择你的棋子。");
      return;
    }

    const legalMove = selectableLegalMoves.find((move) => isPositionEqual(move.to, position));
    if (!legalMove) {
      setStatusMessage("该位置不是合法走法。");
      return;
    }

    const nextBoard = applyMove(board, legalMove);
    const nextMoves = [...moveHistory, legalMove];
    const aiReplies = generateAllLegalMoves(nextBoard, aiSideState);
    const playerWon = aiReplies.length === 0;
    const nextEval = buildWinProbabilityPoint(nextBoard, nextMoves.length, "red", {
      winner: playerWon ? playerSideState : undefined,
    });
    const snapshot: GameSnapshot = {
      board: nextBoard,
      currentTurn: aiSideState,
      playerSide: playerSideState,
      aiSide: aiSideState,
      moveHistory: nextMoves,
      lastMove: legalMove,
      isCheck: isInCheck(nextBoard, aiSideState),
      isCheckmate: playerWon,
      winner: playerWon ? playerSideState : undefined,
      hasStarted: true,
      statusMessage: playerWon
        ? `你走出 ${formatMoveForDisplay(legalMove, displayMode)}，AI 无合法应对，你获胜了。`
        : `你走出 ${formatMoveForDisplay(legalMove, displayMode)}，AI 正在计算反击。`,
      winRateHistory: [...winRateHistory, nextEval],
      lastEvaluation: nextEval,
    };

    pushSnapshot(snapshot);
  };

  return (
    <main className="app-shell">
      <section className="hero">
        <div>
          <p className="hero-tag">本地搜索型中国象棋引擎</p>
          <h1>中国象棋 AI 对战</h1>
          <p className="hero-subtitle">
            玩家始终控制上侧棋子，AI 控制下侧棋子。切换先手时，棋盘颜色也会同步翻转；
            AI 在浏览器 Worker 中进行高强度本地搜索。
          </p>
        </div>
      </section>

      <section className="layout">
        <ChessBoard
          board={board}
          selectedPosition={selectedPosition}
          legalTargets={legalTargets}
          lastMove={lastMove}
          disabled={!hasStarted || aiThinking}
          displayMode={displayMode}
          onCellClick={handleCellClick}
        />

        <div className="sidebar">
          <GameInfo
            currentTurn={getDisplaySide(currentTurn, displayMode)}
            playerSide={getDisplaySide(playerSideState, displayMode)}
            aiSide={getDisplaySide(aiSideState, displayMode)}
            hasStarted={hasStarted}
            isCheck={isCheck}
            isCheckmate={isCheckmate}
            winner={winner ? getDisplaySide(winner, displayMode) : undefined}
            statusMessage={statusMessage}
            aiThinking={aiThinking}
            canUndo={moveHistory.length > 0}
            selectedStarter={selectedStarter}
            onRestart={handleRestart}
            onUndo={handleUndo}
            onStartGame={handleStartGame}
            onSelectStarter={handleSelectStarter}
          />
          <WinProbabilityChart
            history={winRateHistory}
            selectedStarter={selectedStarter}
            aiThinking={aiThinking}
          />
          <MoveHistory moves={moveHistory} displayMode={displayMode} />
        </div>
      </section>
    </main>
  );
}

export default App;
