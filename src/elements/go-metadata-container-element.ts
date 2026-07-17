import { resolveBoard } from "./resolve-board";
import type { GoBoardElement } from "./go-board-element";
import type { SGFNode } from "../core/sgf";

const STYLES = `
  :host {
    display: block;
    font-family: system-ui, sans-serif;
  }
  .empty {
    margin: 0;
    color: #888;
    font-size: 0.9rem;
  }
  .card {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 8px;
    box-sizing: border-box;
  }
  .players {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    flex-wrap: wrap;
  }
  .player {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
  }
  .stone-dot {
    width: 0.8rem;
    height: 0.8rem;
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
  .player-name {
    color: #eee;
    font-weight: 600;
    font-size: 0.95rem;
  }
  .player-rank {
    color: #999;
    font-size: 0.8rem;
  }
  .vs {
    color: #666;
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  .meta-line {
    color: #999;
    font-size: 0.85rem;
  }
  .comment {
    color: #ccc;
    font-size: 0.85rem;
    line-height: 1.4;
    white-space: pre-wrap;
    padding-top: 0.5rem;
    border-top: 1px solid rgba(255, 255, 255, 0.08);
  }
`;

/**
 * `<go-metadata-container>` — displays the loaded SGF's game info (players
 * with stone-color indicators, ranks, komi, result, date, event) plus the
 * *current* move's comment (SGF `C` property), updating live as the board
 * navigates. Reads only; never mutates the board.
 *
 * Attributes:
 *   - `board` (optional element id of the `<go-board>` to read from;
 *     otherwise the nearest one is located automatically)
 */
export class GoMetadataContainerElement extends HTMLElement {
  private board: GoBoardElement | null = null;
  private emptyEl!: HTMLElement;
  private cardEl!: HTMLElement;
  private playersEl!: HTMLElement;
  private metaEl!: HTMLElement;
  private commentEl!: HTMLElement;

  connectedCallback(): void {
    if (!this.shadowRoot) {
      const shadow = this.attachShadow({ mode: "open" });
      shadow.innerHTML = `
        <style>${STYLES}</style>
        <p class="empty" id="empty">No game loaded.</p>
        <div class="card" id="card" hidden>
          <div class="players" id="players"></div>
          <div class="meta-line" id="meta"></div>
          <div class="comment" id="comment" hidden></div>
        </div>
      `;
      this.emptyEl = shadow.getElementById("empty") as HTMLElement;
      this.cardEl = shadow.getElementById("card") as HTMLElement;
      this.playersEl = shadow.getElementById("players") as HTMLElement;
      this.metaEl = shadow.getElementById("meta") as HTMLElement;
      this.commentEl = shadow.getElementById("comment") as HTMLElement;
    }
    this.board = resolveBoard(this);
    this.board?.addEventListener("sgf-loaded", this.handleUpdate);
    this.board?.addEventListener("sgf-error", this.handleUpdate);
    this.board?.addEventListener("navigate", this.handleUpdate);
    this.render();
  }

  disconnectedCallback(): void {
    this.board?.removeEventListener("sgf-loaded", this.handleUpdate);
    this.board?.removeEventListener("sgf-error", this.handleUpdate);
    this.board?.removeEventListener("navigate", this.handleUpdate);
  }

  private readonly handleUpdate = (): void => this.render();

  private render(): void {
    const root = this.board?.sgfTree?.nodes[0];
    if (!root || !this.board) {
      this.emptyEl.hidden = false;
      this.cardEl.hidden = true;
      return;
    }
    this.emptyEl.hidden = true;
    this.cardEl.hidden = false;
    this.playersEl.innerHTML = formatPlayers(root);
    this.metaEl.innerHTML = formatMetaLine(root);

    const currentNode = this.board.sgfTree?.nodes[this.board.moveIndex];
    const comment = currentNode ? property(currentNode, "C") : undefined;
    this.commentEl.hidden = !comment;
    this.commentEl.textContent = comment ?? "";
  }
}

function property(node: SGFNode, id: string): string | undefined {
  return node.properties[id]?.[0];
}

function formatPlayers(root: SGFNode): string {
  const black = property(root, "PB") ?? "Black";
  const blackRank = property(root, "BR");
  const white = property(root, "PW") ?? "White";
  const whiteRank = property(root, "WR");

  return [
    playerMarkup("black", black, blackRank),
    `<span class="vs">vs</span>`,
    playerMarkup("white", white, whiteRank),
  ].join("");
}

function playerMarkup(color: "black" | "white", name: string, rank: string | undefined): string {
  return (
    `<span class="player">` +
    `<span class="stone-dot stone-dot-${color}"></span>` +
    `<span class="player-name">${escapeHtml(name)}</span>` +
    (rank ? `<span class="player-rank">(${escapeHtml(rank)})</span>` : "") +
    `</span>`
  );
}

function formatMetaLine(root: SGFNode): string {
  const komi = property(root, "KM");
  const result = property(root, "RE");
  const date = property(root, "DT");
  const event = property(root, "GN");

  return [
    komi ? `Komi ${escapeHtml(komi)}` : "",
    result ? `Result ${escapeHtml(result)}` : "",
    date ? escapeHtml(date) : "",
    event ? escapeHtml(event) : "",
  ]
    .filter(Boolean)
    .join(" · ");
}

const HTML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (ch) => HTML_ESCAPES[ch]!);
}

customElements.define("go-metadata-container", GoMetadataContainerElement);
