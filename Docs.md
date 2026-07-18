# Documentation

## Component architecture

The board is composed from four custom elements, meant to be used
together but each independently usable:

```html
<go-board-container>
  <go-metadata-container></go-metadata-container>
  <go-board-controls></go-board-controls>
  <go-board
    sgf="/assets/game.sgf"
    black-stone="/assets/black-stone.svg"
    white-stone="/assets/white-stone.svg"
  ></go-board>
</go-board-container>
```

- `<go-board>` — owns all state: the rules engine, SGF loading/parsing,
  and move navigation. It's the only component with real logic.
- `<go-board-container>` — a pure layout wrapper (flex column via a
  `<slot>`). Carries no behavior or state of its own.
- `<go-metadata-container>` / `<go-board-controls>` — read-only /
  command-only peripherals. Each locates its `<go-board>` on connect
  (an explicit `board="<id>"` attribute, or the nearest `go-board`
  inside the closest `go-board-container` ancestor, falling back to the
  first `go-board` in the document) and talks to it exclusively through
  its public API and events — never through the container.

This means `<go-board>` is fully usable standalone (as in the earlier
single-element usage below), and the peripherals can be swapped out or
reimplemented without touching board internals.

## `<go-board>`

A dependency-free custom element (TypeScript + vanilla Custom Elements +
SVG) with a self-contained rules engine: stone placement, group
captures, suicide prevention, and the simple ko rule. Optionally loads
and steps through an SGF game record.

### Usage

```html
<script type="module" src="./dist/goban-web.js"></script>

<go-board size="19"></go-board>

<script type="module">
  const board = document.querySelector("go-board")
  board.addEventListener("move", (e) => console.log(e.detail))
</script>
```

### Attributes

- `size` — board size, e.g. `9`, `13`, `19` (default `19`); ignored
  once an `sgf` loads (its `SZ` property wins)
- `coordinates` — which sides get labels: unset/`"true"` (all four,
  default), `"false"` (none), or a space/comma-separated list of
  `top`/`bottom`/`left`/`right`, e.g. `coordinates="top left"`
- `coordinates-font` — CSS font-family for the labels
  (default `"system-ui, sans-serif"`)
- `coordinates-font-size` — a real CSS length (bare numbers are px, e.g.
  `"10"` or `"10pt"`; default is about `0.32` of a grid cell). Since
  the labels live inside the board's own SVG coordinate space, the
  component converts this to that internal unit using the board's
  current rendered pixel size, and re-derives it via a `ResizeObserver`
  whenever that size changes — so a given CSS length stays visually
  the same size as the board itself resizes (e.g. on a responsive
  `width="100%"` board).
- `coordinates-gap` — a real CSS length for label distance from the
  grid edge, converted the same way (default centers labels in the
  fixed 1-unit margin reserved for them; very large values will render
  labels outside the visible board)
- `padding` — a real CSS length for the blank margin between the
  host's outer edge and the grid/coordinates, converted the same way
  as the two attributes above. Coordinate labels (when shown) get
  their own reserved space automatically — `padding` is always *in
  addition* to that, never eaten into by it, so it's literally the
  distance from the edge to whatever's drawn outermost (labels if
  shown, the grid otherwise). Small default (`padding` is a thin extra
  buffer on top of the coordinate space, not the only thing providing
  margin).
- `x-start` / `x-end` / `y-start` / `y-end` — crop the rendered board
  to a sub-rectangle of vertices (inclusive, 0-indexed, same
  coordinate space as `move`'s `detail.x`/`detail.y`; out-of-range or
  non-integer values clamp, an inverted start/end swaps). Defaults to
  the full board. Useful for showing just a corner or side of a larger
  board (e.g. a joseki/tsumego diagram). Edges that get cut off (don't
  reach the true board edge) render their grid lines with a short
  overhang past the last visible intersection, signaling the board
  continues past what's shown; coordinate labels are limited to the
  visible range. The overhang is capped so it never reaches into a
  shown coordinate label's space (it stops short of the label instead
  of drawing through it). This only changes what's drawn and clickable
  — the rules engine and a loaded `sgf` still operate on the full board
  size. A non-square crop gives the board a non-square aspect ratio
  (when `width`/`height` aren't both set, the host's own aspect ratio
  follows automatically).
- `interactive` — set to `"false"` to disable clicking/hover
- `sgf` — a URL to fetch and parse; on success, resets the board to the
  SGF's root position (move 0) and enables the navigation API below
