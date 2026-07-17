import { Board } from "../core/board";
import { isSGFPass, parseSGF, sgfPointToVertex } from "../core/sgf";
import { Color } from "../core/types";
import type { SGFGameTree, SGFNode } from "../core/sgf";
import type { Vertex } from "../core/types";

const SVG_NS = "http://www.w3.org/2000/svg";

/** Treats a bare numeric string as pixels; passes any other CSS length through as-is. */
function cssLength(value: string): string {
  return /^\d+(\.\d+)?$/.test(value) ? `${value}px` : value;
}

// Skips "I" per Go coordinate convention.
const COLUMN_LETTERS = "ABCDEFGHJKLMNOPQRSTUVWXYZ";

const PADDING = 1;
const STONE_RADIUS = 0.475;
const STAR_RADIUS = 0.09;

const STAR_POINTS: Record<number, [number, number][]> = {
  9: [
    [2, 2],
    [2, 6],
    [6, 2],
    [6, 6],
    [4, 4],
  ],
  13: [
    [3, 3],
    [3, 9],
    [9, 3],
    [9, 9],
    [6, 6],
  ],
  19: [
    [3, 3],
    [3, 9],
    [3, 15],
    [9, 3],
    [9, 9],
    [9, 15],
    [15, 3],
    [15, 9],
    [15, 15],
  ],
};

export interface MoveEventDetail {
  x: number;
  y: number;
  color: Color;
  captured: Vertex[];
}

export interface IllegalMoveEventDetail {
  x: number;
  y: number;
  reason: string;
}

export interface SGFLoadedEventDetail {
  tree: SGFGameTree;
}

export interface SGFErrorEventDetail {
  error: unknown;
}

export interface NavigateEventDetail {
  moveIndex: number;
  moveCount: number;
}

/**
 * `<go-board>` — an interactive Go board Web Component with an SVG,
 * Sabaki-inspired rendering and a self-contained rules engine.
 *
 * Attributes:
 *   - `size` (9 | 13 | 19 | any positive integer, default 19)
 *   - `coordinates` (boolean, default present)
 *   - `interactive` (boolean, default present)
 *   - `sgf` (URL to fetch and parse; drives the board via the navigation API)
 *   - `black-stone` / `white-stone` (image URL to render stones with,
 *     instead of the default gradient circles)
 *   - `width` / `height` (CSS length; bare numbers are treated as px.
 *     Defaults to 100% width with a 1:1 aspect ratio when unset)
 *   - `background-image` (image URL to render behind the grid, instead of
 *     the default wood gradient)
 *
 * Events:
 *   - `move` — fired after a legal move, `detail: MoveEventDetail`
 *   - `illegal-move` — fired when a click targets an illegal point
 *   - `pass` — fired after `pass()` is called
 *   - `sgf-loaded` — fired after a `sgf` URL is fetched and parsed
 *   - `sgf-error` — fired when fetching/parsing a `sgf` URL fails
 *   - `navigate` — fired after `nextMove()`/`previousMove()`/`goToMove()`
 *     change the current position, `detail: NavigateEventDetail`
 */
export class GoBoardElement extends HTMLElement {
  static get observedAttributes(): string[] {
    return [
      "size",
      "coordinates",
      "interactive",
      "sgf",
      "black-stone",
      "white-stone",
      "width",
      "height",
      "background-image",
    ];
  }

  private _board: Board;
  private svg!: SVGSVGElement;
  private stonesGroup!: SVGGElement;
  private ghostStone!: SVGCircleElement;
  private hovered: Vertex | null = null;

  private _sgfTree: SGFGameTree | null = null;
  private _sgfMainLine: SGFNode[] | null = null;
  private _moveIndex = 0;
  private sgfLoadToken = 0;

  constructor() {
    super();
    this._board = new Board(this.sizeAttr);
    this.attachShadow({ mode: "open" });
  }

