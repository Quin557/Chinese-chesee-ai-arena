import type { DisplayMode } from "../utils/presentation";
import { getDisplayMode, getDisplaySide, sideText } from "../utils/presentation";
import type { StarterChoice } from "../utils/presentation";
import type { WinProbabilityPoint } from "../types/chess";

interface WinProbabilityChartProps {
  history: WinProbabilityPoint[];
  selectedStarter: StarterChoice;
  aiThinking: boolean;
}

function WinProbabilityChart({
  history,
  selectedStarter,
  aiThinking,
}: WinProbabilityChartProps) {
  const displayMode: DisplayMode = getDisplayMode(selectedStarter);
  const displayRedInternal = getDisplaySide("red", displayMode) === "red" ? "red" : "black";

  const points = history.map((point, index) => {
    const displayedRedRate =
      displayRedInternal === "red" ? point.redWinRate : point.blackWinRate;
    const displayedBlackRate = 1 - displayedRedRate;
    return {
      x: history.length === 1 ? 0 : (index / (history.length - 1)) * 100,
      redY: (1 - displayedRedRate) * 100,
      blackY: (1 - displayedBlackRate) * 100,
    };
  });

  const redPolyline = points.map((point) => `${point.x},${point.redY}`).join(" ");
  const blackPolyline = points.map((point) => `${point.x},${point.blackY}`).join(" ");
  const latest = history[history.length - 1];
  const latestRedRate =
    displayRedInternal === "red" ? latest.redWinRate : latest.blackWinRate;
  const latestBlackRate = 1 - latestRedRate;

  return (
    <section className="panel">
      <div className="chart-header">
        <div>
          <h2>胜率走势</h2>
          <p>{aiThinking ? "AI 正在重新评估局面..." : latest.explanation}</p>
        </div>
        <div className="chart-badges">
          <span className="chart-badge chart-badge-red">
            红方 {Math.round(latestRedRate * 100)}%
          </span>
          <span className="chart-badge chart-badge-black">
            黑方 {Math.round(latestBlackRate * 100)}%
          </span>
        </div>
      </div>

      <div className="chart-shell">
        <svg viewBox="0 0 100 100" className="probability-chart" preserveAspectRatio="none">
          {[20, 40, 60, 80].map((line) => (
            <line
              key={line}
              x1="0"
              y1={line}
              x2="100"
              y2={line}
              className="chart-grid-line"
            />
          ))}
          <polyline points={blackPolyline} className="chart-line chart-line-black" />
          <polyline points={redPolyline} className="chart-line chart-line-red" />
        </svg>
      </div>

      <div className="chart-axis">
        <span>开局</span>
        <span>{sideText(getDisplaySide("red", displayMode))}更优</span>
        <span>当前</span>
      </div>
    </section>
  );
}

export default WinProbabilityChart;
