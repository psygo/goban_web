# Documentation

`<go-board>` is a dependency-free custom element (TypeScript + vanilla
Custom Elements + SVG) with a self-contained rules engine: stone
placement, group captures, suicide prevention, and the simple ko rule.

## Usage

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

## Development

```sh
npm install
npm run dev      # dev server with a demo page at index.html
npm test         # run the rules-engine unit tests (Vitest)
npm run build    # type-check + build the library to dist/
```

## Status

Implemented: board rendering, stone placement, captures, suicide
prevention, simple ko, passing/game-end detection.

Not yet implemented: scoring (territory counting), positional superko,
handicap stones, SGF import/export, undo.
