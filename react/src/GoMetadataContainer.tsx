import { forwardRef, useMemo, useRef } from "react";
import type { CSSProperties } from "react";
import type { GoGameInfo, GoMetadataContainerElement } from "goban-web";
import "goban-web";
import { mergeRefs } from "./internal/merge-refs";
import { useAttributes } from "./internal/use-attributes";
import { useCustomEvent } from "./internal/use-custom-event";

export interface GoMetadataContainerProps {
  /** Id of the `<go-board>` to read from; otherwise the nearest one is located automatically. */
  board?: string;
  /** Set to `false` to hide the meta line/result/comment card, showing just the players row. */
  details?: boolean;
  id?: string;
  className?: string;
  style?: CSSProperties;
  onMetadataChanged?: (info: GoGameInfo | null) => void;
}

/** React wrapper for `<go-metadata-container>`. `ref` gives you the real element, whose `gameInfo` getter exposes the parsed SGF game info for custom rendering. */
export const GoMetadataContainer = forwardRef<GoMetadataContainerElement, GoMetadataContainerProps>(
  function GoMetadataContainer({ board, details, onMetadataChanged, id, className, style }, forwardedRef) {
    const ref = useRef<GoMetadataContainerElement>(null);

    useAttributes(ref, {
      board,
      details: details === undefined ? undefined : String(details),
    });

    useCustomEvent<GoGameInfo | null>(ref, "metadata-changed", onMetadataChanged);

    const setRef = useMemo(() => mergeRefs(ref, forwardedRef), [forwardedRef]);

    return <go-metadata-container ref={setRef} id={id} className={className} style={style} />;
  },
);
