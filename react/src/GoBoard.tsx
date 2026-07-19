import { forwardRef, useMemo, useRef } from "react";
import type { CSSProperties } from "react";
import type {
  CoordinateSide,
  GoBoardElement,
  IllegalMoveEventDetail,
  MoveEventDetail,
  NavigateEventDetail,
  SGFErrorEventDetail,
  SGFLoadedEventDetail,
} from "goban-web";
import "goban-web";
import { mergeRefs } from "./internal/merge-refs";
import { useAttributes } from "./internal/use-attributes";
import { useCustomEvent } from "./internal/use-custom-event";

export interface GoBoardProps {
  size?: number | string;
  /** Space-separated subset of "top"/"bottom"/"left"/"right", or omit for all four. */
  coordinates?: CoordinateSide[] | string;
  interactive?: boolean;
  keyboardShortcuts?: boolean;
  sgf?: string;
  blackStone?: string;
  whiteStone?: string;
  width?: number | string;
  height?: number | string;
  backgroundImage?: string;
  coordinatesFont?: string;
  coordinatesFontSize?: string;
  coordinatesGap?: string;
  padding?: string;
  xStart?: string;
  xEnd?: string;
  yStart?: string;
  yEnd?: string;
  stoneSize?: string;
  labelOffsetX?: string;
  labelOffsetY?: string;
  labelFont?: string;
  labelFontSize?: string;
  cornerRadius?: string;
  theme?: string;
  /** Draws each stone's move number on top of it. Default off (unlike most boolean props here, `false`/omitted means off). */
  moveNumbers?: boolean;
  id?: string;
  className?: string;
  style?: CSSProperties;
  onMove?: (detail: MoveEventDetail) => void;
  onIllegalMove?: (detail: IllegalMoveEventDetail) => void;
  onPass?: () => void;
  onSgfLoaded?: (detail: SGFLoadedEventDetail) => void;
  onSgfError?: (detail: SGFErrorEventDetail) => void;
  onNavigate?: (detail: NavigateEventDetail) => void;
}

/**
 * React wrapper for `<go-board>`. Attributes are documented in Docs.md
 * (goban-web) under "Attributes" — this component accepts them as
 * camelCase props and applies them to the underlying custom element.
 * `ref` gives you the real `GoBoardElement`, so imperative calls
 * (`play()`, `pass()`, `reset()`, `nextMove()`, ...) work directly off it.
 */
export const GoBoard = forwardRef<GoBoardElement, GoBoardProps>(function GoBoard(props, forwardedRef) {
  const {
    size,
    coordinates,
    interactive,
    keyboardShortcuts,
    sgf,
    blackStone,
    whiteStone,
    width,
    height,
    backgroundImage,
    coordinatesFont,
    coordinatesFontSize,
    coordinatesGap,
    padding,
    xStart,
    xEnd,
    yStart,
    yEnd,
    stoneSize,
    labelOffsetX,
    labelOffsetY,
    labelFont,
    labelFontSize,
    cornerRadius,
    theme,
    moveNumbers,
    onMove,
    onIllegalMove,
    onPass,
    onSgfLoaded,
    onSgfError,
    onNavigate,
    id,
    className,
    style,
  } = props;

  const ref = useRef<GoBoardElement>(null);

  useAttributes(ref, {
    size,
    coordinates: Array.isArray(coordinates) ? coordinates.join(" ") : coordinates,
    interactive: interactive === undefined ? undefined : String(interactive),
    "keyboard-shortcuts": keyboardShortcuts === undefined ? undefined : String(keyboardShortcuts),
    sgf,
    "black-stone": blackStone,
    "white-stone": whiteStone,
    width,
    height,
    "background-image": backgroundImage,
    "coordinates-font": coordinatesFont,
    "coordinates-font-size": coordinatesFontSize,
    "coordinates-gap": coordinatesGap,
    padding,
    "x-start": xStart,
    "x-end": xEnd,
    "y-start": yStart,
    "y-end": yEnd,
    "stone-size": stoneSize,
    "label-offset-x": labelOffsetX,
    "label-offset-y": labelOffsetY,
    "label-font": labelFont,
    "label-font-size": labelFontSize,
    "corner-radius": cornerRadius,
    theme,
    "move-numbers": moveNumbers,
  });

  useCustomEvent<MoveEventDetail>(ref, "move", onMove);
  useCustomEvent<IllegalMoveEventDetail>(ref, "illegal-move", onIllegalMove);
  useCustomEvent<undefined>(ref, "pass", onPass ? () => onPass() : undefined);
  useCustomEvent<SGFLoadedEventDetail>(ref, "sgf-loaded", onSgfLoaded);
  useCustomEvent<SGFErrorEventDetail>(ref, "sgf-error", onSgfError);
  useCustomEvent<NavigateEventDetail>(ref, "navigate", onNavigate);

  const setRef = useMemo(() => mergeRefs(ref, forwardedRef), [forwardedRef]);

  return <go-board ref={setRef} id={id} className={className} style={style} />;
});
