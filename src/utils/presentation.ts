import type { Move, PieceType, Side } from "../types/chess";

export type StarterChoice = "player" | "ai";
export type DisplayMode = "standard" | "swapped";

const RED_LABELS: Record<PieceType, string> = {
  general: "帅",
  advisor: "仕",
  elephant: "相",
  horse: "马",
  rook: "车",
  cannon: "炮",
  soldier: "兵",
};

const BLACK_LABELS: Record<PieceType, string> = {
  general: "将",
  advisor: "士",
  elephant: "象",
  horse: "马",
  rook: "车",
  cannon: "炮",
  soldier: "卒",
};

export function getDisplayMode(starter: StarterChoice): DisplayMode {
  return starter === "player" ? "swapped" : "standard";
}

export function getDisplaySide(side: Side, mode: DisplayMode): Side {
  if (mode === "standard") {
    return side;
  }

  return side === "red" ? "black" : "red";
}

export function getPieceDisplayLabel(type: PieceType, side: Side, mode: DisplayMode): string {
  const displaySide = getDisplaySide(side, mode);
  return displaySide === "red" ? RED_LABELS[type] : BLACK_LABELS[type];
}

export function sideText(side: Side): string {
  return side === "red" ? "红方" : "黑方";
}

function positionText(row: number, col: number): string {
  return `(${row + 1},${col + 1})`;
}

export function formatMoveForDisplay(move: Move, mode: DisplayMode): string {
  const movingSide = getDisplaySide(move.piece.side, mode);
  const movingLabel = getPieceDisplayLabel(move.piece.type, move.piece.side, mode);
  const captureText = move.captured
    ? `吃${getPieceDisplayLabel(move.captured.type, move.captured.side, mode)}`
    : "至";

  return `${sideText(movingSide)}${movingLabel}${positionText(move.from.row, move.from.col)}${captureText}${positionText(move.to.row, move.to.col)}`;
}
