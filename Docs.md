# Documentation

## `<go-board>`

A dependency-free custom element (TypeScript + vanilla Custom Elements

- SVG) with a self-contained rules engine: stone placement, group
  captures, suicide prevention, and the simple ko rule.

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

- `size` — board size, e.g. `9`, `13`, `19` (default `19`)
- `coordinates` — set to `"false"` to hide the A–T / 1–N labels
- `interactive` — set to `"false"` to disable clicking/hover

### Properties & methods

- `board.board` — the underlying `Board` rules-engine instance (read-only)
- `board.play(x, y)` — play a move for the current color; returns `true`/`false`
- `board.pass()` — pass the current player's turn
- `board.reset(size?)` — clear the board, optionally resizing

### Events

- `move` — `detail: { x, y, color, captured }`
- `illegal-move` — `detail: { x, y, reason }`
- `pass`

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
generic escaping.

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

Not yet implemented: applying a parsed tree to a `Board` (move replay),
SGF serialization/writing, and property-specific typed accessors
(e.g. reading `SZ`/`KM`/`RE` as typed values rather than raw strings).

## Development

```sh
npm install
npm run dev      # dev server with a demo page at index.html
npm test         # run unit tests (Vitest)
npm run build    # type-check + build the library and demo to dist/ and dist-demo/
npm run preview  # serve the built demo from dist-demo/
```

The demo page (`index.html` / `src/main.ts`) loads `assets/*.sgf` via
Vite's `?raw` import, parses it with `parseSGF`, shows the root node's
game info (players, ranks, komi, result, date, event), and steps
through the main line with "Next move" / "Play all" / "Restart"
controls — a working example of the SGF parser driving `<go-board>`.

## Status

Implemented: board rendering, stone placement, captures, suicide
prevention, simple ko, passing/game-end detection, SGF parsing.

Not yet implemented: scoring (territory counting), positional superko,
handicap stones, SGF move replay/export, undo.