- `black-stone` / `white-stone` — image URL to render stones with,
  replacing the default gradient circles for that color. Empty/unset
  falls back to the default rendering. (The hover-preview ghost stone
  always uses the default look regardless of these attributes.)
- `width` / `height` — CSS length for the rendered size (bare numbers
  are treated as px, e.g. `width="480"`). Unset defaults to 100% width
  with a 1:1 aspect ratio (the previous, only, behavior); setting just
  one of the two renders a square board at that size; setting both
  renders that exact box (the SVG content still stays square-celled,
  letterboxed within it).
- `background-image` — image URL to render behind the grid, replacing
  the default wood gradient. Stretched to exactly fill the board's own
  box (not cropped-to-cover) — deliberate, since crop-to-cover of a
  referenced SVG image triggers a Chromium rendering bug (a visible
  seam) at the very non-square aspect ratios a cropped board can have.
- `keyboard-shortcuts` — set to `"false"` to disable arrow-key SGF
  navigation (see "Keyboard navigation" below).

### SGF setup stones and markup

Beyond `B`/`W` moves, a loaded `sgf` also understands:

- `AB` / `AW` / `AE` (add-black / add-white / add-empty) — setup
  stones, placed or removed directly (no capture/suicide/ko rules,
  since they're not gameplay — see `Board.set`) rather than played.
  Common on the *root* node for handicap games or "diagram" SGFs that
  are nothing but a setup position with no moves at all (a single-node
  tree, `AB`/`AW` and nothing else) — these are fully supported; the
  root's setup is applied before move 0 rather than silently ignored.
  Like moves, setup stones accumulate as you navigate forward and are
  rebuilt from scratch (root included) on every `goToMove`/`nextMove`/
  `previousMove` call, so they stay correct at any position.
- `LB` (text labels, e.g. `LB[pd:A]` or `LB[pd:12]` — any text, not
  just single letters) and the point-shape markup properties `TR`
  (triangle), `SQ` (square), `CR` (circle), `MA` (cross) are drawn as
  an overlay on top of the grid/stones at their point. Unlike setup
  stones, these are read fresh from *only* the current node
  (`sgfTree.nodes[moveIndex]`) on every render — not accumulated —
  since they conventionally annotate one specific position rather than
  persisting as the game continues; they disappear on the next move
  unless that node repeats them. Mark color automatically contrasts
  with whatever's underneath (light on a black stone, dark on a white
  stone or empty point). Respects `x-start`/`x-end`/`y-start`/`y-end`
  cropping like everything else.

### Properties & methods

- `board.board` — the underlying `Board` rules-engine instance (read-only)
- `board.play(x, y)` — play a move for the current color; returns `true`/`false`
- `board.pass()` — pass the current player's turn
- `board.reset(size?)` — clear the board, optionally resizing (does not
  affect a loaded `sgf`; the next `goToMove`/`nextMove` call rebuilds
  from the SGF root again)
- `board.sgfTree` — the parsed `SGFGameTree` loaded via `sgf`, or `null`
- `board.moveIndex` / `board.moveCount` — current position / total
  moves in the SGF's main line (`0` when no `sgf` is loaded)
- `board.nextMove()` / `board.previousMove()` — step through the SGF
  main line by one move; return `false` at either end
- `board.goToMove(index)` — jump to an arbitrary position (clamped to
  `[0, moveCount]`); implemented by replaying from the root each call,
  which is how "previous" works without a separate undo mechanism
- `board.keyBindings` — get/set the key-to-action map (see below)

### Keyboard navigation

With an `sgf` loaded, ArrowRight/ArrowLeft call `nextMove()`/
`previousMove()` whenever focus is anywhere inside the nearest
`go-board-container` ancestor of the `<go-board>` — or inside the
`<go-board>` itself, if it isn't wrapped in a container. This is a
live focus check on every keydown (via `event.composedPath()`), not a
one-time binding, so it keeps working if focus moves between the
board, `<go-board-controls>` buttons, or any other element you add
inside the container.

