import ChessPiece from "./ChessPiece";
import { isPositionEqual } from "../engine/rules";
import type { Board, Position } from "../types/chess";
import type { DisplayMode } from "../utils/presentation";
import { getDisplaySide, getPieceDisplayLabel, sideText } from "../utils/presentation";

interface ChessBoardProps {
  board: Board;
  selectedPosition?: Position;
  legalTargets: Position[];
  lastMove?: { from: Position; to: Position };
  disabled: boolean;
  displayMode: DisplayMode;
  onCellClick: (position: Position) => void;
}

function ChessBoard({
  board,
  selectedPosition,
  legalTargets,
  lastMove,
  disabled,
  displayMode,
  onCellClick,
}: ChessBoardProps) {
  return (
    <div className="board-shell">
      <div className="side-badge side-badge-top">上侧玩家 · {sideText(getDisplaySide("black", displayMode))}</div>
      <div className="side-badge side-badge-bottom">下侧 AI · {sideText(getDisplaySide("red", displayMode))}</div>
      <div className="river-label river-label-top">楚河</div>
      <div className="river-label river-label-bottom">汉界</div>

      <div className="board-grid" role="grid" aria-label="中国象棋棋盘">
        {board.map((row, rowIndex) =>
          row.map((piece, colIndex) => {
            const position = { row: rowIndex, col: colIndex };
            const isLegalTarget = legalTargets.some((target) => isPositionEqual(target, position));
            const isSelected = isPositionEqual(selectedPosition, position);
            const isLastMoveCell =
              isPositionEqual(lastMove?.from, position) || isPositionEqual(lastMove?.to, position);

            return (
              <button
                className={[
                  "board-cell",
                  rowIndex === 4 ? "board-cell-river-top" : "",
                  rowIndex === 5 ? "board-cell-river-bottom" : "",
                  isSelected ? "board-cell-selected" : "",
                  isLegalTarget ? "board-cell-legal" : "",
                  isLastMoveCell ? "board-cell-last-move" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                key={`${rowIndex}-${colIndex}`}
                onClick={() => onCellClick(position)}
                type="button"
                disabled={disabled}
              >
                <span className="grid-star" />
                {isLegalTarget && !piece ? <span className="legal-dot" /> : null}
                {piece ? (
                  <ChessPiece
                    label={getPieceDisplayLabel(piece.type, piece.side, displayMode)}
                    side={getDisplaySide(piece.side, displayMode)}
                    selected={isSelected}
                    highlighted={isLastMoveCell}
                  />
                ) : null}
              </button>
            );
          }),
        )}
      </div>
    </div>
  );
}

export default ChessBoard;
