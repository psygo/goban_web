import { resolveBoard } from "./resolve-board";
import type { GoBoardElement } from "./go-board-element";
import type { SGFNode } from "../core/sgf";

const FIELD_ATTR = "data-go-field";
const ACTION_ATTR = "data-go-action";
const REVEALED_ATTR = "data-go-revealed";

type Field =
  | "black-name"
  | "black-rank"
  | "white-name"
  | "white-rank"
  | "komi"
  | "date"
  | "event"
  | "result"
  | "result-toggle-label"
  | "comment";

/** A single player's name and (optional) rank, as read from the SGF root node. */
export interface GoPlayerInfo {
  name: string;
  rank?: string;
}

/**
 * The parsed game info `<go-metadata-container>` displays, exposed via its
 * `gameInfo` property for a developer building a fully custom design (in
 * JS, a canvas, anywhere) rather than restyling the default markup.
 */
export interface GoGameInfo {
  black: GoPlayerInfo;
  white: GoPlayerInfo;
  komi?: string;
  date?: string;
  event?: string;
  result?: string;
  /** The current move's comment (SGF `C` property at `board.moveIndex`), if any. */
  comment?: string;
}

const STYLES = `
  :host {
    display: block;
    font-family: system-ui, sans-serif;
    /* Each color is "var(--goban-x, internal-default)" rather than a bare
       value: this lets an ancestor outside the shadow tree (e.g. the page
       setting --goban-text on :root) override it, since custom properties
       inherit through shadow boundaries — while still falling back to a
       sensible built-in default (auto-switched below by
       prefers-color-scheme) when nothing external is set. See "Theming"
       in Docs.md. */
    --go-meta-text: var(--goban-text, #eee);
    --go-meta-text-secondary: var(--goban-text-secondary, #999);
    --go-meta-text-muted: var(--goban-text-muted, #888);
    --go-meta-comment: var(--goban-comment, #ccc);
    --go-meta-panel-bg: var(--goban-panel-bg, linear-gradient(180deg, rgba(255, 255, 255, 0.1), rgba(255, 255, 255, 0.04)));
    --go-meta-panel-border: var(--goban-panel-border, rgba(255, 255, 255, 0.14));
    --go-meta-panel-shadow: var(--goban-panel-shadow, 0 1px 3px rgba(0, 0, 0, 0.25));
    --go-meta-card-bg: var(--goban-card-bg, linear-gradient(180deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.02)));
    --go-meta-card-border: var(--goban-card-border, rgba(255, 255, 255, 0.09));
    --go-meta-card-shadow: var(--goban-card-shadow, 0 1px 3px rgba(0, 0, 0, 0.2));
    --go-meta-toggle-bg: var(--goban-toggle-bg, rgba(255, 255, 255, 0.08));
    --go-meta-toggle-bg-hover: var(--goban-toggle-bg-hover, rgba(255, 255, 255, 0.14));
    --go-meta-toggle-border: var(--goban-toggle-border, rgba(255, 255, 255, 0.12));
  }
  @media (prefers-color-scheme: light) {
    :host {
      --go-meta-text: var(--goban-text, #1a1a1a);
      --go-meta-text-secondary: var(--goban-text-secondary, #666);
      --go-meta-text-muted: var(--goban-text-muted, #767676);
      --go-meta-comment: var(--goban-comment, #444);
      --go-meta-panel-bg: var(--goban-panel-bg, linear-gradient(180deg, rgba(0, 0, 0, 0.05), rgba(0, 0, 0, 0.015)));
      --go-meta-panel-border: var(--goban-panel-border, rgba(0, 0, 0, 0.18));
      --go-meta-panel-shadow: var(--goban-panel-shadow, 0 1px 2px rgba(0, 0, 0, 0.08));
      --go-meta-card-bg: var(--goban-card-bg, linear-gradient(180deg, rgba(0, 0, 0, 0.035), rgba(0, 0, 0, 0.015)));
      --go-meta-card-border: var(--goban-card-border, rgba(0, 0, 0, 0.1));
      --go-meta-card-shadow: var(--goban-card-shadow, 0 1px 3px rgba(0, 0, 0, 0.08));
      --go-meta-toggle-bg: var(--goban-toggle-bg, rgba(0, 0, 0, 0.06));
      --go-meta-toggle-bg-hover: var(--goban-toggle-bg-hover, rgba(0, 0, 0, 0.1));
      --go-meta-toggle-border: var(--goban-toggle-border, rgba(0, 0, 0, 0.14));
    }
  }
  /* The plain [hidden] UA-stylesheet rule loses to any author rule that
     sets "display" on the same element (e.g. ".card { display: flex }"),
     regardless of specificity, since author styles always beat user-agent
     ones — so anything toggled via the "hidden" property/attribute needs
     this restated with author-level priority to actually take effect. */
  [hidden] {
    display: none !important;
  }
  .empty {
    margin: 0;
    color: var(--go-meta-text-muted);
    font-size: 0.9rem;
  }
  .card {
    display: flex;
    flex-direction: column;
    gap: 0.65rem;
  }
  .players {
    display: flex;
    align-items: stretch;
    gap: 0.6rem;
  }
  .player-panel {
    flex: 1 1 0;
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 0.55rem;
    padding: 0.6rem 0.75rem;
    background: var(--go-meta-panel-bg);
    border: 1px solid var(--go-meta-panel-border);
    border-radius: 10px;
    box-shadow: var(--go-meta-panel-shadow);
    box-sizing: border-box;
  }
  .stone-dot {
    width: 1.1rem;
    height: 1.1rem;
    border-radius: 50%;
    flex: none;
  }
  .stone-dot-black {
    background: radial-gradient(circle at 35% 30%, #6a6a6a, #050505 75%);
    box-shadow: 0 0 0 1px #000, 0 1px 2px rgba(0, 0, 0, 0.4);
  }
  .stone-dot-white {
    background: radial-gradient(circle at 35% 30%, #ffffff, #c9c3b3 75%);
    box-shadow: 0 0 0 1px #9c9483, 0 1px 2px rgba(0, 0, 0, 0.25);
  }
  .player-text {
    min-width: 0;
    display: flex;
    align-items: baseline;
    gap: 0.35rem;
  }
  .player-name {
    color: var(--go-meta-text);
    font-weight: 600;
    font-size: 0.9rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .player-rank {
    color: var(--go-meta-text-secondary);
    font-size: 0.75rem;
    flex: none;
  }
  .details {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    padding: 0.7rem 0.85rem;
    background: var(--go-meta-card-bg);
    border: 1px solid var(--go-meta-card-border);
    border-radius: 10px;
    box-shadow: var(--go-meta-card-shadow);
    box-sizing: border-box;
  }
  .meta-line {
    color: var(--go-meta-text-secondary);
    font-size: 0.85rem;
  }
  .result-line {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  .result-toggle {
    font: inherit;
    font-size: 0.75rem;
    color: var(--go-meta-text-secondary);
    background: var(--go-meta-toggle-bg);
    border: 1px solid var(--go-meta-toggle-border);
    border-radius: 999px;
    padding: 0.2rem 0.65rem;
    cursor: pointer;
  }
  .result-toggle:hover {
    background: var(--go-meta-toggle-bg-hover);
  }
  .result-value {
    color: var(--go-meta-text);
    font-size: 0.85rem;
    font-weight: 600;
  }
  .comment {
    color: var(--go-meta-comment);
    font-size: 0.85rem;
    line-height: 1.4;
    white-space: pre-wrap;
  }
`;