Remap the keys with the `keyBindings` property (a plain object, not an
attribute — there's no declarative form):

```js
const board = document.querySelector("go-board")
board.keyBindings = { next: "j", previous: "k" }        // replace
board.keyBindings = { next: ["ArrowRight", "l"] }        // multiple keys, one action
// `previous` above keeps its current binding — the setter only
// touches the actions you mention, so partial remaps don't clobber
// the rest.
```

Set `keyboard-shortcuts="false"` on `<go-board>` to disable this
entirely.

### Events

- `move` — `detail: { x, y, color, captured }`
- `illegal-move` — `detail: { x, y, reason }`
- `pass`
- `sgf-loaded` — `detail: { tree }`, fired after a `sgf` URL is
  fetched and parsed successfully
- `sgf-error` — `detail: { error }`, fired when fetching/parsing a
  `sgf` URL fails (also logged via `console.error`)
- `navigate` — `detail: { moveIndex, moveCount }`, fired whenever
  `nextMove`/`previousMove`/`goToMove` change the position

## `<go-board-container>`

Pure layout — a `<slot>` inside a flex-column `:host`. No JavaScript
behavior beyond that. Not required; `<go-board>` and the peripherals
below work without it, just with a less convenient "nearest board in
the document" fallback for discovery.

## `<go-metadata-container>`

Displays the loaded SGF's game info as two stacked containers: a
players row (a black-player panel and a white-player panel side by
side — same background for both, told apart by their stone-color
indicator, no "vs" divider needed — with name+rank on one line,
`PB`/`BR` and `PW`/`WR`) and, right below it, its own separate card for
the rest of the data: a meta line with komi/date/event (`KM`/`DT`/`GN`)
each on their own line, the game result (`RE`) — hidden by default
behind a **"Show result"** toggle button (click again to hide it), so
replaying an SGF move by move doesn't spoil the outcome unless you ask
for it — and, only when present, the **current move's comment** (`C`
property of the node at `board.moveIndex`), updating live as you
navigate.

Shows "No game loaded." until its `<go-board>` fires `sgf-loaded`.
Read-only — never calls back into the board. The result's reveal state
resets (hides again) whenever a *new* game loads, but is left alone
across move navigation, since it's a property of the game, not the
position. Colors adapt to `prefers-color-scheme: light` automatically
(no attribute needed) — see "Theming" below.

Like `<go-board-controls>`, it's a **wrapper**, not a fixed widget:
place your own markup inside it (native `<slot>` fallback-content
semantics mean any light-DOM children you add replace the default UI
entirely) and tag elements so this element knows what they're for:

- `data-go-field="black-name" | "black-rank" | "white-name" |
  "white-rank" | "komi" | "date" | "event" | "result" |
  "result-toggle-label" | "comment"` on any element fills its text with
  that piece of data, kept live as the board navigates or a new game
  loads. `result` stays empty text until revealed; everything else is
  always filled in (empty string if the SGF doesn't have it).
- `data-go-action="toggle-result"` on any clickable element toggles the
  result's reveal state; tagged elements get `data-go-revealed` toggled
  to reflect it, for custom styling.

For a fully custom design that isn't just restyling tagged elements
(canvas, a different framework, anything reading the data directly),
use the `gameInfo` property instead — same data, same update schedule,
also fired as a `metadata-changed` event (`detail: GoGameInfo | null`)
for code that only holds a reference to this element rather than the
`<go-board>` itself.

Minimal custom-markup example:

```html
<go-metadata-container>
  <div class="my-metadata">
    <strong data-go-field="black-name"></strong>
    <span data-go-field="black-rank"></span>
    vs
    <strong data-go-field="white-name"></strong>
    <span data-go-field="white-rank"></span>
    <div>Komi: <span data-go-field="komi"></span></div>
    <button data-go-action="toggle-result" data-go-field="result-toggle-label"></button>
    <span data-go-field="result"></span>
  </div>
</go-metadata-container>
```

Listens to `sgf-loaded`, `sgf-error`, and `navigate` on its `<go-board>`
(the last one is what drives the live comment).

Properties:

- `gameInfo: GoGameInfo | null` — `{ black: { name, rank? }, white: {
  name, rank? }, komi?, date?, event?, result?, comment? }`, or `null`
  when no game is loaded

Attributes:

- `board` (optional, see "Component architecture" above)
- `details` — set to `"false"` to hide the second card (meta line,
  result, comment) entirely, showing just the players row. Only
  affects the *default* UI — for custom markup, simply don't include
  those `data-go-field` elements.

Events:

- `metadata-changed` — `detail: GoGameInfo | null`, fired whenever the
  displayed data changes (new game, navigation, or a result reveal)

## `<go-board-controls>`

Drives its `<go-board>`'s navigation API (`nextMove`/`previousMove`/
`goToMove`) and play-all auto-advance (a 120ms interval until the main
line ends). It ships a default icon-button UI (first/back-10/previous/
play-all/next/forward-10/last), laid out as a 3-column row — the
buttons stay centered as a group regardless of the container's width,
and a move counter (just `"{index} / {count}"`, no "Move" prefix) is
pinned to the right edge; its colors adapt to `prefers-color-scheme:
light` automatically (see "Theming" below) — but it's a **wrapper**,
not a fixed widget: place your own markup inside it and that replaces
the default UI entirely — this uses native `<slot>` fallback-content
semantics (the default buttons are the `<slot>`'s fallback content,
which stops rendering the moment the slot has any assigned children),
so there's no configuration flag to toggle, just put elements inside
it.

