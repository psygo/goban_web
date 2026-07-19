// Pulls the `declare module "react" { namespace JSX { ... } }`
// augmentation (needed so `<go-board>` etc. type-check as JSX) into this
// package's own compiled dist/jsx.d.ts + dist/index.d.ts, so consumers get
// it automatically just by importing from here — no separate import
// required on their end.
import "./jsx";

export { GoBoard } from "./GoBoard";
export type { GoBoardProps } from "./GoBoard";
export { GoBoardContainer } from "./GoBoardContainer";
export type { GoBoardContainerProps } from "./GoBoardContainer";
export { GoMetadataContainer } from "./GoMetadataContainer";
export type { GoMetadataContainerProps } from "./GoMetadataContainer";
export { GoBoardControls } from "./GoBoardControls";
export type { GoBoardControlsProps } from "./GoBoardControls";

// Re-exported for convenience, so consumers of this package don't also
// need a direct dependency on goban-web just to name these types/values.
export { Color, oppositeColor } from "goban-web";
export type {
  CoordinateSide,
  GoBoardElement,
  GoBoardControlsElement,
  GoBoardContainerElement,
  GoGameInfo,
  GoMetadataContainerElement,
  GoPlayerInfo,
  IllegalMoveEventDetail,
  MoveEventDetail,
  NavigateEventDetail,
  SGFErrorEventDetail,
  SGFLoadedEventDetail,
} from "goban-web";