/**
 * `<go-metadata-container>` — displays the loaded SGF's game info,
 * decomposed into two stacked containers: a players row (a black-player
 * panel and a white-player panel — same background, told apart by their
 * stone-color indicator, no "vs" divider needed — with name and rank on
 * one line) and, right below it, its own separate card for the rest of the
 * data: komi/date/event each on their own line, the game result (hidden
 * behind a "Show result" toggle by default, since a spoiler-visible result
 * isn't always wanted alongside an SGF being replayed move by move), and
 * the *current* move's comment (SGF `C` property), which updates live as
 * the board navigates. Shows "No game loaded." until its `<go-board>`
 * fires `sgf-loaded`. Read-only — never calls back into the board.
 *
 * Like `<go-board-controls>`, it's a **wrapper**, not a fixed widget:
 * place your own markup inside it (native `<slot>` fallback-content
 * semantics mean any light-DOM children you add replace the default UI
 * entirely) and tag elements so this element knows what they're for:
 *
 *   - `data-go-field="black-name" | "black-rank" | "white-name" |
 *     "white-rank" | "komi" | "date" | "event" | "result" |
 *     "result-toggle-label" | "comment"` on any element fills its text
 *     with that piece of data, kept live as the board navigates or a new
 *     game loads. `result` stays empty text until revealed (see below);
 *     everything else is always filled in (empty string if absent).
 *   - `data-go-action="toggle-result"` on any clickable element toggles
 *     the result's reveal state; tagged elements get `data-go-revealed`
 *     toggled to reflect it, for custom styling.
 *
 * For a fully custom design (canvas, a different framework, anything
 * beyond restyling tagged elements), read the `gameInfo` property instead
 * — it's the same data these bindings use, and it's live-updated on the
 * same schedule (also fired as a `metadata-changed` event, `detail:
 * GoGameInfo | null`, for code that only holds a reference to this
 * element rather than the `<go-board>`).
 *
 * Colors adapt to `prefers-color-scheme: light` automatically — no
 * attribute needed.
 *
 * The result reveal state resets (hides again) whenever a new game loads,
 * but is left alone across move navigation.
 *
 * Listens to `sgf-loaded`, `sgf-error`, and `navigate` on its `<go-board>`
 * (the last one is what drives the live comment).
 *
 * Attributes:
 *   - `board` (optional element id of the `<go-board>` to read from;
 *     otherwise the nearest one is located automatically)
 *   - `details` — set to `"false"` to hide the second card (meta line,
 *     result, comment) entirely, showing just the players row. Only
 *     affects the *default* UI — for custom markup, simply don't include
 *     those `data-go-field` elements.
 */