Tag your elements so `<go-board-controls>` knows what they're for:

- `data-go-action="first" | "back-10" | "previous" | "next" |
  "forward-10" | "last" | "play-all" | "restart"` on any clickable
  element (or an ancestor of one — it checks `event.composedPath()`)
  wires it to that action. `back-10`/`forward-10` jump 10 moves via
  `goToMove`; `first`/`last` jump to the start/end; any action other
  than `play-all` stops auto-play first if it's running.
- `data-go-counter` on any element fills its text with the move
  position. Give the attribute a value with `{index}`/`{count}`
  placeholders for a custom format (e.g.
  `data-go-counter="{index} of {count}"`); an empty/bare attribute
  defaults to `"Move {index} / {count}"`.

Tagged action elements get `data-go-disabled` toggled when their
action is currently unavailable (style or hide via that attribute
selector — arbitrary elements, not just `<button>`, can be tagged, so
this doesn't rely on the native `disabled` property, though that's
also set when the element supports it). The `play-all` element
additionally gets `data-go-playing` toggled while auto-play is
running, for custom markup to react to (CSS, or your own
`MutationObserver`).

Minimal example:

```html
<go-board-controls>
  <div class="my-controls">
    <button data-go-action="previous">⏮</button>
    <button data-go-action="next">⏭</button>
    <button data-go-action="play-all">▶</button>
    <span data-go-counter="{index} / {count}"></span>
  </div>
</go-board-controls>
<style>
  .my-controls button[data-go-disabled] { opacity: 0.3; }
  .my-controls button[data-go-playing] { color: red; }
</style>
```

This is, in fact, exactly the default UI's own markup (SVG chevrons,
no text) — reproduced here as a starting point if you want to
customize it (e.g. restyle, add a Restart button, or drop an action):

```html
<go-board-controls>
  <div class="nav-controls">
    <div class="nav-buttons">
      <button data-go-action="first" title="First move" aria-label="First move">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <line x1="6" y1="5" x2="6" y2="19" />
          <polyline points="18 6 10 12 18 18" />
        </svg>
      </button>
      <button data-go-action="back-10" title="Back 10 moves" aria-label="Back 10 moves">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="18 6 12 12 18 18" />
          <polyline points="11 6 5 12 11 18" />
        </svg>
      </button>
      <button data-go-action="previous" title="Previous move" aria-label="Previous move">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="15 6 9 12 15 18" />
        </svg>
      </button>
      <button data-go-action="play-all" title="Play all" aria-label="Play all">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" stroke="none">
          <polygon points="6 4 20 12 6 20" />
        </svg>
      </button>
      <button data-go-action="next" title="Next move" aria-label="Next move">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="9 6 15 12 9 18" />
        </svg>
      </button>
      <button data-go-action="forward-10" title="Forward 10 moves" aria-label="Forward 10 moves">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="6 6 12 12 6 18" />
          <polyline points="13 6 19 12 13 18" />
        </svg>
      </button>
      <button data-go-action="last" title="Last move" aria-label="Last move">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="5" x2="18" y2="19" />
          <polyline points="6 6 14 12 6 18" />
        </svg>
      </button>
    </div>
    <span class="nav-counter" data-go-counter="{index} / {count}"></span>
  </div>
</go-board-controls>
<style>
  /* 3-column grid: an empty spacer column balances the counter's width on
     the other side, so the button group truly centers in the full row. */
  .nav-controls { display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 0.375rem; }
  .nav-buttons { grid-column: 2; display: flex; align-items: center; gap: 0.375rem; }
  .nav-controls button {
    display: inline-flex; align-items: center; justify-content: center;
    width: 2.25rem; height: 2.25rem; padding: 0; border: none;
    border-radius: 999px; background: #3a3a3a; color: #eee; cursor: pointer;
  }
  .nav-controls button:hover:not([data-go-disabled]) { background: #4a4a4a; }
  .nav-controls button[data-go-disabled] { opacity: 0.3; cursor: default; }
  .nav-controls button[data-go-action="play-all"][data-go-playing] { background: #7a3a3a; }
  .nav-counter { grid-column: 3; justify-self: end; font-variant-numeric: tabular-nums; color: #bbb; font-size: 0.85rem; }
</style>
```