  connectedCallback(): void {
    this.applyHostSize();
    this.buildSvg();
    this.render();
    this.svg.addEventListener("click", this.handleClick);
    this.svg.addEventListener("mousemove", this.handlePointerMove);
    this.svg.addEventListener("mouseleave", this.handlePointerLeave);
  }

  disconnectedCallback(): void {
    this.svg.removeEventListener("click", this.handleClick);
    this.svg.removeEventListener("mousemove", this.handlePointerMove);
    this.svg.removeEventListener("mouseleave", this.handlePointerLeave);
  }

  attributeChangedCallback(name: string, _oldValue: string | null, newValue: string | null): void {
    if (!this.isConnected) return;
    if (name === "size") {
      this._board = new Board(this.sizeAttr);
      this.hovered = null;
      this.buildSvg();
    } else if (name === "sgf") {
      if (newValue) {
        void this.loadSgf(newValue);
      } else {
        this.sgfLoadToken++;
        this._sgfTree = null;
        this._sgfMainLine = null;
        this._moveIndex = 0;
      }
      return;
    } else if (name === "width" || name === "height") {
      this.applyHostSize();
      return;
    } else if (name === "background-image") {
      this.buildSvg();
    }
    this.render();
  }

  /** The underlying rules engine, for read-only inspection. */
  get board(): Board {
    return this._board;
  }

  /** The parsed SGF game tree loaded via the `sgf` attribute, if any. */
  get sgfTree(): SGFGameTree | null {
    return this._sgfTree;
  }

  /** Current position within the loaded SGF's main line (0 = game start). */
  get moveIndex(): number {
    return this._moveIndex;
  }

  /** Total number of moves in the loaded SGF's main line. */
  get moveCount(): number {
    return this._sgfMainLine?.length ?? 0;
  }

  get interactive(): boolean {
    return !this.hasAttribute("interactive") || this.getAttribute("interactive") !== "false";
  }

  private get sizeAttr(): number {
    const value = Number(this.getAttribute("size"));
    return Number.isInteger(value) && value > 1 ? value : 19;
  }

  private get showCoordinates(): boolean {
    return !this.hasAttribute("coordinates") || this.getAttribute("coordinates") !== "false";
  }

  /**
   * Reflects the `width`/`height` attributes onto inline host styles. With
   * neither set, defaults to 100% width (the host's `aspect-ratio: 1/1`
   * derives a square height). Setting just one derives the other to match
   * it (a square board at that size) — computed here rather than left to
   * CSS `aspect-ratio`, since a slotted flex child stretches its cross-axis
   * ("auto" width) to fill the container regardless of aspect-ratio.
   */
  private applyHostSize(): void {
    const widthAttr = this.getAttribute("width");
    const heightAttr = this.getAttribute("height");
    if (!widthAttr && !heightAttr) {
      this.style.width = "100%";
      this.style.height = "";
      return;
    }
    this.style.width = cssLength(widthAttr ?? heightAttr!);
    this.style.height = cssLength(heightAttr ?? widthAttr!);
  }

  /** Plays a move for the current player at the given board coordinates. */
  play(x: number, y: number): boolean {
    const result = this._board.play(x, y);
    if (result.legal) {
      this.render();
      this.dispatchEvent(
        new CustomEvent<MoveEventDetail>("move", {
          detail: { x, y, color: result.color, captured: result.captured },
          bubbles: true,
          composed: true,
        }),
      );
      return true;
    }
    this.dispatchEvent(
      new CustomEvent<IllegalMoveEventDetail>("illegal-move", {
        detail: { x, y, reason: result.reason },
        bubbles: true,
        composed: true,
      }),
    );
    return false;
  }

  /** Passes the current player's turn. */
  pass(): void {
    this._board.pass();
    this.render();
    this.dispatchEvent(new CustomEvent("pass", { bubbles: true, composed: true }));
  }

  /** Clears the board, optionally resizing it. Does not affect a loaded SGF. */
  reset(size: number = this._board.size): void {
    this._board = new Board(size);
    this.hovered = null;
    this.buildSvg();
    this.render();
  }

