import "./index";
import { Color, isSGFPass, parseSGF, sgfPointToVertex } from "./index";
import type { GoBoardElement, MoveEventDetail, SGFNode } from "./index";
import sampleSgf from "../assets/xu_wenyan_vs_risa_ueno_17_07_2026.sgf?raw";

const board = document.querySelector<GoBoardElement>("go-board")!;
const gameInfoEl = document.querySelector<HTMLElement>("#game-info")!;
const turnLabel = document.querySelector<HTMLElement>("#turn")!;
const capturesLabel = document.querySelector<HTMLElement>("#captures")!;
const moveInfoEl = document.querySelector<HTMLElement>("#move-info")!;
const nextButton = document.querySelector<HTMLButtonElement>("#next")!;
const playAllButton = document.querySelector<HTMLButtonElement>("#play-all")!;
const restartButton = document.querySelector<HTMLButtonElement>("#restart")!;

const [gameTree] = parseSGF(sampleSgf);
if (!gameTree) throw new Error("Sample SGF contains no game tree");

const [rootNode, ...mainLine] = gameTree.nodes;
if (!rootNode) throw new Error("Sample SGF game tree has no root node");

const boardSize = Number(property(rootNode, "SZ") ?? "19");
board.setAttribute("size", String(boardSize));

let moveIndex = 0;
let playAllTimer: ReturnType<typeof setInterval> | null = null;

function property(node: SGFNode, id: string): string | undefined {
  return node.properties[id]?.[0];
}

function renderGameInfo(): void {
  const black = property(rootNode!, "PB") ?? "Black";
  const blackRank = property(rootNode!, "BR");
  const white = property(rootNode!, "PW") ?? "White";
  const whiteRank = property(rootNode!, "WR");
  const komi = property(rootNode!, "KM");
  const result = property(rootNode!, "RE");
  const date = property(rootNode!, "DT");
  const event = property(rootNode!, "GN");

  const parts = [
    `<strong>${white}</strong>${whiteRank ? ` (${whiteRank})` : ""} vs `,
    `<strong>${black}</strong>${blackRank ? ` (${blackRank})` : ""}`,
    komi ? ` · Komi ${komi}` : "",
    result ? ` · Result ${result}` : "",
    date ? ` · ${date}` : "",
    event ? ` · ${event}` : "",
  ];
  gameInfoEl.innerHTML = parts.join("");
}

function updateStatus(): void {
  if (board.board.isOver) {
    turnLabel.textContent = "Game over";
  } else {
    turnLabel.textContent = board.board.currentColor === Color.Black ? "Black to move" : "White to move";
  }
  capturesLabel.textContent = `Captures — B: ${board.board.captures[Color.Black]}, W: ${board.board.captures[Color.White]}`;
  moveInfoEl.textContent = `Move ${moveIndex} / ${mainLine.length}`;

  const atEnd = moveIndex >= mainLine.length;
  nextButton.disabled = atEnd;
  playAllButton.disabled = atEnd;
}

function playMoveFromNode(node: SGFNode): void {
  const color = "B" in node.properties ? Color.Black : "W" in node.properties ? Color.White : null;
  if (color === null) return; // setup-only node (e.g. AB/AW), nothing to replay

  const value = property(node, color === Color.Black ? "B" : "W") ?? "";
  if (isSGFPass(value, boardSize)) {
    board.pass();
    return;
  }

  const vertex = sgfPointToVertex(value);
  if (!vertex) {
    console.warn("Skipping unparseable SGF move value", value);
    return;
  }
  board.play(vertex.x, vertex.y);
}

function playNext(): void {
  const node = mainLine[moveIndex];
  if (!node) return;
  playMoveFromNode(node);
  moveIndex++;
  updateStatus();
}

function stopPlayAll(): void {
  if (playAllTimer !== null) {
    clearInterval(playAllTimer);
    playAllTimer = null;
    playAllButton.textContent = "Play all";
  }
}

function togglePlayAll(): void {
  if (playAllTimer !== null) {
    stopPlayAll();
    return;
  }
  playAllButton.textContent = "Stop";
  playAllTimer = setInterval(() => {
    playNext();
    if (moveIndex >= mainLine.length) {
      stopPlayAll();
    }
  }, 120);
}

function restart(): void {
  stopPlayAll();
  board.reset(boardSize);
  moveIndex = 0;
  updateStatus();
}

board.addEventListener("move", (event) => {
  console.log("move", (event as CustomEvent<MoveEventDetail>).detail);
});

board.addEventListener("illegal-move", (event) => {
  console.warn("illegal move", (event as CustomEvent).detail);
});

nextButton.addEventListener("click", playNext);
playAllButton.addEventListener("click", togglePlayAll);
restartButton.addEventListener("click", restart);

renderGameInfo();
updateStatus();