Attributes:

- `board` (optional, see "Component architecture" above)
- `counter` — set to `"false"` to omit the move counter from the
  *default* UI (buttons stay centered either way, since the layout
  reserves that space regardless). No effect once you've replaced the
  default with your own markup — just don't tag anything
  `data-go-counter` there.

## Theming

`<go-metadata-container>` and `<go-board-controls>` follow the
viewer's OS/browser color scheme automatically via a
`prefers-color-scheme: light` media query internally — no attribute or
setup needed, and no JavaScript is involved by default. `<go-board>`
itself doesn't need a light/dark variant: its wood-toned palette and
dark grid lines already read fine against either a light or dark page
background.

Each component exposes its colors as internal CSS custom properties
(dark values as the default, overridden under `prefers-color-scheme:
light`), and each of those is itself written as `var(--goban-x,
internal-value)` — so setting a `--goban-*` property anywhere *outside*
the component (e.g. on `:root`) overrides its value, since custom
properties inherit through shadow DOM boundaries. This is what makes a
manual, JS-driven theme toggle possible: `prefers-color-scheme` alone
reflects the OS/browser setting and can't be flipped from page script,
but a page can force a theme by setting the full `--goban-*` layer on
`:root[data-theme="dark"]` / `:root[data-theme="light"]` and toggling
that attribute — exactly what the demo's top-right sun/moon button
does (see `index.html`; it also persists the choice to
`localStorage`). No `data-theme` attribute means "follow the OS", same
as the zero-setup default.

The shared `--goban-*` property names (set them on `:root`, or on the
component itself for a narrower override): `--goban-text`,
`--goban-text-secondary`, `--goban-text-muted`, `--goban-comment`,
`--goban-panel-bg` (shared by both player panels — see below),
`--goban-panel-border`, `--goban-panel-shadow`, `--goban-card-bg`, `--goban-card-border`,
`--goban-card-shadow`, `--goban-toggle-bg`, `--goban-toggle-bg-hover`,
`--goban-toggle-border` (all `<go-metadata-container>`), and
`--goban-btn-bg`, `--goban-btn-bg-hover`, `--goban-btn-color`,
`--goban-btn-playing-bg`, `--goban-counter` (all `<go-board-controls>`).

## `Board` (rules engine)

`src/core/board.ts` — framework-free game-state engine consumed by
`<go-board>`, usable standalone (e.g. for server-side legality checks
or headless play).

- `new Board(size = 19)`
- `board.get(x, y)` → `Color`
- `board.play(x, y)` → `MoveResult` (`{ legal: true, vertex, color, captured }`
  or `{ legal: false, reason }`, `reason` one of `occupied`, `suicide`,
  `ko`, `out-of-bounds`, `game-over`)
- `board.set(x, y, color)` — directly sets a point, bypassing capture/
  suicide/ko rules and turn order entirely. For SGF setup properties
  (`AB`/`AW`/`AE`) or board-editing tools, not gameplay — use `play()`
  for that.
- `board.isLegalMove(x, y, color?)` → `boolean`
- `board.pass()`, `board.isOver`, `board.currentColor`, `board.captures`,
  `board.koPoint`, `board.clone()`

## SGF parser

`src/core/sgf.ts` — a standards-based SGF (Smart Game Format) parser.
Parses a collection of game trees with arbitrary variations into a
plain data structure; does not interpret property semantics beyond
generic escaping. This is what `<go-board>`'s `sgf` attribute uses
internally, and is also exported for standalone use.

```ts
import { parseSGF, sgfPointToVertex, isSGFPass } from "goban-web"

const [tree] = parseSGF("(;FF[4]GM[1]SZ[19];B[pd];W[dp])")
tree.nodes[0].properties.SZ // ["19"]
tree.nodes[1].properties.B // ["pd"]

sgfPointToVertex("pd") // { x: 15, y: 3 }
isSGFPass("", 19) // true
```

