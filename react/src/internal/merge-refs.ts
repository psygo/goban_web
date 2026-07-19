import type { MutableRefObject, Ref } from "react";

/** Combines several refs (forwarded + internal) into one callback ref so a single DOM node can feed all of them. */
export function mergeRefs<T>(...refs: Array<Ref<T> | undefined | null>): (node: T | null) => void {
  return (node) => {
    for (const ref of refs) {
      if (!ref) continue;
      if (typeof ref === "function") ref(node);
      else (ref as MutableRefObject<T | null>).current = node;
    }
  };
}