  /** Steps forward one move in the loaded SGF's main line. */
  nextMove(): boolean {
    if (!this._sgfMainLine || this._moveIndex >= this._sgfMainLine.length) return false;
    this.goToMove(this._moveIndex + 1);
    return true;
  }

  /** Steps back one move in the loaded SGF's main line. */
  previousMove(): boolean {
    if (!this._sgfMainLine || this._moveIndex <= 0) return false;
    this.goToMove(this._moveIndex - 1);
    return true;
  }

  /** Jumps to an arbitrary position in the loaded SGF's main line. */
  goToMove(index: number): void {
    if (!this._sgfMainLine) return;
    const clamped = Math.max(0, Math.min(index, this._sgfMainLine.length));
    if (clamped === this._moveIndex) return;

    const size = this._board.size;
    this._board = new Board(size);
    for (let i = 0; i < clamped; i++) {
      this.applySgfNode(this._sgfMainLine[i]!);
    }
    this._moveIndex = clamped;
    this.hovered = null;
    this.render();
    this.dispatchEvent(
      new CustomEvent<NavigateEventDetail>("navigate", {
        detail: { moveIndex: this._moveIndex, moveCount: this._sgfMainLine.length },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private applySgfNode(node: SGFNode): void {
    const color =
      "B" in node.properties ? Color.Black : "W" in node.properties ? Color.White : null;
    if (color === null) return; // setup-only node (e.g. AB/AW), nothing to replay

    const value = node.properties[color === Color.Black ? "B" : "W"]?.[0] ?? "";
    if (isSGFPass(value, this._board.size)) {
      this._board.pass();
      return;
    }
    const vertex = sgfPointToVertex(value);
    if (!vertex) return;
    this._board.play(vertex.x, vertex.y);
  }

  private async loadSgf(url: string): Promise<void> {
    const token = ++this.sgfLoadToken;
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch SGF: ${response.status} ${response.statusText}`);
      }
      const text = await response.text();
      const [tree] = parseSGF(text);
      if (!tree) throw new Error("SGF contains no game tree");
      const root = tree.nodes[0];
      if (!root) throw new Error("SGF game tree has no root node");
      if (token !== this.sgfLoadToken) return; // superseded by a newer `sgf` value

      const size = Number(root.properties["SZ"]?.[0] ?? "19");
      this._sgfTree = tree;
      this._sgfMainLine = tree.nodes.slice(1);
      this._moveIndex = 0;
      this.reset(size);

      this.dispatchEvent(
        new CustomEvent<SGFLoadedEventDetail>("sgf-loaded", {
          detail: { tree },
          bubbles: true,
          composed: true,
        }),
      );
    } catch (error) {
      if (token !== this.sgfLoadToken) return;
      this._sgfTree = null;
      this._sgfMainLine = null;
      this._moveIndex = 0;
      console.error("go-board: failed to load SGF from", url, error);
      this.dispatchEvent(
        new CustomEvent<SGFErrorEventDetail>("sgf-error", {
          detail: { error },
          bubbles: true,
          composed: true,
        }),
      );
    }
  }

  private readonly handleClick = (event: MouseEvent): void => {
    if (!this.interactive) return;
    const vertex = this.vertexFromEvent(event);
    if (!vertex) return;
    this.play(vertex.x, vertex.y);
  };

  private readonly handlePointerMove = (event: MouseEvent): void => {
    if (!this.interactive) return;
    const vertex = this.vertexFromEvent(event);
    if (vertex && (!this.hovered || vertex.x !== this.hovered.x || vertex.y !== this.hovered.y)) {
      this.hovered = vertex;
      this.updateGhostStone();
    } else if (!vertex && this.hovered) {
      this.hovered = null;
      this.updateGhostStone();
    }
  };

  private readonly handlePointerLeave = (): void => {
    if (this.hovered) {
      this.hovered = null;
      this.updateGhostStone();
    }
  };

  private vertexFromEvent(event: MouseEvent): Vertex | null {
    const point = this.svg.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;
    const ctm = this.svg.getScreenCTM();
    if (!ctm) return null;
    const local = point.matrixTransform(ctm.inverse());
    const x = Math.round(local.x - PADDING);
    const y = Math.round(local.y - PADDING);
    const size = this._board.size;
    if (x < 0 || x >= size || y < 0 || y >= size) return null;
    if (Math.hypot(local.x - PADDING - x, local.y - PADDING - y) > 0.5) return null;
    return { x, y };
  }

  private buildSvg(): void {
    const size = this._board.size;
    const extent = size - 1 + PADDING * 2;
    const stars = STAR_POINTS[size] ?? [];

    const gridLines: string[] = [];
    for (let i = 0; i < size; i++) {
      gridLines.push(
        `<line x1="${PADDING}" y1="${PADDING + i}" x2="${PADDING + size - 1}" y2="${PADDING + i}" />`,
        `<line x1="${PADDING + i}" y1="${PADDING}" x2="${PADDING + i}" y2="${PADDING + size - 1}" />`,
      );
    }

    const starMarkup = stars
      .map(([x, y]) => `<circle class="star" cx="${PADDING + x}" cy="${PADDING + y}" r="${STAR_RADIUS}" />`)
      .join("");

    const coordMarkup = this.showCoordinates ? this.buildCoordinateMarkup(size, extent) : "";

    this.shadowRoot!.innerHTML = `
      <style>${STYLES}</style>
      <svg viewBox="0 0 ${extent} ${extent}" role="group" aria-label="Go board">
        <defs>
          <radialGradient id="wood" cx="35%" cy="30%" r="75%">
            <stop offset="0%" stop-color="#f0c988" />
            <stop offset="100%" stop-color="#cf9a55" />
          </radialGradient>
          <radialGradient id="black-stone" cx="35%" cy="30%" r="70%">
            <stop offset="0%" stop-color="#6a6a6a" />
            <stop offset="45%" stop-color="#2b2b2b" />
            <stop offset="100%" stop-color="#050505" />
          </radialGradient>
          <radialGradient id="white-stone" cx="35%" cy="30%" r="70%">
            <stop offset="0%" stop-color="#ffffff" />
            <stop offset="75%" stop-color="#e7e2d6" />
            <stop offset="100%" stop-color="#c9c3b3" />
          </radialGradient>
        </defs>
        <rect class="board-bg" x="0" y="0" width="${extent}" height="${extent}" fill="url(#wood)" />
        <g class="grid" stroke="#453017" stroke-width="0.035">${gridLines.join("")}</g>
        <g class="star-points" fill="#453017">${starMarkup}</g>
        ${coordMarkup}
        <g class="stones"></g>
        <circle class="ghost-stone" r="${STONE_RADIUS}" visibility="hidden" />
      </svg>
    `;

    this.svg = this.shadowRoot!.querySelector("svg") as SVGSVGElement;
    this.stonesGroup = this.shadowRoot!.querySelector(".stones") as SVGGElement;
    this.ghostStone = this.shadowRoot!.querySelector(".ghost-stone") as SVGCircleElement;

    // Built via DOM APIs (not string-interpolated into the markup above) so
    // an attacker-controlled URL can't break out of the `href` attribute.
    const backgroundImage = this.getAttribute("background-image");
    if (backgroundImage) {
      const image = document.createElementNS(SVG_NS, "image");
      image.setAttribute("x", "0");
      image.setAttribute("y", "0");
      image.setAttribute("width", String(extent));
      image.setAttribute("height", String(extent));
      image.setAttribute("preserveAspectRatio", "xMidYMid slice");
      image.setAttribute("href", backgroundImage);
      image.setAttribute("class", "board-bg-image");
      this.shadowRoot!.querySelector(".board-bg")!.insertAdjacentElement("afterend", image);
    }
  }

  private buildCoordinateMarkup(size: number, extent: number): string {
    const labelOffset = PADDING / 2;
    const columns: string[] = [];
    const rows: string[] = [];
    for (let x = 0; x < size; x++) {
      const letter = COLUMN_LETTERS[x] ?? "?";
      columns.push(
        `<text x="${PADDING + x}" y="${labelOffset}">${letter}</text>`,
        `<text x="${PADDING + x}" y="${extent - labelOffset}">${letter}</text>`,
      );
    }
    for (let y = 0; y < size; y++) {
      const label = size - y;
      rows.push(
        `<text x="${labelOffset}" y="${PADDING + y}">${label}</text>`,
        `<text x="${extent - labelOffset}" y="${PADDING + y}">${label}</text>`,
      );
    }
    return `<g class="coordinates">${columns.join("")}${rows.join("")}</g>`;
  }

  private render(): void {
    if (!this.stonesGroup) return;
    this.stonesGroup.replaceChildren();
    const size = this._board.size;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const color = this._board.get(x, y);
        if (color === Color.Empty) continue;
        this.stonesGroup.appendChild(this.createStone(x, y, color));
      }
    }
    this.updateGhostStone();
  }

  private stoneImageUrl(color: Color): string | null {
    const attr = color === Color.Black ? "black-stone" : "white-stone";
    return this.getAttribute(attr) || null;
  }

  private createStone(x: number, y: number, color: Color): SVGElement {
    const imageUrl = this.stoneImageUrl(color);
    if (imageUrl) {
      const image = document.createElementNS(SVG_NS, "image");
      image.setAttribute("x", String(PADDING + x - STONE_RADIUS));
      image.setAttribute("y", String(PADDING + y - STONE_RADIUS));
      image.setAttribute("width", String(STONE_RADIUS * 2));
      image.setAttribute("height", String(STONE_RADIUS * 2));
      image.setAttribute("href", imageUrl);
      image.setAttribute("class", "stone");
      return image;
    }
    const circle = document.createElementNS(SVG_NS, "circle");
    circle.setAttribute("cx", String(PADDING + x));
    circle.setAttribute("cy", String(PADDING + y));
    circle.setAttribute("r", String(STONE_RADIUS));
    circle.setAttribute("class", color === Color.Black ? "stone stone-black" : "stone stone-white");
    return circle;
  }

  private updateGhostStone(): void {
    if (!this.ghostStone) return;
    const vertex = this.hovered;
    const legal =
      this.interactive &&
      !this._board.isOver &&
      vertex !== null &&
      this._board.isLegalMove(vertex.x, vertex.y);

    if (!legal || !vertex) {
      this.ghostStone.setAttribute("visibility", "hidden");
      return;
    }

    this.ghostStone.setAttribute("cx", String(PADDING + vertex.x));
    this.ghostStone.setAttribute("cy", String(PADDING + vertex.y));
    this.ghostStone.setAttribute(
      "fill",
      this._board.currentColor === Color.Black ? "#111111" : "#f5f2e9",
    );
    this.ghostStone.setAttribute("visibility", "visible");
  }
}

const STYLES = `
  :host {
    display: block;
    aspect-ratio: 1 / 1;
    user-select: none;
    -webkit-user-select: none;
  }
  svg {
    display: block;
    width: 100%;
    height: 100%;
    touch-action: none;
    cursor: pointer;
  }
  .star-points circle {
    pointer-events: none;
  }
  .coordinates text {
    font-family: system-ui, sans-serif;
    font-size: 0.32px;
    fill: #453017;
    text-anchor: middle;
    dominant-baseline: middle;
    pointer-events: none;
  }
  .stone {
    stroke-width: 0.02;
  }
  .stone-black {
    fill: url(#black-stone);
    stroke: #000000;
  }
  .stone-white {
    fill: url(#white-stone);
    stroke: #9c9483;
  }
  .ghost-stone {
    opacity: 0.4;
    pointer-events: none;
  }
`;

customElements.define("go-board", GoBoardElement);
