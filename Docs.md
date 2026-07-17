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
- `coordinates` — set to `"false"` to hide the A–T / 1–N labels
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

Previous / Next / Play all / Restart buttons plus a "Move X / Y"
counter, driving its `<go-board>`'s navigation API
(`nextMove`/`previousMove`/`goToMove`). "Play all" steps forward on a
120ms interval until the main line ends. All buttons are disabled when
no `sgf` is loaded (`moveCount === 0`).

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
image theming, configurable board size (`width`/`height`), the
container/metadata/controls component split.

Not yet implemented: scoring (territory counting), positional superko,
handicap stones, SGF variation navigation/export, undo for
interactively-played (non-SGF) moves, themed hover-preview stone.
