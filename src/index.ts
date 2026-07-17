export { Board } from "./core/board";
export { Color, oppositeColor } from "./core/types";
export type {
  IllegalReason,
  IllegalResult,
  MoveResult,
  PlayResult,
  Vertex,
} from "./core/types";
export { GoBoardElement } from "./elements/go-board-element";
export type { IllegalMoveEventDetail, MoveEventDetail } from "./elements/go-board-element";

declare global {
  interface HTMLElementTagNameMap {
    "go-board": import("./elements/go-board-element").GoBoardElement;
  }
}
