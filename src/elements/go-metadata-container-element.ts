import { resolveBoard } from "./resolve-board";
import type { GoBoardElement } from "./go-board-element";
import type { SGFNode } from "../core/sgf";

const STYLES = `
  :host {
    display: block;
    font-family: system-ui, sans-serif;
    font-size: 0.9rem;
    color: #bbb;
  }
  strong {
    color: #eee;
    font-weight: 600;
  }
`;

/**
 * `<go-metadata-container>` — displays the root-node game info (players,
 * ranks, komi, result, date, event) of the SGF loaded on its associated
 * `<go-board>`. Reads only; never mutates the board.
 *
 * Attributes:
 *   - `board` (optional element id of the `<go-board>` to read from;
 *     otherwise the nearest one is located automatically)
 */
export class GoMetadataContainerElement extends HTMLElement {
  private board: GoBoardElement | null = null;
  private content!: HTMLElement;

  connectedCallback(): void {
    if (!this.shadowRoot) {
      const shadow = this.attachShadow({ mode: "open" });
      shadow.innerHTML = `<style>${STYLES}</style><p id="content">No game loaded.</p>`;
      this.content = shadow.getElementById("content") as HTMLElement;
    }
    this.board = resolveBoard(this);
    this.board?.addEventListener("sgf-loaded", this.handleUpdate);
    this.board?.addEventListener("sgf-error", this.handleUpdate);
    this.render();
  }

  disconnectedCallback(): void {
    this.board?.removeEventListener("sgf-loaded", this.handleUpdate);
    this.board?.removeEventListener("sgf-error", this.handleUpdate);
  }

  private readonly handleUpdate = (): void => this.render();

  private render(): void {
    const root = this.board?.sgfTree?.nodes[0];
    if (!root) {
      this.content.textContent = "No game loaded.";
      return;
    }
    this.content.innerHTML = formatGameInfo(root);
  }
}

function property(node: SGFNode, id: string): string | undefined {
  return node.properties[id]?.[0];
}

function formatGameInfo(root: SGFNode): string {
  const black = property(root, "PB") ?? "Black";
  const blackRank = property(root, "BR");
  const white = property(root, "PW") ?? "White";
  const whiteRank = property(root, "WR");
  const komi = property(root, "KM");
  const result = property(root, "RE");
  const date = property(root, "DT");
  const event = property(root, "GN");

  return [
    `<strong>${escapeHtml(white)}</strong>${whiteRank ? ` (${escapeHtml(whiteRank)})` : ""} vs `,
    `<strong>${escapeHtml(black)}</strong>${blackRank ? ` (${escapeHtml(blackRank)})` : ""}`,
    komi ? ` · Komi ${escapeHtml(komi)}` : "",
    result ? ` · Result ${escapeHtml(result)}` : "",
    date ? ` · ${escapeHtml(date)}` : "",
    event ? ` · ${escapeHtml(event)}` : "",
  ].join("");
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
