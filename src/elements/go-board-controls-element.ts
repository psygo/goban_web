import { resolveBoard } from "./resolve-board";
import type { GoBoardElement } from "./go-board-element";

const STYLES = `
  :host {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    font-family: system-ui, sans-serif;
  }
  #counter {
    font-variant-numeric: tabular-nums;
    color: #bbb;
    font-size: 0.9rem;
  }
  #buttons {
    display: flex;
    gap: 0.5rem;
  }
  button {
    cursor: pointer;
    padding: 0.5rem 1rem;
  }
  button:disabled {
    cursor: default;
    opacity: 0.5;
  }
`;

/**
 * `<go-board-controls>` — Previous / Next / Play all / Restart controls for
 * stepping through the SGF main line loaded on its associated `<go-board>`.
 *
 * Attributes:
 *   - `board` (optional element id of the `<go-board>` to control;
 *     otherwise the nearest one is located automatically)
 */
export class GoBoardControlsElement extends HTMLElement {
  private board: GoBoardElement | null = null;
  private playTimer: ReturnType<typeof setInterval> | null = null;

  private prevButton!: HTMLButtonElement;
  private nextButton!: HTMLButtonElement;
  private playButton!: HTMLButtonElement;
  private restartButton!: HTMLButtonElement;
  private counter!: HTMLElement;

  connectedCallback(): void {
    if (!this.shadowRoot) {
      const shadow = this.attachShadow({ mode: "open" });
      shadow.innerHTML = `
        <style>${STYLES}</style>
        <div id="counter">Move 0 / 0</div>
        <div id="buttons">
          <button id="prev">Previous</button>
          <button id="next">Next</button>
          <button id="play">Play all</button>
          <button id="restart">Restart</button>
        </div>
      `;
      this.prevButton = shadow.getElementById("prev") as HTMLButtonElement;
      this.nextButton = shadow.getElementById("next") as HTMLButtonElement;
      this.playButton = shadow.getElementById("play") as HTMLButtonElement;
      this.restartButton = shadow.getElementById("restart") as HTMLButtonElement;
      this.counter = shadow.getElementById("counter") as HTMLElement;

      this.prevButton.addEventListener("click", () => this.board?.previousMove());
      this.nextButton.addEventListener("click", () => this.board?.nextMove());
      this.playButton.addEventListener("click", () => this.togglePlayAll());
      this.restartButton.addEventListener("click", () => {
        this.stopPlayAll();
        this.board?.goToMove(0);
      });
    }

    this.board = resolveBoard(this);
    this.board?.addEventListener("navigate", this.handleUpdate);
    this.board?.addEventListener("sgf-loaded", this.handleUpdate);
    this.updateUI();
  }

  disconnectedCallback(): void {
    this.stopPlayAll();
    this.board?.removeEventListener("navigate", this.handleUpdate);
    this.board?.removeEventListener("sgf-loaded", this.handleUpdate);
  }

  private readonly handleUpdate = (): void => this.updateUI();

  private togglePlayAll(): void {
    if (this.playTimer !== null) {
      this.stopPlayAll();
      return;
    }
    if (!this.board) return;
    this.playButton.textContent = "Stop";
    this.playTimer = setInterval(() => {
      const played = this.board?.nextMove() ?? false;
      if (!played) this.stopPlayAll();
    }, 120);
  }

  private stopPlayAll(): void {
    if (this.playTimer !== null) {
      clearInterval(this.playTimer);
      this.playTimer = null;
      this.playButton.textContent = "Play all";
    }
  }

  private updateUI(): void {
    const moveIndex = this.board?.moveIndex ?? 0;
    const moveCount = this.board?.moveCount ?? 0;
    this.counter.textContent = `Move ${moveIndex} / ${moveCount}`;
    this.prevButton.disabled = moveIndex <= 0;
    this.nextButton.disabled = moveIndex >= moveCount;
    this.playButton.disabled = moveCount === 0 || (moveIndex >= moveCount && this.playTimer === null);
    this.restartButton.disabled = moveCount === 0;
  }
}

customElements.define("go-board-controls", GoBoardControlsElement);
