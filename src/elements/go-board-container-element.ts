/**
 * `<go-board-container>` — a pure layout wrapper for `<go-board>` and its
 * peripheral components (`<go-metadata-container>`, `<go-board-controls>`,
 * ...). Carries no behavior of its own beyond arranging slotted children.
 */
export class GoBoardContainerElement extends HTMLElement {
  constructor() {
    super();
    const shadow = this.attachShadow({ mode: "open" });
    shadow.innerHTML = `
      <style>
        :host {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }
      </style>
      <slot></slot>
    `;
  }
}

customElements.define("go-board-container", GoBoardContainerElement);
