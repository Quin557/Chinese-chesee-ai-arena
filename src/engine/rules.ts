import type { Board, Move, Piece, Position, Side } from "../types/chess";

export const BOARD_ROWS = 10;
export const BOARD_COLS = 9;

function inBounds(position: Position): boolean {
  return (
    position.row >= 0 &&
    position.row < BOARD_ROWS &&
    position.col >= 0 &&
    position.col < BOARD_COLS
  );
}

function insidePalace(side: Side, position: Position): boolean {
  const rowRange = side === "black" ? [0, 2] : [7, 9];
  return (
    position.row >= rowRange[0] &&
    position.row <= rowRange[1] &&
    position.col >= 3 &&
    position.col <= 5
  );
}

function hasCrossedRiver(side: Side, row: number): boolean {
  return side === "black" ? row >= 5 : row <= 4;
}

function getPiece(board: Board, position: Position): Piece | null {
  return board[position.row]?.[position.col] ?? null;
}

function canLandOn(board: Board, target: Position, side: Side): boolean {
  const targetPiece = getPiece(board, target);
  return !targetPiece || targetPiece.side !== side;
}

function createMove(
  board: Board,
  from: Position,
  to: Position,
  piece: Piece,
): Move | null {
  if (!inBounds(to) || !canLandOn(board, to, piece.side)) {
    return null;
  }

  return {
    from,
    to,
    piece,
    captured: getPiece(board, to) ?? undefined,
    notation: "",
  };
}

function generateLinearMoves(
  board: Board,
  from: Position,
  piece: Piece,
  directions: Position[],
): Move[] {
  const moves: Move[] = [];

  directions.forEach((direction) => {
    let row = from.row + direction.row;
    let col = from.col + direction.col;

    while (inBounds({ row, col })) {
      const targetPiece = board[row][col];

      if (!targetPiece) {
        moves.push({
          from,
          to: { row, col },
          piece,
          notation: "",
        });
      } else {
        if (targetPiece.side !== piece.side) {
          moves.push({
            from,
            to: { row, col },
            piece,
            captured: targetPiece,
            notation: "",
          });
        }
        break;
      }

      row += direction.row;
      col += direction.col;
    }
  });

  return moves;
}

function generateCannonMoves(board: Board, from: Position, piece: Piece): Move[] {
  const moves: Move[] = [];
  const directions: Position[] = [
    { row: -1, col: 0 },
    { row: 1, col: 0 },
    { row: 0, col: -1 },
    { row: 0, col: 1 },
  ];

  directions.forEach((direction) => {
    let row = from.row + direction.row;
    let col = from.col + direction.col;
    let jumped = false;

    while (inBounds({ row, col })) {
      const targetPiece = board[row][col];

      if (!jumped) {
        if (!targetPiece) {
          moves.push({
            from,
            to: { row, col },
            piece,
            notation: "",
          });
        } else {
          jumped = true;
        }
      } else if (targetPiece) {
        if (targetPiece.side !== piece.side) {
          moves.push({
            from,
            to: { row, col },
            piece,
            captured: targetPiece,
            notation: "",
          });
        }
        break;
      }

      row += direction.row;
      col += direction.col;
    }
  });

  return moves;
}

export function generatePseudoLegalMovesForPiece(
  board: Board,
  from: Position,
): Move[] {
  const piece = getPiece(board, from);
  if (!piece) {
    return [];
  }

  switch (piece.type) {
    case "rook":
      return generateLinearMoves(
        board,
        from,
        piece,
        [
          { row: -1, col: 0 },
          { row: 1, col: 0 },
          { row: 0, col: -1 },
          { row: 0, col: 1 },
        ],
      );

    case "horse": {
      const horsePatterns = [
        { move: { row: -2, col: -1 }, leg: { row: -1, col: 0 } },
        { move: { row: -2, col: 1 }, leg: { row: -1, col: 0 } },
        { move: { row: 2, col: -1 }, leg: { row: 1, col: 0 } },
        { move: { row: 2, col: 1 }, leg: { row: 1, col: 0 } },
        { move: { row: -1, col: -2 }, leg: { row: 0, col: -1 } },
        { move: { row: 1, col: -2 }, leg: { row: 0, col: -1 } },
        { move: { row: -1, col: 2 }, leg: { row: 0, col: 1 } },
        { move: { row: 1, col: 2 }, leg: { row: 0, col: 1 } },
      ];

      return horsePatterns
        .filter(({ leg }) => !getPiece(board, { row: from.row + leg.row, col: from.col + leg.col }))
        .map(({ move }) =>
          createMove(board, from, { row: from.row + move.row, col: from.col + move.col }, piece),
        )
        .filter((move): move is Move => Boolean(move));
    }

    case "elephant": {
      const elephantPatterns = [
        { move: { row: -2, col: -2 }, eye: { row: -1, col: -1 } },
        { move: { row: -2, col: 2 }, eye: { row: -1, col: 1 } },
        { move: { row: 2, col: -2 }, eye: { row: 1, col: -1 } },
        { move: { row: 2, col: 2 }, eye: { row: 1, col: 1 } },
      ];

      return elephantPatterns
        .filter(({ eye }) => !getPiece(board, { row: from.row + eye.row, col: from.col + eye.col }))
        .map(({ move }) => ({ row: from.row + move.row, col: from.col + move.col }))
        .filter((target) => inBounds(target))
        .filter((target) => (piece.side === "black" ? target.row <= 4 : target.row >= 5))
        .map((target) => createMove(board, from, target, piece))
        .filter((move): move is Move => Boolean(move));
    }

    case "advisor": {
      const deltas = [
        { row: -1, col: -1 },
        { row: -1, col: 1 },
        { row: 1, col: -1 },
        { row: 1, col: 1 },
      ];

      return deltas
        .map((delta) => ({ row: from.row + delta.row, col: from.col + delta.col }))
        .filter((target) => insidePalace(piece.side, target))
        .map((target) => createMove(board, from, target, piece))
        .filter((move): move is Move => Boolean(move));
    }

    case "general": {
      const deltas = [
        { row: -1, col: 0 },
        { row: 1, col: 0 },
        { row: 0, col: -1 },
        { row: 0, col: 1 },
      ];

      return deltas
        .map((delta) => ({ row: from.row + delta.row, col: from.col + delta.col }))
        .filter((target) => insidePalace(piece.side, target))
        .map((target) => createMove(board, from, target, piece))
        .filter((move): move is Move => Boolean(move));
    }

    case "cannon":
      return generateCannonMoves(board, from, piece);

    case "soldier": {
      const forward = piece.side === "black" ? 1 : -1;
      const targets: Position[] = [{ row: from.row + forward, col: from.col }];

      if (hasCrossedRiver(piece.side, from.row)) {
        targets.push(
          { row: from.row, col: from.col - 1 },
          { row: from.row, col: from.col + 1 },
        );
      }

      return targets
        .map((target) => createMove(board, from, target, piece))
        .filter((move): move is Move => Boolean(move));
    }

    default:
      return [];
  }
}

export function isPositionEqual(a?: Position, b?: Position): boolean {
  return Boolean(a && b && a.row === b.row && a.col === b.col);
}

export function isWithinBoard(position: Position): boolean {
  return inBounds(position);
}

export function isAcrossRiver(side: Side, row: number): boolean {
  return hasCrossedRiver(side, row);
}
