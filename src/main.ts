import "./index";
import { Color } from "./index";
import type { GoBoardElement, MoveEventDetail } from "./index";

const board = document.querySelector<GoBoardElement>("go-board")!;
const turnLabel = document.querySelector<HTMLElement>("#turn")!;
const capturesLabel = document.querySelector<HTMLElement>("#captures")!;
const passButton = document.querySelector<HTMLButtonElement>("#pass")!;
const resetButton = document.querySelector<HTMLButtonElement>("#reset")!;

function updateStatus(): void {
  if (board.board.isOver) {
    turnLabel.textContent = "Game over";
  } else {
    turnLabel.textContent = board.board.currentColor === Color.Black ? "Black to move" : "White to move";
  }
  capturesLabel.textContent = `Captures — B: ${board.board.captures[Color.Black]}, W: ${board.board.captures[Color.White]}`;
}

board.addEventListener("move", (event) => {
  const detail = (event as CustomEvent<MoveEventDetail>).detail;
  console.log("move", detail);
  updateStatus();
});

board.addEventListener("illegal-move", (event) => {
  console.warn("illegal move", (event as CustomEvent).detail);
});

board.addEventListener("pass", updateStatus);

passButton.addEventListener("click", () => board.pass());
resetButton.addEventListener("click", () => board.reset());

updateStatus();
