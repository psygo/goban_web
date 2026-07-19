import { forwardRef, useMemo, useRef } from "react";
import type { CSSProperties, ReactNode } from "react";
import type { GoBoardControlsElement } from "goban-web";
import "goban-web";
import { mergeRefs } from "./internal/merge-refs";
import { useAttributes } from "./internal/use-attributes";

export interface GoBoardControlsProps {
  /** Id of the `<go-board>` to control; otherwise the nearest one is located automatically. */
  board?: string;
  /** Set to `false` to hide the move-count counter in the default button UI. */
  counter?: boolean;
  id?: string;
  className?: string;
  style?: CSSProperties;
  /** Custom control markup (`data-go-action`-tagged elements) — omit for the default button UI. */
  children?: ReactNode;
}

/** React wrapper for `<go-board-controls>` — Previous/Next/Play-all/Restart controls wired to a `<GoBoard>`. */
export const GoBoardControls = forwardRef<GoBoardControlsElement, GoBoardControlsProps>(
  function GoBoardControls({ board, counter, children, id, className, style }, forwardedRef) {
    const ref = useRef<GoBoardControlsElement>(null);

    useAttributes(ref, {
      board,
      counter: counter === undefined ? undefined : String(counter),
    });

    const setRef = useMemo(() => mergeRefs(ref, forwardedRef), [forwardedRef]);

    return (
      <go-board-controls ref={setRef} id={id} className={className} style={style}>
        {children}
      </go-board-controls>
    );
  },
);
