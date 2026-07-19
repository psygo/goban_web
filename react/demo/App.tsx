import { useCallback, useRef, useState } from "react";
import {
  Color,
  GoBoard,
  GoBoardContainer,
  GoBoardControls,
  GobanWrapper,
  GoMetadataContainer,
  oppositeColor,
} from "../src/index";
import type { GoBoardElement, IllegalMoveEventDetail, MoveEventDetail } from "../src/index";
import "./App.css";

const LETTERS = "ABCDEFGHJKLMNOPQRST";
const pointLabel = (x: number, y: number, size: number) => `${LETTERS[x]}${size - y}`;
const colorName = (color: Color) => (color === Color.Black ? "Black" : "White");

function PlayDemo() {
  const boardRef = useRef<GoBoardElement>(null);
  const [turn, setTurn] = useState(Color.Black);
  const [gameOver, setGameOver] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const [moveNumbers, setMoveNumbers] = useState(false);

  const syncTurn = useCallback(() => {
    const board = boardRef.current;
    if (!board) return;
    setTurn(board.board.currentColor);
  }, []);

  const handleMove = useCallback((detail: MoveEventDetail) => {
    setGameOver(false);
    setLog((prev) => [...prev, `${colorName(detail.color)} ${pointLabel(detail.x, detail.y, 19)}`]);
    syncTurn();
  }, [syncTurn]);

  const handleIllegalMove = useCallback((detail: IllegalMoveEventDetail) => {
    setLog((prev) => [...prev, `Illegal (${detail.reason}) at ${pointLabel(detail.x, detail.y, 19)}`]);
  }, []);

  const handlePass = useCallback(() => {
    setLog((prev) => {
      const last = prev[prev.length - 1];
      if (last?.startsWith(`${colorName(turn)} pass`)) {
        setGameOver(true);
        return [...prev, `${colorName(oppositeColor(turn))} pass — game over`];
      }
      return [...prev, `${colorName(turn)} pass`];
    });
    syncTurn();
  }, [turn, syncTurn]);

  const handlePassClick = () => {
    boardRef.current?.pass();
  };

  const handleReset = () => {
    boardRef.current?.reset();
    setTurn(Color.Black);
    setGameOver(false);
    setLog([]);
  };

  return (
    <section>
      <h2>Play</h2>
      <p className="status">{gameOver ? "Game over" : `${colorName(turn)} to move`}</p>
      <GoBoard
        ref={boardRef}
        size={19}
        width={480}
        height={480}
        moveNumbers={moveNumbers}
        onMove={handleMove}
        onIllegalMove={handleIllegalMove}
        onPass={handlePass}
      />
      <div className="controls">
        <button onClick={handlePassClick} disabled={gameOver}>
          Pass
        </button>
        <button onClick={handleReset}>Reset</button>
        <label className="checkbox">
          <input
            type="checkbox"
            checked={moveNumbers}
            onChange={(event) => setMoveNumbers(event.target.checked)}
          />
          Move numbers
        </label>
      </div>
      <div className="log">
        <h3>Move log</h3>
        {log.length === 0 ? (
          <p className="log-empty">No moves yet — click the board to play.</p>
        ) : (
          <ol>
            {log.map((entry, index) => (
              <li key={index}>{entry}</li>
            ))}
          </ol>
        )}
      </div>
    </section>
  );
}

function ReplayDemo() {
  // GoMetadataContainer and GoBoardControls need no `board` prop here —
  // both locate the nearest <go-board> inside their closest
  // <GoBoardContainer> automatically (see resolveBoard() in goban-web).
  //
  // GobanWrapper's `colorScheme` forces light/dark on those two
  // peripherals regardless of the OS setting — undefined (the initial
  // state here) means "follow prefers-color-scheme", same as omitting
  // GobanWrapper entirely.
  const [colorScheme, setColorScheme] = useState<"light" | "dark" | undefined>(undefined);

  // A background matching whatever GobanWrapper is currently forcing —
  // this page itself always stays light, so without this the dark-scheme
  // text would render illegibly on a still-white page. Real pages using
  // GobanWrapper for a JS theme toggle would already have their own
  // matching light/dark background (as goban-web's own index.html demo
  // does), this is just standing in for that here.
  const panelBackground = colorScheme === "dark" ? "#2b2b2b" : colorScheme === "light" ? "#fafafa" : "transparent";

  return (
    <section>
      <h2>Replay</h2>
      <div className="controls">
        <button onClick={() => setColorScheme(colorScheme === "dark" ? "light" : "dark")}>
          Toggle theme ({colorScheme ?? "auto"})
        </button>
      </div>
      <div className="replay-panel" style={{ background: panelBackground }}>
        <GobanWrapper colorScheme={colorScheme}>
          <GoBoardContainer>
            <GoMetadataContainer />
            <GoBoard sgf="/assets/ing_cup_rules_2.sgf" width={480} height={480} interactive={false} />
            <GoBoardControls />
          </GoBoardContainer>
        </GobanWrapper>
      </div>
    </section>
  );
}

export default function App() {
  return (
    <main>
      <h1>goban-web-react demo</h1>
      <PlayDemo />
      <ReplayDemo />
    </main>
  );
}
