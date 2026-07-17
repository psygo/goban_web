import { resolveBoard } from "./resolve-board";
import type { GoBoardElement } from "./go-board-element";

const ACTION_ATTR = "data-go-action";
const COUNTER_ATTR = "data-go-counter";
const DISABLED_ATTR = "data-go-disabled";
const PLAYING_ATTR = "data-go-playing";

type Action = "first" | "back-10" | "previous" | "next" | "forward-10" | "last" | "play-all" | "restart";

const STYLES = `
  :host {
    display: block;
    font-family: system-ui, sans-serif;
  }
  .default-controls {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .counter {
    font-variant-numeric: tabular-nums;
    color: #bbb;
    font-size: 0.9rem;
  }
  .buttons {
    display: flex;
    gap: 0.5rem;
  }
  button {
    cursor: pointer;
    padding: 0.5rem 1rem;
  }
  button:disabled {
    cursor: default;
    opacity: 0.5;
  }
`;

/**
 * `<go-board-controls>` — wires Previous / Next / Play-all / Restart
 * behavior to its associated `<go-board>`. Ships a default button UI, but
 * is meant to be overridden: place your own markup inside it (native
 * `<slot>` fallback-content semantics mean any light-DOM children you add
 * replace the default UI entirely), tagged so this element knows what
 * they're for:
 *
 *   - `data-go-action="first" | "back-10" | "previous" | "next" |
 *     "forward-10" | "last" | "play-all" | "restart"` on any clickable
 *     element wires a click on it (or a descendant) to that action.
 *     `back-10`/`forward-10` jump 10 moves via `goToMove`; `first`/`last`
 *     jump to the start/end. Any action other than `play-all` stops
 *     auto-play if it's running.
 *   - `data-go-counter` on any element fills its text with the move
 *     position, e.g. "Move 3 / 221". Give the attribute a value with
 *     `{index}`/`{count}` placeholders for a custom format, e.g.
 *     `data-go-counter="{index} of {count}"`.
 *
 * Tagged action elements get `data-go-disabled` toggled when their action
 * is currently unavailable — style/hide via that attribute selector, since
 * arbitrary elements (not just `<button>`) may be tagged. The `play-all`
 * element additionally gets `data-go-playing` toggled while auto-play is
 * running, so custom markup can react to it (CSS or a MutationObserver).
 *
 * Attributes:
 *   - `board` (optional element id of the `<go-board>` to control;
 *     otherwise the nearest one is located automatically)
 */
export class GoBoardControlsElement extends HTMLElement {
  private board: GoBoardElement | null = null;
  private playTimer: ReturnType<typeof setInterval> | null = null;
  private slotEl!: HTMLSlotElement;

  connectedCallback(): void {
    if (!this.shadowRoot) {
      const shadow = this.attachShadow({ mode: "open" });
      shadow.innerHTML = `
        <style>${STYLES}</style>
        <slot>
          <div class="default-controls">
            <div class="counter" ${COUNTER_ATTR}></div>
            <div class="buttons">
              <button ${ACTION_ATTR}="previous">Previous</button>
              <button ${ACTION_ATTR}="next">Next</button>
              <button ${ACTION_ATTR}="play-all">Play all</button>
              <button ${ACTION_ATTR}="restart">Restart</button>
            </div>
          </div>
        </slot>
      `;
      this.slotEl = shadow.querySelector("slot") as HTMLSlotElement;
      this.addEventListener("click", this.handleClick);
    }

    this.board = resolveBoard(this);
    this.board?.addEventListener("navigate", this.handleUpdate);
    this.board?.addEventListener("sgf-loaded", this.handleUpdate);
    this.updateUI();
  }

  disconnectedCallback(): void {
    this.stopPlayAll();
    this.board?.removeEventListener("navigate", this.handleUpdate);
    this.board?.removeEventListener("sgf-loaded", this.handleUpdate);
  }

  private readonly handleUpdate = (): void => this.updateUI();

