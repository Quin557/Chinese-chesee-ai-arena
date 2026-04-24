import type { StarterChoice, DisplayMode } from "../utils/presentation";
import { getDisplayMode, getDisplaySide, sideText } from "../utils/presentation";
import type { WinProbabilityPoint } from "../types/chess";

interface WinProbabilityChartProps {
  history: WinProbabilityPoint[];
  selectedStarter: StarterChoice;
  aiThinking: boolean;
}

interface ChartPoint {
  x: number;
  y: number;
  value: number;
}

function buildSegments(points: ChartPoint[]) {
  return points.slice(1).map((point, index) => {
    const prev = points[index];
    const avgValue = (prev.value + point.value) / 2;
    return {
      key: `${index}-${point.x}`,
      path: `M ${prev.x} ${prev.y} L ${point.x} ${point.y}`,
      dominant: avgValue >= 50 ? "red" : "black",
    };
  });
}

function WinProbabilityChart({
  history,
  selectedStarter,
  aiThinking,
}: WinProbabilityChartProps) {
  const displayMode: DisplayMode = getDisplayMode(selectedStarter);
  const displayedRedIsInternalRed = getDisplaySide("red", displayMode) === "red";
  const points: ChartPoint[] = history.map((point, index) => {
    const displayedRedRate = displayedRedIsInternalRed ? point.redWinRate : point.blackWinRate;
    const value = Math.round(displayedRedRate * 1000) / 10;
    return {
      x: history.length === 1 ? 0 : (index / (history.length - 1)) * 100,
      y: 100 - value,
      value,
    };
  });

  const segments = buildSegments(points);
  const latest = history[history.length - 1];
  const latestRedRate = displayedRedIsInternalRed ? latest.redWinRate : latest.blackWinRate;
  const latestBlackRate = 1 - latestRedRate;
  const displayRedSide = getDisplaySide("red", displayMode);
  const displayBlackSide = getDisplaySide("black", displayMode);

  return (
    <section className="panel">
      <div className="chart-header">
        <div>
          <h2>胜率走势</h2>
          <p>{aiThinking ? "AI 正在重新评估局面..." : latest.explanation}</p>
        </div>
        <div className="chart-badges">
          <span className="chart-badge chart-badge-red">
            {sideText(displayRedSide)} {Math.round(latestRedRate * 100)}%
          </span>
          <span className="chart-badge chart-badge-black">
            {sideText(displayBlackSide)} {Math.round(latestBlackRate * 100)}%
          </span>
        </div>
      </div>

      <div className="chart-shell">
        <svg viewBox="0 0 100 100" className="probability-chart" preserveAspectRatio="none">
          {[10, 30, 50, 70, 90].map((line) => (
            <line
              key={line}
              x1="0"
              y1={100 - line}
              x2="100"
              y2={100 - line}
              className={line === 50 ? "chart-mid-line" : "chart-grid-line"}
            />
          ))}

          {segments.map((segment) => (
            <path
              key={segment.key}
              d={segment.path}
              className={
                segment.dominant === "red"
                  ? "chart-line-segment chart-line-segment-red"
                  : "chart-line-segment chart-line-segment-black"
              }
            />
          ))}

          {points.length > 0 ? (
            <circle
              cx={points[points.length - 1].x}
              cy={points[points.length - 1].y}
              r="2.4"
              className={
                points[points.length - 1].value >= 50
                  ? "chart-point chart-point-red"
                  : "chart-point chart-point-black"
              }
            />
          ) : null}
        </svg>
      </div>

      <div className="chart-axis">
        <span>开局</span>
        <span>50% 均势线</span>
        <span>当前</span>
      </div>
    </section>
  );
}

export default WinProbabilityChart;
