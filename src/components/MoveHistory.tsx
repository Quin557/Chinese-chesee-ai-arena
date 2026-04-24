import type { Move } from "../types/chess";
import type { DisplayMode } from "../utils/presentation";
import { formatMoveForDisplay } from "../utils/presentation";

interface MoveHistoryProps {
  moves: Move[];
  displayMode: DisplayMode;
}

function MoveHistory({ moves, displayMode }: MoveHistoryProps) {
  return (
    <section className="panel">
      <h2>最近走法</h2>
      <div className="history-list" role="log" aria-live="polite">
        {moves.length === 0 ? (
          <p className="history-empty">对局尚未开始。</p>
        ) : (
          moves
            .slice()
            .reverse()
            .map((move, index) => (
              <div className="history-item" key={`${move.notation}-${moves.length - index}`}>
                <span>{moves.length - index}.</span>
                <strong>{formatMoveForDisplay(move, displayMode)}</strong>
              </div>
            ))
        )}
      </div>
    </section>
  );
}

export default MoveHistory;
