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

/**
 * Resolves any valid CSS length (px, pt, rem, %, ...) to an absolute pixel
 * number, via a detached probe element the browser's own CSS engine
 * resolves — avoids reimplementing unit-conversion math ourselves.
 */
function cssLengthToPixels(value: string): number {
  const probe = document.createElement("div");
  probe.style.position = "absolute";
  probe.style.visibility = "hidden";
  probe.style.pointerEvents = "none";
  probe.style.fontSize = cssLength(value);
  document.body.appendChild(probe);
  const resolved = parseFloat(getComputedStyle(probe).fontSize);
  probe.remove();
  return Number.isFinite(resolved) ? resolved : 0;
}

// Skips "I" per Go coordinate convention.
const COLUMN_LETTERS = "ABCDEFGHJKLMNOPQRSTUVWXYZ";

export type CoordinateSide = "top" | "bottom" | "left" | "right";
const ALL_COORDINATE_SIDES: CoordinateSide[] = ["top", "bottom", "left", "right"];

const DEFAULT_COORDS_FONT_FAMILY = "system-ui, sans-serif";
const DEFAULT_COORDS_FONT_SIZE = "0.32";
const DEFAULT_COORDS_GAP = 0.5;

// Small, so the default look matches the pre-reservation-split appearance:
// coordinate labels already carve out their own space (see `computeLayout`),
// this just adds a touch of breathing room beyond them.
const DEFAULT_PADDING = 0.2;
const STONE_RADIUS = 0.475;
const STAR_RADIUS = 0.09;
// How far a cropped edge's grid lines overhang past the last visible
// intersection, signaling "the board continues past what's shown" instead of
// looking like a smaller full board.
const CROP_BLEED = 0.4;

interface BoardLayout {
  size: number;
  xStart: number;
  xEnd: number;
  yStart: number;
  yEnd: number;
  padding: number;
  extentX: number;
  extentY: number;
  gridOffsetX: number;
  gridOffsetY: number;
}

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

export type GoBoardKeyAction = "next" | "previous";
export type GoBoardKeyBindings = Partial<Record<GoBoardKeyAction, string | string[]>>;

const DEFAULT_KEY_BINDINGS: Record<GoBoardKeyAction, string[]> = {
  next: ["ArrowRight"],
  previous: ["ArrowLeft"],
};

function normalizeKeyBinding(value: string | string[] | undefined): string[] | undefined {
  if (value === undefined) return undefined;
  return Array.isArray(value) ? value : [value];
}

