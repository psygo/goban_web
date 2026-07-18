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
    /* var(--goban-x, default): lets an ancestor outside the shadow tree
       (e.g. the page setting --goban-btn-bg on :root) override this, since
       custom properties inherit through shadow boundaries — see "Theming"
       in Docs.md. */
    --go-controls-btn-bg: var(--goban-btn-bg, #3a3a3a);
    --go-controls-btn-bg-hover: var(--goban-btn-bg-hover, #4a4a4a);
    --go-controls-btn-color: var(--goban-btn-color, #eee);
    --go-controls-btn-playing-bg: var(--goban-btn-playing-bg, #7a3a3a);
    --go-controls-counter: var(--goban-counter, #bbb);
  }
  @media (prefers-color-scheme: light) {
    :host {
      --go-controls-btn-bg: var(--goban-btn-bg, #e6e4e0);
      --go-controls-btn-bg-hover: var(--goban-btn-bg-hover, #d8d5cf);
      --go-controls-btn-color: var(--goban-btn-color, #2a2a2a);
      --go-controls-btn-playing-bg: var(--goban-btn-playing-bg, #f0c2c2);
      --go-controls-counter: var(--goban-counter, #666);
    }
  }
  .default-controls {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
    gap: 0.375rem;
  }
  .buttons {
    grid-column: 2;
    display: flex;
    align-items: center;
    gap: 0.375rem;
  }
  .default-controls button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 2.25rem;
    height: 2.25rem;
    padding: 0;
    border: none;
    border-radius: 999px;
    background: var(--go-controls-btn-bg);
    color: var(--go-controls-btn-color);
    cursor: pointer;
  }
  .default-controls button:hover:not([data-go-disabled]) {
    background: var(--go-controls-btn-bg-hover);
  }
  .default-controls button[data-go-disabled] {
    opacity: 0.3;
    cursor: default;
  }
  .default-controls button[data-go-action="play-all"][data-go-playing] {
    background: var(--go-controls-btn-playing-bg);
  }
  .default-counter {
    grid-column: 3;
    justify-self: end;
    font-variant-numeric: tabular-nums;
    color: var(--go-controls-counter);
    font-size: 0.85rem;
  }
`;

/**
 * `<go-board-controls>` — wires Previous / Next / Play-all / Restart
 * behavior to its associated `<go-board>`. Ships a default button UI (its
 * colors adapt to `prefers-color-scheme: light` automatically — no
 * attribute needed), but is meant to be overridden: place your own markup
 * inside it (native `<slot>` fallback-content semantics mean any light-DOM
 * children you add replace the default UI entirely), tagged so this
 * element knows what they're for:
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
 *   - `counter` — set to `"false"` to omit the move counter from the
 *     *default* UI (no effect once you've replaced it with your own
 *     markup — just don't tag anything `data-go-counter` there)
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
            <div class="buttons">
            <button ${ACTION_ATTR}="first" title="First move" aria-label="First move">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <line x1="6" y1="5" x2="6" y2="19" />
                <polyline points="18 6 10 12 18 18" />
              </svg>
            </button>
            <button ${ACTION_ATTR}="back-10" title="Back 10 moves" aria-label="Back 10 moves">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="18 6 12 12 18 18" />
                <polyline points="11 6 5 12 11 18" />
              </svg>
            </button>
            <button ${ACTION_ATTR}="previous" title="Previous move" aria-label="Previous move">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="15 6 9 12 15 18" />
              </svg>
            </button>
            <button ${ACTION_ATTR}="play-all" title="Play all" aria-label="Play all">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" stroke="none">
                <polygon points="6 4 20 12 6 20" />
              </svg>
            </button>
            <button ${ACTION_ATTR}="next" title="Next move" aria-label="Next move">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="9 6 15 12 9 18" />
              </svg>
            </button>
            <button ${ACTION_ATTR}="forward-10" title="Forward 10 moves" aria-label="Forward 10 moves">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="6 6 12 12 6 18" />
                <polyline points="13 6 19 12 13 18" />
              </svg>
            </button>
            <button ${ACTION_ATTR}="last" title="Last move" aria-label="Last move">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="5" x2="18" y2="19" />
                <polyline points="6 6 14 12 6 18" />
              </svg>
            </button>
            </div>
            <span class="default-counter" ${COUNTER_ATTR}="{index} / {count}"></span>
          </div>
        </slot>
      `;
      this.slotEl = shadow.querySelector("slot") as HTMLSlotElement;
      this.addEventListener("click", this.handleClick);
      if (this.getAttribute("counter") === "false") {
        shadow.querySelector(".default-counter")?.remove();
      }
      // Re-binds data-go-action/data-go-counter elements when the slot's
      // assigned content changes — e.g. a developer swapping in their own
      // markup after this element has already connected and rendered
      // once, which wouldn't otherwise pick up current state until the
      // next board event.
      this.slotEl.addEventListener("slotchange", () => this.updateUI());
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
    for (const el of this.queryTagged(`[${ACTION_ATTR}="play-all"]`)) {
      el.toggleAttribute(PLAYING_ATTR, playing);
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
