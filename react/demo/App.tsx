import { useCallback, useRef, useState } from "react";
import {
  Color,
  GoBoard,
  GoBoardContainer,
  GoBoardControls,
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
        onMove={handleMove}
        onIllegalMove={handleIllegalMove}
        onPass={handlePass}
      />
      <div className="controls">
        <button onClick={handlePassClick} disabled={gameOver}>
          Pass
        </button>
        <button onClick={handleReset}>Reset</button>
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
  return (
    <section>
      <h2>Replay</h2>
      <GoBoardContainer>
        <GoMetadataContainer />
        <GoBoard sgf="/assets/ing_cup_rules_2.sgf" width={480} height={480} interactive={false} />
        <GoBoardControls />
      </GoBoardContainer>
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
