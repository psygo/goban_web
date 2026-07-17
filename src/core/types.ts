export const enum Color {
  Empty = 0,
  Black = 1,
  White = 2,
}

export interface Vertex {
  x: number;
  y: number;
}

export function oppositeColor(color: Color): Color {
  if (color === Color.Empty) return Color.Empty;
  return color === Color.Black ? Color.White : Color.Black;
}

export interface PlayResult {
  legal: true;
  vertex: Vertex;
  color: Color;
  captured: Vertex[];
}

export type IllegalReason =
  | "occupied"
  | "suicide"
  | "ko"
  | "out-of-bounds"
  | "game-over";

export interface IllegalResult {
  legal: false;
  reason: IllegalReason;
}

export type MoveResult = PlayResult | IllegalResult;
