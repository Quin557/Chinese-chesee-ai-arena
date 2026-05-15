import { isInCheck } from "./check";
import { evaluateDetailedBoard } from "./evaluation";
import { analyzeStrategicJudgement } from "./strategy";
import type { Board, EvalBreakdown, Side, WinProbabilityPoint } from "../types/chess";

interface ProbabilityOptions {
  winner?: Side;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function scoreToWinRate(score: number): number {
  const normalized = clamp(score / 520, -6, 6);
  return 1 / (1 + Math.exp(-normalized));
}

function phaseAdjustedWeights(board: Board): { strategic: number; tactical: number; safety: number } {
  let occupied = 0;
  for (let row = 0; row < board.length; row += 1) {
    for (let col = 0; col < board[row].length; col += 1) {
      if (board[row][col]) {
        occupied += 1;
      }
    }
  }

  if (occupied >= 26) {
    return { strategic: 0.42, tactical: 0.18, safety: 0.2 };
  }
  if (occupied >= 18) {
    return { strategic: 0.32, tactical: 0.24, safety: 0.24 };
  }
  return { strategic: 0.18, tactical: 0.34, safety: 0.3 };
}

function balancedStrategicScore(
  redJudgement: ReturnType<typeof analyzeStrategicJudgement>,
  blackJudgement: ReturnType<typeof analyzeStrategicJudgement>,
): number {
  return (
    (redJudgement.initiative - blackJudgement.initiative) * 0.72 +
    (redJudgement.stableThreats - blackJudgement.stableThreats) * 84 +
    (redJudgement.forcingMoves - blackJudgement.forcingMoves) * 32 +
    (redJudgement.mobility - blackJudgement.mobility) * 5 -
    (redJudgement.futileChases - blackJudgement.futileChases) * 74
  );
}

function majorReasons(breakdown: EvalBreakdown): string[] {
  const buckets = [
    {
      key: "material",
      value: breakdown.material,
      positive: "子力交换更优",
      negative: "子力处于劣势",
    },
    {
      key: "kingSafety",
      value: breakdown.kingSafety,
      positive: "将帅安全更稳",
      negative: "将帅安全承压",
    },
    {
      key: "centerControl",
      value: breakdown.centerControl,
      positive: "中路与要点控制更强",
      negative: "中路控制偏弱",
    },
    {
      key: "openLinePressure",
      value: breakdown.openLinePressure,
      positive: "直线压迫更强",
      negative: "被重子线路压制",
    },
    {
      key: "development",
      value: breakdown.development,
      positive: "子力展开更积极",
      negative: "子力展开偏慢",
    },
  ];

  return buckets
    .filter((item) => Math.abs(item.value) >= 35)
    .sort((a, b) => Math.abs(b.value) - Math.abs(a.value))
    .slice(0, 3)
    .map((item) => (item.value >= 0 ? item.positive : item.negative));
}

function strategicReasons(
  redJudgement: ReturnType<typeof analyzeStrategicJudgement>,
  blackJudgement: ReturnType<typeof analyzeStrategicJudgement>,
): string[] {
  const reasons: string[] = [];

  const initiativeDiff = redJudgement.initiative - blackJudgement.initiative;
  const forcingDiff = redJudgement.forcingMoves - blackJudgement.forcingMoves;
  const stableThreatDiff = redJudgement.stableThreats - blackJudgement.stableThreats;
  const futileChaseDiff = redJudgement.futileChases - blackJudgement.futileChases;
  const mobilityDiff = redJudgement.mobility - blackJudgement.mobility;

  if (Math.abs(initiativeDiff) >= 70) {
    reasons.push(initiativeDiff > 0 ? "红方主动权更强" : "黑方主动权更强");
  }

  if (Math.abs(forcingDiff) >= 2) {
    reasons.push(forcingDiff > 0 ? "红方强制手更多" : "黑方强制手更多");
  }

  if (Math.abs(stableThreatDiff) >= 1) {
    reasons.push(stableThreatDiff > 0 ? "红方威胁更稳定" : "黑方威胁更稳定");
  }

  if (Math.abs(futileChaseDiff) >= 1) {
    reasons.push(futileChaseDiff < 0 ? "红方空追更少" : "黑方空追更少");
  }

  if (Math.abs(mobilityDiff) >= 8) {
    reasons.push(mobilityDiff > 0 ? "红方可选方案更宽" : "黑方可选方案更宽");
  }

  return reasons.slice(0, 2);
}

export function buildWinProbabilityPoint(
  board: Board,
  ply: number,
  perspective: Side = "red",
  options: ProbabilityOptions = {},
): WinProbabilityPoint {
  const breakdown = evaluateDetailedBoard(board, perspective);
  const redBreakdown = perspective === "red" ? breakdown : evaluateDetailedBoard(board, "red");
  const redJudgement = analyzeStrategicJudgement(board, "red");
  const blackJudgement = analyzeStrategicJudgement(board, "black");
  const weights = phaseAdjustedWeights(board);
  const strategicScore = balancedStrategicScore(redJudgement, blackJudgement);
  const redInCheck = isInCheck(board, "red");
  const blackInCheck = isInCheck(board, "black");
  const checkScore = redInCheck === blackInCheck ? 0 : blackInCheck ? 90 : -90;
  const materialAndStructure =
    redBreakdown.material * 0.5 +
    redBreakdown.development * 0.34 +
    redBreakdown.centerControl * 0.28 +
    redBreakdown.openLinePressure * 0.24;
  const safetyScore = redBreakdown.kingSafety * weights.safety + checkScore;
  const redScore =
    materialAndStructure + strategicScore * weights.strategic + safetyScore * weights.tactical;
  const redWinRate =
    options.winner === "red" ? 1 : options.winner === "black" ? 0 : scoreToWinRate(redScore);
  const reasons = [
    ...strategicReasons(redJudgement, blackJudgement),
    ...majorReasons(breakdown),
  ].slice(0, 3);

  return {
    ply,
    redWinRate,
    blackWinRate: 1 - redWinRate,
    scoreFromRed: redScore,
    explanation:
      options.winner
        ? `依据：形成绝杀，${options.winner === "red" ? "红方" : "黑方"}胜率直接锁定。`
        : reasons.length > 0
        ? `依据：${reasons.join("、")}。`
        : "依据：当前局面大体均衡，暂未形成明显优势。",
    breakdown,
    decisive: options.winner,
  };
}
