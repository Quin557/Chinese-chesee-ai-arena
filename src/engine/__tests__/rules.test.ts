import { describe, expect, it } from "vitest";
import { areGeneralsFacing, isInCheck } from "../check";
import { generateLegalMovesForPiece } from "../moveGenerator";
import { generatePseudoLegalMovesForPiece } from "../rules";
import type { Board, Piece, PieceType, Position, Side } from "../../types/chess";

function piece(side: Side, type: PieceType): Piece {
  const labels: Record<Side, Record<PieceType, string>> = {
    red: {
      general: "帅",
      advisor: "仕",
      elephant: "相",
      horse: "马",
      rook: "车",
      cannon: "炮",
      soldier: "兵",
    },
    black: {
      general: "将",
      advisor: "士",
      elephant: "象",
      horse: "马",
      rook: "车",
      cannon: "炮",
      soldier: "卒",
    },
  };

  return {
    id: `${side}-${type}`,
    side,
    type,
    label: labels[side][type],
  };
}

function emptyBoard(): Board {
  return Array.from({ length: 10 }, () => Array.from({ length: 9 }, () => null));
}

function place(board: Board, position: Position, side: Side, type: PieceType): Board {
  board[position.row][position.col] = piece(side, type);
  return board;
}

function targetsOf(board: Board, from: Position): string[] {
  return generatePseudoLegalMovesForPiece(board, from).map(
    (move) => `${move.to.row},${move.to.col}`,
  );
}

describe("xiangqi piece rules", () => {
  it("blocks horse moves when the horse leg is occupied", () => {
    const board = emptyBoard();
    place(board, { row: 4, col: 4 }, "red", "horse");
    place(board, { row: 3, col: 4 }, "red", "soldier");

    const targets = targetsOf(board, { row: 4, col: 4 });

    expect(targets).not.toContain("2,3");
    expect(targets).not.toContain("2,5");
    expect(targets).toContain("6,3");
    expect(targets).toContain("6,5");
  });

  it("blocks elephant moves through an occupied eye and prevents river crossing", () => {
    const board = emptyBoard();
    place(board, { row: 9, col: 2 }, "red", "elephant");
    place(board, { row: 8, col: 3 }, "black", "soldier");

    const targets = targetsOf(board, { row: 9, col: 2 });

    expect(targets).not.toContain("7,4");
    expect(targets).toContain("7,0");
    expect(targets).not.toContain("5,4");
  });

  it("requires exactly one screen for cannon captures", () => {
    const board = emptyBoard();
    place(board, { row: 4, col: 4 }, "red", "cannon");
    place(board, { row: 4, col: 5 }, "black", "soldier");
    place(board, { row: 4, col: 7 }, "black", "rook");
    place(board, { row: 2, col: 4 }, "red", "soldier");
    place(board, { row: 0, col: 4 }, "black", "rook");

    const targets = targetsOf(board, { row: 4, col: 4 });

    expect(targets).toContain("4,7");
    expect(targets).toContain("0,4");
    expect(targets).not.toContain("4,5");
  });

  it("detects facing generals and filters moves that expose the line", () => {
    const board = emptyBoard();
    place(board, { row: 0, col: 4 }, "black", "general");
    place(board, { row: 9, col: 4 }, "red", "general");
    place(board, { row: 1, col: 4 }, "black", "rook");

    expect(areGeneralsFacing(board)).toBe(false);

    const legalTargets = generateLegalMovesForPiece(board, { row: 1, col: 4 }).map(
      (move) => `${move.to.row},${move.to.col}`,
    );

    expect(legalTargets).not.toContain("1,3");
    expect(legalTargets).not.toContain("1,5");
  });

  it("does not allow irrelevant moves while the general is in check", () => {
    const board = emptyBoard();
    place(board, { row: 0, col: 4 }, "black", "general");
    place(board, { row: 9, col: 3 }, "red", "general");
    place(board, { row: 2, col: 4 }, "red", "rook");
    place(board, { row: 0, col: 1 }, "black", "horse");

    expect(isInCheck(board, "black")).toBe(true);
    expect(generateLegalMovesForPiece(board, { row: 0, col: 1 })).toHaveLength(0);
  });
});
