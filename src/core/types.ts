// A plain (not `const`) enum: `const enum` gets fully inlined at compile
// time, which TypeScript refuses to do for an *ambient* const enum (one
// seen only through its .d.ts, values erased) under `isolatedModules` —
// exactly the situation any external TypeScript consumer of this package
// is in, goban-web-react included. A regular enum keeps a real runtime
// object, so it resolves the same way whether it's compiled inline (this
// package's own esbuild/Vite build) or imported from a published .d.ts.
export enum Color {
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