export class GoMetadataContainerElement extends HTMLElement {
  static get observedAttributes(): string[] {
    return ["details"];
  }

  private board: GoBoardElement | null = null;
  private resultRevealed = false;
  private slotEl!: HTMLSlotElement;

  private emptyEl!: HTMLElement;
  private cardEl!: HTMLElement;
  private detailsEl!: HTMLElement;
  private metaEl!: HTMLElement;
  private resultLineEl!: HTMLElement;
  private resultValueEl!: HTMLElement;
  private commentEl!: HTMLElement;

  /** Whether the info below the player panels (meta line/result/comment) is shown, per the `details` attribute. */
  private get showDetails(): boolean {
    return !this.hasAttribute("details") || this.getAttribute("details") !== "false";
  }

  /**
   * The currently displayed game info, or `null` when no game is loaded.
   * Read this for a fully custom design instead of (or alongside)
   * `data-go-field` bindings; also fired as a `metadata-changed` event
   * whenever it changes.
   */
  get gameInfo(): GoGameInfo | null {
    const root = this.board?.sgfTree?.nodes[0];
    if (!root || !this.board) return null;
    const currentNode = this.board.sgfTree?.nodes[this.board.moveIndex];
    return {
      black: { name: property(root, "PB") ?? "Black", rank: property(root, "BR") },
      white: { name: property(root, "PW") ?? "White", rank: property(root, "WR") },
      komi: property(root, "KM"),
      date: property(root, "DT"),
      event: property(root, "GN"),
      result: property(root, "RE"),
      comment: currentNode ? property(currentNode, "C") : undefined,
    };
  }

  attributeChangedCallback(): void {
    if (this.isConnected) this.render();
  }

  connectedCallback(): void {
    if (!this.shadowRoot) {
      const shadow = this.attachShadow({ mode: "open" });
      shadow.innerHTML = `
        <style>${STYLES}</style>
        <slot>
          <p class="empty" id="empty">No game loaded.</p>
          <div class="card" id="card" hidden>
            <div class="players">
              <div class="player-panel player-panel-black">
                <span class="stone-dot stone-dot-black"></span>
                <div class="player-text">
                  <span class="player-name" ${FIELD_ATTR}="black-name"></span>
                  <span class="player-rank" ${FIELD_ATTR}="black-rank"></span>
                </div>
              </div>
              <div class="player-panel player-panel-white">
                <span class="stone-dot stone-dot-white"></span>
                <div class="player-text">
                  <span class="player-name" ${FIELD_ATTR}="white-name"></span>
                  <span class="player-rank" ${FIELD_ATTR}="white-rank"></span>
                </div>
              </div>
            </div>
            <div class="details" id="details">
              <div id="meta"></div>
              <div class="result-line" id="resultLine" hidden>
                <button class="result-toggle" type="button" ${ACTION_ATTR}="toggle-result" ${FIELD_ATTR}="result-toggle-label"></button>
                <span class="result-value" id="resultValue" ${FIELD_ATTR}="result" hidden></span>
              </div>
              <div class="comment" id="comment" ${FIELD_ATTR}="comment" hidden></div>
            </div>
          </div>
        </slot>
      `;
      this.slotEl = shadow.querySelector("slot") as HTMLSlotElement;
      this.emptyEl = shadow.getElementById("empty") as HTMLElement;
      this.cardEl = shadow.getElementById("card") as HTMLElement;
      this.detailsEl = shadow.getElementById("details") as HTMLElement;
      this.metaEl = shadow.getElementById("meta") as HTMLElement;
      this.resultLineEl = shadow.getElementById("resultLine") as HTMLElement;
      this.resultValueEl = shadow.getElementById("resultValue") as HTMLElement;
      this.commentEl = shadow.getElementById("comment") as HTMLElement;
      this.addEventListener("click", this.handleClick);
      // Re-binds data-go-field/data-go-action elements when the slot's
      // assigned content changes — e.g. a developer swapping in their own
      // markup after this element has already connected and rendered
      // once, which wouldn't otherwise pick up current data until the
      // next board event.
      this.slotEl.addEventListener("slotchange", () => this.render());
    }
    this.board = resolveBoard(this);
    this.board?.addEventListener("sgf-loaded", this.handleGameLoaded);
    this.board?.addEventListener("sgf-error", this.handleGameLoaded);
    this.board?.addEventListener("navigate", this.handleNavigate);
    this.render();
  }