  private readonly handleClick = (event: Event): void => {
    const actionEl = event
      .composedPath()
      .find((node): node is HTMLElement => node instanceof HTMLElement && node.hasAttribute(ACTION_ATTR));
    if (!actionEl) return;
    this.performAction(actionEl.getAttribute(ACTION_ATTR) as Action | null);
  };

  private performAction(action: Action | null): void {
    if (action !== "play-all") this.stopPlayAll();
    switch (action) {
      case "first":
      case "restart":
        this.board?.goToMove(0);
        break;
      case "back-10":
        this.jumpBy(-10);
        break;
      case "previous":
        this.board?.previousMove();
        break;
      case "next":
        this.board?.nextMove();
        break;
      case "forward-10":
        this.jumpBy(10);
        break;
      case "last":
        if (this.board) this.board.goToMove(this.board.moveCount);
        break;
      case "play-all":
        this.togglePlayAll();
        break;
    }
  }

  private jumpBy(delta: number): void {
    if (!this.board) return;
    this.board.goToMove(this.board.moveIndex + delta);
  }

  private togglePlayAll(): void {
    if (this.playTimer !== null) {
      this.stopPlayAll();
      return;
    }
    if (!this.board) return;
    this.setPlaying(true);
    this.playTimer = setInterval(() => {
      this.board?.nextMove();
      if (!this.board || this.board.moveIndex >= this.board.moveCount) {
        this.stopPlayAll();
      }
    }, 120);
  }

  private stopPlayAll(): void {
    if (this.playTimer !== null) {
      clearInterval(this.playTimer);
      this.playTimer = null;
      this.setPlaying(false);
    }
  }

  private setPlaying(playing: boolean): void {
    const usingDefault = this.isUsingDefaultContent();
    for (const el of this.queryTagged(`[${ACTION_ATTR}="play-all"]`)) {
      el.toggleAttribute(PLAYING_ATTR, playing);
      if (usingDefault && el instanceof HTMLButtonElement) {
        el.textContent = playing ? "Stop" : "Play all";
      }
    }
  }

  private updateUI(): void {
    const moveIndex = this.board?.moveIndex ?? 0;
    const moveCount = this.board?.moveCount ?? 0;
    const disabledFor: Record<Action, boolean> = {
      first: moveIndex <= 0,
      "back-10": moveIndex <= 0,
      previous: moveIndex <= 0,
      next: moveIndex >= moveCount,
      "forward-10": moveIndex >= moveCount,
      last: moveIndex >= moveCount,
      "play-all": moveCount === 0 || moveIndex >= moveCount,
      restart: moveCount === 0,
    };

    for (const el of this.queryTagged(`[${ACTION_ATTR}]`)) {
      const action = el.getAttribute(ACTION_ATTR) as Action | null;
      const disabled = action ? disabledFor[action] : false;
      el.toggleAttribute(DISABLED_ATTR, disabled);
      if (el instanceof HTMLButtonElement) el.disabled = disabled;
    }

    for (const el of this.queryTagged(`[${COUNTER_ATTR}]`)) {
      const template = el.getAttribute(COUNTER_ATTR) || "Move {index} / {count}";
      el.textContent = template.replace("{index}", String(moveIndex)).replace("{count}", String(moveCount));
    }
  }

  private isUsingDefaultContent(): boolean {
    return this.slotEl.assignedElements().length === 0;
  }

  /**
   * Finds elements matching `selector` among what the slot is actually
   * rendering right now: the developer's assigned light-DOM children if
   * any were provided, otherwise the slot's own default fallback content.
   */
  private queryTagged(selector: string): HTMLElement[] {
    const assigned = this.slotEl.assignedElements({ flatten: true }) as HTMLElement[];
    const roots = assigned.length > 0 ? assigned : (Array.from(this.slotEl.children) as HTMLElement[]);
    const results: HTMLElement[] = [];
    for (const root of roots) {
      if (root.matches(selector)) results.push(root);
      results.push(...Array.from(root.querySelectorAll<HTMLElement>(selector)));
    }
    return results;
  }
}

customElements.define("go-board-controls", GoBoardControlsElement);
