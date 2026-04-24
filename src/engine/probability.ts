import { evaluateDetailedBoard } from "./evaluation";
import type { Board, EvalBreakdown, Side, WinProbabilityPoint } from "../types/chess";

interface ProbabilityOptions {
  winner?: Side;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function scoreToWinRate(score: number): number {
  const normalized = clamp(score / 260, -10, 10);
  return 1 / (1 + Math.exp(-normalized));
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

export function buildWinProbabilityPoint(
  board: Board,
  ply: number,
  perspective: Side = "red",
  options: ProbabilityOptions = {},
): WinProbabilityPoint {
  const breakdown = evaluateDetailedBoard(board, perspective);
  const redScore = perspective === "red" ? breakdown.total : -breakdown.total;
  const redWinRate =
    options.winner === "red" ? 1 : options.winner === "black" ? 0 : scoreToWinRate(redScore);
  const reasons = majorReasons(breakdown);

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