/**
 * `<go-board>` — an interactive Go board Web Component with an SVG,
 * Sabaki-inspired rendering and a self-contained rules engine.
 *
 * Attributes:
 *   - `size` (9 | 13 | 19 | any positive integer, default 19)
 *   - `coordinates` — which sides get labels: unset/`"true"` (all four,
 *     default), `"false"` (none), or a space/comma-separated list of
 *     `top`/`bottom`/`left`/`right`, e.g. `coordinates="top left"`
 *   - `coordinates-font` — CSS font-family for the labels
 *     (default `"system-ui, sans-serif"`)
 *   - `coordinates-font-size` — real CSS length for the labels (bare
 *     numbers are px, e.g. `"10"` or `"10pt"`; default matches the board's
 *     own scale, about `0.32` of a grid cell). Converted internally to the
 *     board's SVG unit space using the host's current rendered size, kept
 *     in sync via a `ResizeObserver` as the board resizes.
 *   - `coordinates-gap` — real CSS length for label distance from the grid
 *     edge, converted the same way (default centers labels in the fixed
 *     1-unit margin reserved for them)
 *   - `padding` — real CSS length for the blank margin between the host's
 *     outer edge and the grid/coordinates (coordinate labels get their own
 *     reserved space automatically when shown, so this is purely extra
 *     breathing room outside of them, always in addition to it — never a
 *     substitute). Converted the same way as the two attributes above.
 *   - `x-start` / `x-end` / `y-start` / `y-end` — crop the rendered board to
 *     a sub-rectangle of vertices (inclusive, 0-indexed, same coordinate
 *     space as `move`'s `detail.x`/`detail.y`). Defaults to the full board.
 *     Cut edges (where the crop doesn't reach the true board edge) render
 *     grid lines with a short overhang, signaling the board continues past
 *     what's shown, and only show coordinate labels for the visible range.
 *     The rules engine is unaffected — this only changes what's drawn and
 *     clickable.
 *   - `interactive` (boolean, default present)
 *   - `sgf` (URL to fetch and parse; drives the board via the navigation API)
 *   - `black-stone` / `white-stone` (image URL to render stones with,
 *     instead of the default gradient circles)
 *   - `width` / `height` (CSS length; bare numbers are treated as px.
 *     Defaults to 100% width with a 1:1 aspect ratio when unset)
 *   - `background-image` (image URL to render behind the grid, instead of
 *     the default wood gradient)
 *   - `keyboard-shortcuts` (boolean, default present) — set to `"false"` to
 *     disable arrow-key SGF navigation entirely
 *
 * Keyboard navigation: with an `sgf` loaded, ArrowRight/ArrowLeft step
 * `nextMove()`/`previousMove()` whenever focus is anywhere inside the
 * nearest `go-board-container` ancestor (or inside this element itself, if
 * there is none). Remap via the `keyBindings` property.
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
      "coordinates-font",
      "coordinates-font-size",
      "coordinates-gap",
      "padding",
      "x-start",
      "x-end",
      "y-start",
      "y-end",
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
  private _keyBindings: Record<GoBoardKeyAction, string[]> = {
    next: [...DEFAULT_KEY_BINDINGS.next],
    previous: [...DEFAULT_KEY_BINDINGS.previous],
  };
  private resizeObserver: ResizeObserver | null = null;

  constructor() {
    super();
    this._board = new Board(this.sizeAttr);
    this.attachShadow({ mode: "open" });
  }

  connectedCallback(): void {
    this.applyHostSize();
    this.applyCoordinateStyle();
    this.buildSvg();
    this.render();
    // Bound to the host, not `this.svg` — `buildSvg()` replaces the entire
    // shadow DOM (including the `<svg>`) whenever padding/coordinates/crop
    // attributes change, which would otherwise leave these listeners
    // attached to a detached, stale element. `click`/`mousemove` are
    // composed and bubble up through the shadow boundary to the host
    // regardless of which `<svg>` is currently inside it; `mouseleave`
    // doesn't bubble, but the svg fills the host's full box, so "left the
    // host" and "left the svg" coincide.
    this.addEventListener("click", this.handleClick);
    this.addEventListener("mousemove", this.handlePointerMove);
    this.addEventListener("mouseleave", this.handlePointerLeave);
    document.addEventListener("keydown", this.handleKeyDown);
    // Re-derives coordinates-font-size/coordinates-gap (CSS units converted
    // to board units) whenever the host's rendered size changes, and also
    // fires once on observe() — which is what resolves them correctly after
    // the very first connect, when layout may not have run yet.
    this.resizeObserver = new ResizeObserver(this.handleResize);
    this.resizeObserver.observe(this);
  }

  disconnectedCallback(): void {
    this.removeEventListener("click", this.handleClick);
    this.removeEventListener("mousemove", this.handlePointerMove);
    this.removeEventListener("mouseleave", this.handlePointerLeave);
    document.removeEventListener("keydown", this.handleKeyDown);
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
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
    } else if (name === "coordinates-font" || name === "coordinates-font-size") {
      this.applyCoordinateStyle();
      return;
    } else if (
      name === "background-image" ||
      name === "coordinates" ||
      name === "coordinates-gap" ||
      name === "padding" ||
      name === "x-start" ||
      name === "x-end" ||
      name === "y-start" ||
      name === "y-end"
    ) {
      this.applyHostSize();
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

  get keyboardShortcutsEnabled(): boolean {
    return (
      !this.hasAttribute("keyboard-shortcuts") || this.getAttribute("keyboard-shortcuts") !== "false"
    );
  }

  /** Current key-to-action bindings for arrow-key SGF navigation. */
  get keyBindings(): Readonly<Record<GoBoardKeyAction, string[]>> {
    return this._keyBindings;
  }

  /**
   * Remaps which keys trigger `nextMove()`/`previousMove()`. Only the
   * actions present in `bindings` are changed; others keep their current
   * binding. Pass a single key or an array of alternatives per action.
   */
  set keyBindings(bindings: GoBoardKeyBindings) {
    const next = normalizeKeyBinding(bindings.next);
    const previous = normalizeKeyBinding(bindings.previous);
    this._keyBindings = {
      next: next ?? this._keyBindings.next,
      previous: previous ?? this._keyBindings.previous,
    };
  }

  private get sizeAttr(): number {
    const value = Number(this.getAttribute("size"));
    return Number.isInteger(value) && value > 1 ? value : 19;
  }

  /** Which sides currently get coordinate labels, per the `coordinates` attribute. */
  private get coordinateSides(): Set<CoordinateSide> {
    if (!this.hasAttribute("coordinates")) return new Set(ALL_COORDINATE_SIDES);
    const value = (this.getAttribute("coordinates") ?? "").trim().toLowerCase();
    if (value === "false") return new Set();
    if (value === "" || value === "true") return new Set(ALL_COORDINATE_SIDES);
    const tokens = value.split(/[\s,]+/).filter(Boolean);
    return new Set(tokens.filter((token): token is CoordinateSide => (ALL_COORDINATE_SIDES as string[]).includes(token)));
  }

  /** Label distance from the grid edge, in board units (see `coordinates-gap`). */
  private get coordinatesGap(): number {
    const attr = this.getAttribute("coordinates-gap");
    if (!attr) return DEFAULT_COORDS_GAP;
    return Math.max(0, this.cssLengthToBoardUnits(attr) ?? DEFAULT_COORDS_GAP);
  }

  /** Coordinate label font size, in board units (see `coordinates-font-size`). */
  private get coordinatesFontSizeUnits(): number {
    const attr = this.getAttribute("coordinates-font-size");
    const fallback = Number(DEFAULT_COORDS_FONT_SIZE);
    if (!attr) return fallback;
    return Math.max(0, this.cssLengthToBoardUnits(attr) ?? fallback);
  }

  /**
   * The blank margin between the host's outer edge and the grid/coordinates,
   * in board units (see `padding`). Never negative — a "negative margin"
   * would push content past the host's own edge, clipping it.
   *
   * Resolved against `DEFAULT_PADDING` rather than itself when converting
   * CSS units — using the not-yet-resolved custom padding to compute the
   * very extent that padding determines would be circular. This makes the
   * conversion ratio a reasonable approximation (based on the default
   * margin) rather than exact when a custom padding is set, which is fine
   * in practice since padding is a coarse, rarely-tuned setting.
   */
  private get padding(): number {
    const attr = this.getAttribute("padding");
    if (!attr) return DEFAULT_PADDING;
    return Math.max(0, this.cssLengthToBoardUnits(attr, DEFAULT_PADDING) ?? DEFAULT_PADDING);
  }

  /** Inclusive vertex range shown along an axis, per `x-start`/`x-end`/`y-start`/`y-end`. */
  private cropRange(startAttr: string, endAttr: string): [number, number] {
    const size = this._board.size;
    const clamp = (attr: string | null, fallback: number): number => {
      if (attr === null || attr === "") return fallback;
      const value = Number(attr);
      if (!Number.isInteger(value)) return fallback;
      return Math.max(0, Math.min(value, size - 1));
    };
    const start = clamp(this.getAttribute(startAttr), 0);
    const end = clamp(this.getAttribute(endAttr), size - 1);
    return start <= end ? [start, end] : [end, start];
  }

  /**
   * Resolves board size, crop range, padding, and coordinate space into the
   * SVG geometry every rendering/hit-testing method needs. Coordinate labels
   * (when shown) get their own reserved space *outside* the grid but
   * *inside* `padding`'s margin — so `padding` is always, literally, the
   * distance from the host's outer edge to the outermost thing drawn
   * (labels if shown, the grid itself otherwise), never eaten into by them.
   */
  private computeLayout(): BoardLayout {
    const size = this._board.size;
    const [xStart, xEnd] = this.cropRange("x-start", "x-end");
    const [yStart, yEnd] = this.cropRange("y-start", "y-end");
    const padding = this.padding;
    const reservation =
      this.coordinateSides.size > 0 ? this.coordinatesGap + this.coordinatesFontSizeUnits : 0;
    const margin = padding + reservation;
    return {
      size,
      xStart,
      xEnd,
      yStart,
      yEnd,
      padding,
      extentX: xEnd - xStart + margin * 2,
      extentY: yEnd - yStart + margin * 2,
      gridOffsetX: margin - xStart,
      gridOffsetY: margin - yStart,
    };
  }

  /**
   * Reflects `coordinates-font`/`coordinates-font-size` onto CSS custom
   * properties on the host, consumed by the shadow stylesheet. Using
   * custom-property substitution (rather than interpolating the raw
   * attribute string into the `<style>` text) means an attacker-controlled
   * value can't break out into new CSS rules — the browser only ever
   * resolves it as a single property value.
   */
  private applyCoordinateStyle(): void {
    const fontFamily = this.getAttribute("coordinates-font") || DEFAULT_COORDS_FONT_FAMILY;
    this.style.setProperty("--go-coords-font-family", fontFamily);

    const fontSizeAttr = this.getAttribute("coordinates-font-size");
    const units = fontSizeAttr
      ? this.cssLengthToBoardUnits(fontSizeAttr)
      : Number(DEFAULT_COORDS_FONT_SIZE);
    if (units === null) return; // not laid out yet; the ResizeObserver's first callback retries
    this.style.setProperty("--go-coords-font-size", `${units}px`);
  }

  /**
   * Converts a real CSS length (as given to `coordinates-font-size` /
   * `coordinates-gap`) into the board's own SVG user-unit space, using the
   * host's current rendered size as the conversion ratio. Returns null if
   * the host hasn't been laid out yet (rect is zero-sized) — callers should
   * keep their previous/default value and rely on the ResizeObserver to
   * call back once real layout is available.
   */
  private cssLengthToBoardUnits(value: string, paddingForExtent: number = this.padding): number | null {
    const rect = this.getBoundingClientRect();
    if (rect.width === 0) return null;
    const pixels = cssLengthToPixels(value);
    const [xStart, xEnd] = this.cropRange("x-start", "x-end");
    const extent = xEnd - xStart + paddingForExtent * 2;
    return pixels * (extent / rect.width);
  }

  /**
   * Reflects the `width`/`height` attributes onto inline host styles. With
   * neither set, defaults to 100% width with the height derived from the
   * board's own aspect ratio (1:1 normally, but non-square once cropped via
   * `x-start`/`x-end`/`y-start`/`y-end`) — computed here rather than left to
   * the static `aspect-ratio: 1/1` stylesheet rule, both because it must
   * track cropping and because a slotted flex child stretches its
   * cross-axis ("auto" width) to fill the container regardless of
   * aspect-ratio. Setting just one of `width`/`height` derives the other to
   * match the board's own aspect ratio at that size.
   */
  private applyHostSize(): void {
    const widthAttr = this.getAttribute("width");
    const heightAttr = this.getAttribute("height");
    const { extentX, extentY } = this.computeLayout();
    if (!widthAttr && !heightAttr) {
      this.style.width = "100%";
      this.style.height = "";
      this.style.aspectRatio = `${extentX} / ${extentY}`;
      return;
    }
    this.style.aspectRatio = "";
    if (widthAttr && heightAttr) {
      this.style.width = cssLength(widthAttr);
      this.style.height = cssLength(heightAttr);
      return;
    }
    const ratio = extentY / extentX;
    if (widthAttr) {
      this.style.width = cssLength(widthAttr);
      this.style.height = `calc(${cssLength(widthAttr)} * ${ratio})`;
    } else {
      this.style.height = cssLength(heightAttr!);
      this.style.width = `calc(${cssLength(heightAttr!)} * ${1 / ratio})`;
    }
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

  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    if (!this.keyboardShortcutsEnabled) return;
    const scope = this.closest("go-board-container") ?? this;
    if (!event.composedPath().includes(scope)) return;

    if (this._keyBindings.next.includes(event.key)) {
      event.preventDefault();
      this.nextMove();
    } else if (this._keyBindings.previous.includes(event.key)) {
      event.preventDefault();
      this.previousMove();
    }
  };

  private readonly handleResize = (): void => {
    this.applyCoordinateStyle();
    this.applyHostSize();
    if (
      this.hasAttribute("coordinates-gap") ||
      this.hasAttribute("padding") ||
      this.hasAttribute("coordinates-font-size")
    ) {
      this.buildSvg();
      this.render();
    }
  };

  private vertexFromEvent(event: MouseEvent): Vertex | null {
    const point = this.svg.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;
    const ctm = this.svg.getScreenCTM();
    if (!ctm) return null;
    const local = point.matrixTransform(ctm.inverse());
    const { xStart, xEnd, yStart, yEnd, gridOffsetX, gridOffsetY } = this.computeLayout();
    const x = Math.round(local.x - gridOffsetX);
    const y = Math.round(local.y - gridOffsetY);
    if (x < xStart || x > xEnd || y < yStart || y > yEnd) return null;
    if (Math.hypot(local.x - gridOffsetX - x, local.y - gridOffsetY - y) > 0.5) return null;
    return { x, y };
  }

  private buildSvg(): void {
    const layout = this.computeLayout();
    const { size, xStart, xEnd, yStart, yEnd, padding, extentX, extentY, gridOffsetX, gridOffsetY } = layout;
    const stars = (STAR_POINTS[size] ?? []).filter(
      ([x, y]) => x >= xStart && x <= xEnd && y >= yStart && y <= yEnd,
    );

    // Capped so the overhang never reaches into a shown coordinate label's
    // space (it sits `gap` out from the grid edge) or past the outer edge
    // when no label's there to clear — otherwise the bleed line gets drawn
    // straight through the label text, or off the visible board entirely.
    const sides = this.coordinateSides;
    const gap = this.coordinatesGap;
    const bleedCap = (labeled: boolean): number => Math.min(CROP_BLEED, labeled ? gap * 0.75 : padding);
    const bleedLeft = xStart > 0 ? bleedCap(sides.has("left")) : 0;
    const bleedRight = xEnd < size - 1 ? bleedCap(sides.has("right")) : 0;
    const bleedTop = yStart > 0 ? bleedCap(sides.has("top")) : 0;
    const bleedBottom = yEnd < size - 1 ? bleedCap(sides.has("bottom")) : 0;

    const gridLines: string[] = [];
    for (let y = yStart; y <= yEnd; y++) {
      const svgY = gridOffsetY + y;
      gridLines.push(
        `<line x1="${gridOffsetX + xStart - bleedLeft}" y1="${svgY}" x2="${gridOffsetX + xEnd + bleedRight}" y2="${svgY}" />`,
      );
    }
    for (let x = xStart; x <= xEnd; x++) {
      const svgX = gridOffsetX + x;
      gridLines.push(
        `<line x1="${svgX}" y1="${gridOffsetY + yStart - bleedTop}" x2="${svgX}" y2="${gridOffsetY + yEnd + bleedBottom}" />`,
      );
    }

    const starMarkup = stars
      .map(
        ([x, y]) => `<circle class="star" cx="${gridOffsetX + x}" cy="${gridOffsetY + y}" r="${STAR_RADIUS}" />`,
      )
      .join("");

    const coordMarkup = this.buildCoordinateMarkup(layout);

    this.shadowRoot!.innerHTML = `
      <style>${STYLES}</style>
      <svg viewBox="0 0 ${extentX} ${extentY}" role="group" aria-label="Go board">
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
        <rect class="board-bg" x="0" y="0" width="${extentX}" height="${extentY}" fill="url(#wood)" />
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
      image.setAttribute("width", String(extentX));
      image.setAttribute("height", String(extentY));
      // "none" (stretch to fill exactly), not "slice" (crop-to-cover):
      // Chromium has a rendering bug where scaling a referenced SVG image
      // via the slice/meet fitting math at a very non-square aspect ratio
      // (e.g. a tall, narrow cropped board) produces a visible seam part
      // way through the image. A plain non-uniform stretch sidesteps that
      // codepath entirely, and for a decorative board texture the (usually
      // slight) distortion is preferable to a hard visual glitch.
      image.setAttribute("preserveAspectRatio", "none");
      image.setAttribute("href", backgroundImage);
      image.setAttribute("class", "board-bg-image");
      this.shadowRoot!.querySelector(".board-bg")!.insertAdjacentElement("afterend", image);
    }
  }

  private buildCoordinateMarkup(layout: BoardLayout): string {
    const sides = this.coordinateSides;
    if (sides.size === 0) return "";

    const { size, xStart, xEnd, yStart, yEnd, gridOffsetX, gridOffsetY } = layout;
    const gap = this.coordinatesGap;
    const topY = gridOffsetY + yStart - gap;
    const bottomY = gridOffsetY + yEnd + gap;
    const leftX = gridOffsetX + xStart - gap;
    const rightX = gridOffsetX + xEnd + gap;

    const labels: string[] = [];
    if (sides.has("top") || sides.has("bottom")) {
      for (let x = xStart; x <= xEnd; x++) {
        const letter = COLUMN_LETTERS[x] ?? "?";
        const svgX = gridOffsetX + x;
        if (sides.has("top")) labels.push(`<text x="${svgX}" y="${topY}">${letter}</text>`);
        if (sides.has("bottom")) labels.push(`<text x="${svgX}" y="${bottomY}">${letter}</text>`);
      }
    }
    if (sides.has("left") || sides.has("right")) {
      for (let y = yStart; y <= yEnd; y++) {
        const label = size - y;
        const svgY = gridOffsetY + y;
        if (sides.has("left")) labels.push(`<text x="${leftX}" y="${svgY}">${label}</text>`);
        if (sides.has("right")) labels.push(`<text x="${rightX}" y="${svgY}">${label}</text>`);
      }
    }
    return `<g class="coordinates">${labels.join("")}</g>`;
  }

  private render(): void {
    if (!this.stonesGroup) return;
    this.stonesGroup.replaceChildren();
    const { xStart, xEnd, yStart, yEnd, gridOffsetX, gridOffsetY } = this.computeLayout();
    for (let y = yStart; y <= yEnd; y++) {
      for (let x = xStart; x <= xEnd; x++) {
        const color = this._board.get(x, y);
        if (color === Color.Empty) continue;
        this.stonesGroup.appendChild(this.createStone(x, y, color, gridOffsetX, gridOffsetY));
      }
    }
    this.updateGhostStone();
  }

  private stoneImageUrl(color: Color): string | null {
    const attr = color === Color.Black ? "black-stone" : "white-stone";
    return this.getAttribute(attr) || null;
  }

  private createStone(x: number, y: number, color: Color, gridOffsetX: number, gridOffsetY: number): SVGElement {
    const imageUrl = this.stoneImageUrl(color);
    if (imageUrl) {
      const image = document.createElementNS(SVG_NS, "image");
      image.setAttribute("x", String(gridOffsetX + x - STONE_RADIUS));
      image.setAttribute("y", String(gridOffsetY + y - STONE_RADIUS));
      image.setAttribute("width", String(STONE_RADIUS * 2));
      image.setAttribute("height", String(STONE_RADIUS * 2));
      image.setAttribute("href", imageUrl);
      image.setAttribute("class", "stone");
      return image;
    }
    const circle = document.createElementNS(SVG_NS, "circle");
    circle.setAttribute("cx", String(gridOffsetX + x));
    circle.setAttribute("cy", String(gridOffsetY + y));
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

    const { gridOffsetX, gridOffsetY } = this.computeLayout();
    this.ghostStone.setAttribute("cx", String(gridOffsetX + vertex.x));
    this.ghostStone.setAttribute("cy", String(gridOffsetY + vertex.y));
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
    font-family: var(--go-coords-font-family, system-ui, sans-serif);
    font-size: var(--go-coords-font-size, 0.32px);
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