  disconnectedCallback(): void {
    this.board?.removeEventListener("sgf-loaded", this.handleGameLoaded);
    this.board?.removeEventListener("sgf-error", this.handleGameLoaded);
    this.board?.removeEventListener("navigate", this.handleNavigate);
  }

  private readonly handleGameLoaded = (): void => {
    this.resultRevealed = false;
    this.render();
  };

  private readonly handleNavigate = (): void => this.render();

  private readonly handleClick = (event: Event): void => {
    const actionEl = event
      .composedPath()
      .find((node): node is HTMLElement => node instanceof HTMLElement && node.hasAttribute(ACTION_ATTR));
    if (actionEl?.getAttribute(ACTION_ATTR) === "toggle-result") {
      this.resultRevealed = !this.resultRevealed;
      this.render();
    }
  };

  private render(): void {
    const info = this.gameInfo;

    this.emptyEl.hidden = info !== null;
    this.cardEl.hidden = info === null;
    this.detailsEl.hidden = !this.showDetails;

    if (info && this.showDetails) {
      this.metaEl.replaceChildren(
        ...metaLines(info).map((text) => {
          const line = document.createElement("div");
          line.className = "meta-line";
          line.textContent = text;
          return line;
        }),
      );
      this.resultLineEl.hidden = !info.result;
      this.resultValueEl.hidden = !this.resultRevealed;
      this.commentEl.hidden = !info.comment;
    }

    for (const el of this.queryTagged(`[${FIELD_ATTR}]`)) {
      el.textContent = fieldText(el.getAttribute(FIELD_ATTR) as Field | null, info, this.resultRevealed);
    }
    for (const el of this.queryTagged(`[${ACTION_ATTR}="toggle-result"]`)) {
      el.toggleAttribute(REVEALED_ATTR, this.resultRevealed);
    }

    this.dispatchEvent(new CustomEvent<GoGameInfo | null>("metadata-changed", { detail: info, bubbles: true, composed: true }));
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

function property(node: SGFNode, id: string): string | undefined {
  return node.properties[id]?.[0];
}

function metaLines(info: GoGameInfo): string[] {
  return [info.komi ? `Komi ${info.komi}` : null, info.date, info.event].filter(
    (line): line is string => Boolean(line),
  );
}

function fieldText(field: Field | null, info: GoGameInfo | null, resultRevealed: boolean): string {
  if (!info || !field) return "";
  switch (field) {
    case "black-name":
      return info.black.name;
    case "black-rank":
      return info.black.rank ? `(${info.black.rank})` : "";
    case "white-name":
      return info.white.name;
    case "white-rank":
      return info.white.rank ? `(${info.white.rank})` : "";
    case "komi":
      return info.komi ?? "";
    case "date":
      return info.date ?? "";
    case "event":
      return info.event ?? "";
    case "result":
      return resultRevealed ? (info.result ?? "") : "";
    case "result-toggle-label":
      return resultRevealed ? "Hide result" : "Show result";
    case "comment":
      return info.comment ?? "";
  }
}

customElements.define("go-metadata-container", GoMetadataContainerElement);
