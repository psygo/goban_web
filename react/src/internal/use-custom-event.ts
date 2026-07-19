import { useEffect, useRef } from "react";
import type { RefObject } from "react";

/**
 * Wires `eventName` on `ref`'s element to `handler`. `handler` is kept
 * fresh via a ref rather than as an effect dependency, so passing a new
 * inline arrow function as a prop on every render doesn't tear down and
 * re-add the DOM listener each time.
 */
export function useCustomEvent<Detail>(
  ref: RefObject<Element | null>,
  eventName: string,
  handler: ((detail: Detail) => void) | undefined,
): void {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const listener = (event: Event) => handlerRef.current?.((event as CustomEvent<Detail>).detail);
    el.addEventListener(eventName, listener);
    return () => el.removeEventListener(eventName, listener);
  }, [ref, eventName]);
}
