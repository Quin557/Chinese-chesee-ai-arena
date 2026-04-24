import type { Side } from "../types/chess";

interface ChessPieceProps {
  label: string;
  side: Side;
  selected: boolean;
  highlighted: boolean;
}

function ChessPiece({ label, side, selected, highlighted }: ChessPieceProps) {
  return (
    <div
      className={[
        "piece",
        side === "red" ? "piece-red" : "piece-black",
        selected ? "piece-selected" : "",
        highlighted ? "piece-highlighted" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      aria-label={`${side === "red" ? "红方" : "黑方"}${label}`}
    >
      <span>{label}</span>
    </div>
  );
}

export default ChessPiece;
