import { Color, oppositeColor } from "./types";
import type { IllegalReason, MoveResult, Vertex } from "./types";

interface Group {
  stones: number[];
  liberties: Set<number>;
}

/**
 * Pure game-state engine for Go: stone placement, captures, suicide
 * prevention and the simple ko rule. Holds no rendering/DOM concerns.
 */
export class Board {
  readonly size: number;

  private grid: Color[];
  private _currentColor: Color = Color.Black;
  private _koPoint: number | null = null;
  private _passes = 0;
  private _over = false;
  private _captures: Record<Color.Black | Color.White, number> = {
    [Color.Black]: 0,
    [Color.White]: 0,
  };

  constructor(size = 19) {
    this.size = size;
    this.grid = new Array(size * size).fill(Color.Empty);
  }

  get currentColor(): Color {
    return this._currentColor;
  }

  get isOver(): boolean {
    return this._over;
  }

  get captures(): Readonly<Record<Color.Black | Color.White, number>> {
    return this._captures;
  }

  /** The vertex forbidden this turn by the simple ko rule, if any. */
  get koPoint(): Vertex | null {
    return this._koPoint === null ? null : this.toVertex(this._koPoint);
  }

  get(x: number, y: number): Color {
    if (!this.inBounds(x, y)) return Color.Empty;
    return this.grid[this.toIndex(x, y)] as Color;
  }

  clone(): Board {
    const copy = new Board(this.size);
    copy.grid = this.grid.slice();
    copy._currentColor = this._currentColor;
    copy._koPoint = this._koPoint;
    copy._passes = this._passes;
    copy._over = this._over;
    copy._captures = { ...this._captures };
    return copy;
  }

  isLegalMove(x: number, y: number, color: Color = this._currentColor): boolean {
    return this.tryPlay(x, y, color, false).legal;
  }

  /** Places a stone for the current player, applying capture/suicide/ko rules. */
  play(x: number, y: number): MoveResult {
    const result = this.tryPlay(x, y, this._currentColor, true);
    if (result.legal) {
      this._passes = 0;
      this._currentColor = oppositeColor(this._currentColor);
    }
    return result;
  }

  /** Passes the current player's turn. Two consecutive passes end the game. */
  pass(): void {
    this._passes += 1;
    this._koPoint = null;
    if (this._passes >= 2) this._over = true;
    this._currentColor = oppositeColor(this._currentColor);
  }

  private toIndex(x: number, y: number): number {
    return y * this.size + x;
  }

  private toVertex(index: number): Vertex {
    return { x: index % this.size, y: Math.floor(index / this.size) };
  }

  private inBounds(x: number, y: number): boolean {
    return x >= 0 && x < this.size && y >= 0 && y < this.size;
  }

  private neighborsOf(index: number): number[] {
    const { x, y } = this.toVertex(index);
    const result: number[] = [];
    if (x > 0) result.push(index - 1);
    if (x < this.size - 1) result.push(index + 1);
    if (y > 0) result.push(index - this.size);
    if (y < this.size - 1) result.push(index + this.size);
    return result;
  }

  /** Flood-fills the group containing `index` and computes its liberties. */
  private groupAt(grid: Color[], index: number): Group {
    const color = grid[index] as Color;
    const stones: number[] = [];
    const liberties = new Set<number>();
    const visited = new Set<number>([index]);
    const stack = [index];

    while (stack.length > 0) {
      const current = stack.pop() as number;
      stones.push(current);
      for (const neighbor of this.neighborsOf(current)) {
        const neighborColor = grid[neighbor];
        if (neighborColor === Color.Empty) {
          liberties.add(neighbor);
        } else if (neighborColor === color && !visited.has(neighbor)) {
          visited.add(neighbor);
          stack.push(neighbor);
        }
      }
    }

    return { stones, liberties };
  }

  private tryPlay(
    x: number,
    y: number,
    color: Color,
    commit: boolean,
  ): MoveResult {
    if (this._over) return this.illegal("game-over");
    if (!this.inBounds(x, y)) return this.illegal("out-of-bounds");

    const index = this.toIndex(x, y);
    if (this.grid[index] !== Color.Empty) return this.illegal("occupied");
    if (this._koPoint === index) return this.illegal("ko");

    const grid = this.grid.slice();
    grid[index] = color;

    const opponent = oppositeColor(color);
    const captured: number[] = [];
    for (const neighbor of this.neighborsOf(index)) {
      if (grid[neighbor] !== opponent) continue;
      const group = this.groupAt(grid, neighbor);
      if (group.liberties.size === 0) {
        for (const stone of group.stones) {
          if (grid[stone] !== Color.Empty) {
            grid[stone] = Color.Empty;
            captured.push(stone);
          }
        }
      }
    }

    const ownGroup = this.groupAt(grid, index);
    if (ownGroup.liberties.size === 0) {
      return this.illegal("suicide");
    }

    if (commit) {
      this.grid = grid;
      this._captures[color as Color.Black | Color.White] += captured.length;
      this._koPoint =
        captured.length === 1 && ownGroup.stones.length === 1
          ? captured[0]!
          : null;
    }

    return {
      legal: true,
      vertex: { x, y },
      color,
      captured: captured.map((i) => this.toVertex(i)),
    };
  }

  private illegal(reason: IllegalReason): MoveResult {
    return { legal: false, reason };
  }
}
