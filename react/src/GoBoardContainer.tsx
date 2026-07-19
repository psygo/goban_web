import { forwardRef } from "react";
import type { CSSProperties, ReactNode } from "react";
import type { GoBoardContainerElement } from "goban-web";
import "goban-web";

export interface GoBoardContainerProps {
  id?: string;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
}

/**
 * React wrapper for `<go-board-container>` — a pure layout wrapper for a
 * `<GoBoard>` and its peripheral components (`<GoMetadataContainer>`,
 * `<GoBoardControls>`, ...). Carries no attributes of its own.
 */
export const GoBoardContainer = forwardRef<GoBoardContainerElement, GoBoardContainerProps>(
  function GoBoardContainer({ id, className, style, children }, forwardedRef) {
    return (
      <go-board-container ref={forwardedRef} id={id} className={className} style={style}>
        {children}
      </go-board-container>
    );
  },
);