- `parseSGF(input: string): SGFGameTree[]` — parses an SGF collection.
  Throws `SGFParseError` (with a `position` field) on malformed input.
- `SGFGameTree = { nodes: SGFNode[], children: SGFGameTree[] }` —
  `children` holds variations branching off the end of `nodes`.
  `<go-board>` only ever plays through `nodes` (the main line); it does
  not yet support navigating into `children` variations.
- `SGFNode = { properties: Record<string, string[]> }` — property IDs
  are normalized to uppercase; each property keeps its raw list of
  values, unescaped per the SGF text-value escaping rules (backslash
  escapes the next character; a backslash directly before a line break
  is a soft break and is removed).
- `sgfPointToVertex(value: string): Vertex | null` — converts a
  two-letter SGF point/move value (e.g. `"pd"`) to zero-indexed board
  coordinates; `null` if the value isn't a two-letter point.
- `isSGFPass(value: string, boardSize: number): boolean` — true for an
  empty value (FF[4] pass), or `"tt"` on boards up to 19×19 (FF[3] pass).
- `sgfPointsForProperty(node: SGFNode, id: string): Vertex[]` —
  converts every value of a point-list property (e.g. `AB`/`AW`/`AE`,
  or the point-shape markup properties `TR`/`SQ`/`CR`/`MA`) to
  vertices, skipping any value that isn't a valid point. `[]` if the
  node doesn't have that property.
- `parseSGFLabel(value: string): { vertex: Vertex, text: string } | null`
  — splits a single `LB` value (`"pd:A"`) into its point and label
  text (split on the *first* colon, so the text itself may contain
  one); `null` if there's no colon or the point half isn't valid.

Not yet implemented: variation navigation, SGF serialization/writing,
and property-specific typed accessors (e.g. reading `SZ`/`KM`/`RE` as
typed values rather than raw strings).

## Development

```sh
npm install
npm run dev      # dev server with a demo page at index.html
npm test         # run unit tests (Vitest)
npm run build    # type-check + build the library and demo to dist/ and dist-demo/
npm run preview  # serve the built demo from dist-demo/
```

Static files referenced at runtime (via `fetch`, e.g. the `sgf`,
`black-stone`, `white-stone`, `background-image` attributes) must live
under `public/` — Vite copies that directory as-is to the build output
root and serves it unprocessed in dev. The demo's sample game, stone
images, and board background live in `public/assets/`.

## Status

Implemented: board rendering, stone placement, captures, suicide
prevention, simple ko, passing/game-end detection, SGF parsing,
SGF loading/navigation via `<go-board>`, custom stone and board-background
image theming, configurable board size (`width`/`height`), configurable
board padding, configurable coordinates (sides/font/font-size/gap),
partial/cropped board rendering (`x-start`/`x-end`/`y-start`/`y-end`,
with a bleed effect on cut edges), the container/metadata/controls
component split, configurable-binding keyboard navigation, a fully
overridable `<go-board-controls>` with a default icon-button UI,
centered as a group with a right-pinned, optional (`counter="false"`)
move counter (tag your own markup with `data-go-action`/`data-go-counter`;
first/back-10/previous/next/forward-10/last/play-all/restart actions
available), and a fully overridable `<go-metadata-container>` (same
`<slot>`-wrapper pattern, tag your own markup with
`data-go-field`/`data-go-action="toggle-result"`, or read the
`gameInfo` property / `metadata-changed` event for a fully custom,
non-DOM-restyling design) with same-background black/white player
panels, a toggleable (`details="false"`) info card, a spoiler-hidden
result, and live per-move comments — plus automatic light/dark theming
(`prefers-color-scheme`) for both peripheral components, with a
`--goban-*` CSS custom property layer that lets a page force a theme
regardless of OS preference (see "Theming"; the demo's title-row
sun/moon button does exactly this). Also implemented: SGF setup stones
(`AB`/`AW`/`AE`, including root-node-only "diagram" SGFs with no
moves at all — e.g. handicap/problem positions) and markup (`LB` text
labels, `TR`/`SQ`/`CR`/`MA` point shapes), rendered as an overlay
scoped to the current node.

Not yet implemented: scoring (territory counting), positional superko,
SGF variation navigation/export, undo for interactively-played
(non-SGF) moves, themed hover-preview stone.
