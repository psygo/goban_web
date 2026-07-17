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
- `coordinates-font-size` — label size in board units, i.e. the same
  scale as the grid (1 unit = 1 cell; default `0.32`) — not real CSS
  pixels, since it's set inside the board's own SVG coordinate system
- `coordinates-gap` — label distance from the grid edge, in board units
  (default `0.5`, centered in the fixed 1-unit margin reserved for
  labels; values much above ~1 will render outside the visible board)
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
  the default wood gradient.
- `keyboard-shortcuts` — set to `"false"` to disable arrow-key SGF
  navigation (see "Keyboard navigation" below).

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

Displays the loaded SGF's root-node game info: players, ranks, komi,
result, date, event (`PW`/`PB`/`WR`/`BR`/`KM`/`RE`/`DT`/`GN`). Shows
"No game loaded." until its `<go-board>` fires `sgf-loaded`. Read-only
— never calls back into the board.

Attributes: `board` (optional, see "Component architecture" above).

## `<go-board-controls>`

Drives its `<go-board>`'s navigation API (`nextMove`/`previousMove`/
`goToMove`) and play-all auto-advance (a 120ms interval until the main
line ends). It ships a default Previous/Next/Play all/Restart button
UI, but it's a **wrapper**, not a fixed widget: place your own markup
inside it and that replaces the default UI entirely — this uses native
`<slot>` fallback-content semantics (the default buttons are the
`<slot>`'s fallback content, which stops rendering the moment the slot
has any assigned children), so there's no configuration flag to
toggle, just put elements inside it.

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

`index.html` has a full worked example: icon-button first/back-10/
previous/play-all/next/forward-10/last controls (SVG chevrons, no
text), styled entirely in the page's own `<style>` block — none of
that layout or theming lives in the library. Minimal version:

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

Attributes: `board` (optional, see "Component architecture" above).

## `Board` (rules engine)

`src/core/board.ts` — framework-free game-state engine consumed by
`<go-board>`, usable standalone (e.g. for server-side legality checks
or headless play).

- `new Board(size = 19)`
- `board.get(x, y)` → `Color`
- `board.play(x, y)` → `MoveResult` (`{ legal: true, vertex, color, captured }`
  or `{ legal: false, reason }`, `reason` one of `occupied`, `suicide`,
  `ko`, `out-of-bounds`, `game-over`)
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
coordinates (sides/font/font-size/gap), the container/metadata/controls
component split, configurable-binding keyboard navigation, and a fully
overridable `<go-board-controls>` (tag your own markup with
`data-go-action`/`data-go-counter`; first/back-10/previous/next/
forward-10/last/play-all/restart actions available).

Not yet implemented: scoring (territory counting), positional superko,
handicap stones, SGF variation navigation/export, undo for
interactively-played (non-SGF) moves, themed hover-preview stone.
