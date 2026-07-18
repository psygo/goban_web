import { resolveBoard } from "./resolve-board";
import type { GoBoardElement } from "./go-board-element";
import type { SGFNode } from "../core/sgf";

const STYLES = `
  :host {
    display: block;
    font-family: system-ui, sans-serif;
    --go-meta-text: #eee;
    --go-meta-text-secondary: #999;
    --go-meta-text-muted: #888;
    --go-meta-comment: #ccc;
    --go-meta-panel-black-bg: rgba(0, 0, 0, 0.28);
    --go-meta-panel-black-border: rgba(255, 255, 255, 0.06);
    --go-meta-panel-white-bg: rgba(255, 255, 255, 0.07);
    --go-meta-panel-white-border: rgba(255, 255, 255, 0.1);
    --go-meta-card-bg: linear-gradient(180deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.02));
    --go-meta-card-border: rgba(255, 255, 255, 0.09);
    --go-meta-card-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
    --go-meta-toggle-bg: rgba(255, 255, 255, 0.08);
    --go-meta-toggle-bg-hover: rgba(255, 255, 255, 0.14);
    --go-meta-toggle-border: rgba(255, 255, 255, 0.12);
  }
  @media (prefers-color-scheme: light) {
    :host {
      --go-meta-text: #1a1a1a;
      --go-meta-text-secondary: #666;
      --go-meta-text-muted: #767676;
      --go-meta-comment: #444;
      --go-meta-panel-black-bg: rgba(0, 0, 0, 0.08);
      --go-meta-panel-black-border: rgba(0, 0, 0, 0.14);
      --go-meta-panel-white-bg: rgba(0, 0, 0, 0.03);
      --go-meta-panel-white-border: rgba(0, 0, 0, 0.12);
      --go-meta-card-bg: linear-gradient(180deg, rgba(0, 0, 0, 0.035), rgba(0, 0, 0, 0.015));
      --go-meta-card-border: rgba(0, 0, 0, 0.1);
      --go-meta-card-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
      --go-meta-toggle-bg: rgba(0, 0, 0, 0.06);
      --go-meta-toggle-bg-hover: rgba(0, 0, 0, 0.1);
      --go-meta-toggle-border: rgba(0, 0, 0, 0.14);
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
    gap: 0.6rem;
  }
  .players {
    display: flex;
    align-items: stretch;
    gap: 0.5rem;
  }
  .player-panel {
    flex: 1 1 0;
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0.65rem;
    border-radius: 8px;
    box-sizing: border-box;
  }
  .player-panel-black {
    background: var(--go-meta-panel-black-bg);
    border: 1px solid var(--go-meta-panel-black-border);
  }
  .player-panel-white {
    background: var(--go-meta-panel-white-bg);
    border: 1px solid var(--go-meta-panel-white-border);
  }
  .stone-dot {
    width: 1rem;
    height: 1rem;
    border-radius: 50%;
    flex: none;
  }
  .stone-dot-black {
    background: radial-gradient(circle at 35% 30%, #6a6a6a, #050505 75%);
    box-shadow: 0 0 0 1px #000;
  }
  .stone-dot-white {
    background: radial-gradient(circle at 35% 30%, #ffffff, #c9c3b3 75%);
    box-shadow: 0 0 0 1px #9c9483;
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
    gap: 0.35rem;
    padding: 0.65rem 0.85rem;
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
 * panel and a white-player panel — stone-color indicator, name and rank on
 * one line — side by side, no "vs" divider, the two stone colors are
 * distinction enough) and, right below it, its own separate card for the
 * rest of the data: komi/date/event each on their own line, the game
 * result (hidden behind a "Show result" toggle by default, since a
 * spoiler-visible result isn't always wanted alongside an SGF being
 * replayed move by move), and the *current* move's comment (SGF `C`
 * property), which updates live as the board navigates. Shows "No game
 * loaded." until its `<go-board>` fires `sgf-loaded`. Read-only — never
 * calls back into the board.
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
 *     result, comment) entirely, showing just the players row
 */
export class GoMetadataContainerElement extends HTMLElement {
  static get observedAttributes(): string[] {
    return ["details"];
  }

  private board: GoBoardElement | null = null;
  private resultRevealed = false;

  private emptyEl!: HTMLElement;
  private cardEl!: HTMLElement;
  private blackNameEl!: HTMLElement;
  private blackRankEl!: HTMLElement;
  private whiteNameEl!: HTMLElement;
  private whiteRankEl!: HTMLElement;
  private detailsEl!: HTMLElement;
  private metaEl!: HTMLElement;
  private resultLineEl!: HTMLElement;
  private resultToggleEl!: HTMLButtonElement;
  private resultValueEl!: HTMLElement;
  private commentEl!: HTMLElement;

  /** Whether the info below the player panels (meta line/result/comment) is shown, per the `details` attribute. */
  private get showDetails(): boolean {
    return !this.hasAttribute("details") || this.getAttribute("details") !== "false";
  }

  attributeChangedCallback(): void {
    if (this.isConnected) this.render();
  }

  connectedCallback(): void {
    if (!this.shadowRoot) {
      const shadow = this.attachShadow({ mode: "open" });
      shadow.innerHTML = `
        <style>${STYLES}</style>
        <p class="empty" id="empty">No game loaded.</p>
        <div class="card" id="card" hidden>
          <div class="players">
            <div class="player-panel player-panel-black">
              <span class="stone-dot stone-dot-black"></span>
              <div class="player-text">
                <span class="player-name" id="blackName"></span>
                <span class="player-rank" id="blackRank"></span>
              </div>
            </div>
            <div class="player-panel player-panel-white">
              <span class="stone-dot stone-dot-white"></span>
              <div class="player-text">
                <span class="player-name" id="whiteName"></span>
                <span class="player-rank" id="whiteRank"></span>
              </div>
            </div>
          </div>
          <div class="details" id="details">
            <div id="meta"></div>
            <div class="result-line" id="resultLine" hidden>
              <button class="result-toggle" id="resultToggle" type="button">Show result</button>
              <span class="result-value" id="resultValue" hidden></span>
            </div>
            <div class="comment" id="comment" hidden></div>
          </div>
        </div>
      `;
      this.emptyEl = shadow.getElementById("empty") as HTMLElement;
      this.cardEl = shadow.getElementById("card") as HTMLElement;
      this.blackNameEl = shadow.getElementById("blackName") as HTMLElement;
      this.blackRankEl = shadow.getElementById("blackRank") as HTMLElement;
      this.whiteNameEl = shadow.getElementById("whiteName") as HTMLElement;
      this.whiteRankEl = shadow.getElementById("whiteRank") as HTMLElement;
      this.detailsEl = shadow.getElementById("details") as HTMLElement;
      this.metaEl = shadow.getElementById("meta") as HTMLElement;
      this.resultLineEl = shadow.getElementById("resultLine") as HTMLElement;
      this.resultToggleEl = shadow.getElementById("resultToggle") as HTMLButtonElement;
      this.resultValueEl = shadow.getElementById("resultValue") as HTMLElement;
      this.commentEl = shadow.getElementById("comment") as HTMLElement;
      this.resultToggleEl.addEventListener("click", this.handleToggleResult);
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

  private readonly handleToggleResult = (): void => {
    this.resultRevealed = !this.resultRevealed;
    this.render();
  };

  private render(): void {
    const root = this.board?.sgfTree?.nodes[0];
    if (!root || !this.board) {
      this.emptyEl.hidden = false;
      this.cardEl.hidden = true;
      return;
    }
    this.emptyEl.hidden = true;
    this.cardEl.hidden = false;

    this.blackNameEl.textContent = property(root, "PB") ?? "Black";
    const blackRank = property(root, "BR");
    this.blackRankEl.textContent = blackRank ? `(${blackRank})` : "";
    this.whiteNameEl.textContent = property(root, "PW") ?? "White";
    const whiteRank = property(root, "WR");
    this.whiteRankEl.textContent = whiteRank ? `(${whiteRank})` : "";

    this.detailsEl.hidden = !this.showDetails;
    if (!this.showDetails) return;

    this.metaEl.replaceChildren(
      ...metaLines(root).map((text) => {
        const line = document.createElement("div");
        line.className = "meta-line";
        line.textContent = text;
        return line;
      }),
    );

    const result = property(root, "RE");
    this.resultLineEl.hidden = !result;
    this.resultToggleEl.textContent = this.resultRevealed ? "Hide result" : "Show result";
    this.resultValueEl.textContent = result ?? "";
    this.resultValueEl.hidden = !this.resultRevealed;

    const currentNode = this.board.sgfTree?.nodes[this.board.moveIndex];
    const comment = currentNode ? property(currentNode, "C") : undefined;
    this.commentEl.hidden = !comment;
    this.commentEl.textContent = comment ?? "";
  }
}

function property(node: SGFNode, id: string): string | undefined {
  return node.properties[id]?.[0];
}

function metaLines(root: SGFNode): string[] {
  const komi = property(root, "KM");
  const date = property(root, "DT");
  const event = property(root, "GN");

  return [komi ? `Komi ${komi}` : null, date, event].filter((line): line is string => Boolean(line));
}

customElements.define("go-metadata-container", GoMetadataContainerElement);
