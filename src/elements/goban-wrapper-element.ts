/**
 * `<goban-wrapper>` — a non-visual theming scope for `<go-board>`'s
 * peripheral components (`<go-metadata-container>`, `<go-board-controls>`,
 * ...). They read their colors through a shared `--goban-*` custom
 * property layer (see "Theming" in Docs.md) that, left alone, follows the
 * visitor's OS-level `prefers-color-scheme`. Wrapping them in
 * `<goban-wrapper color-scheme="dark">` (or `"light"`) pins that choice
 * instead — useful for an in-page theme toggle, which JS can't otherwise
 * override since `prefers-color-scheme` itself isn't something a page can
 * set.
 *
 * Attributes:
 *   - `color-scheme` — `"dark"` | `"light"` | unset (default: follow
 *     `prefers-color-scheme`, i.e. no override at all).
 *
 * Carries no layout of its own (`display: contents`) — nest it around
 * whatever structure you already have, e.g.
 * `<goban-wrapper color-scheme="dark"><go-board-container>...</go-board-container></goban-wrapper>`.
 * Also sets the standard CSS `color-scheme` property to match, so native
 * browser UI (scrollbars, form controls) follows the same override.
 */
export class GobanWrapperElement extends HTMLElement {
  constructor() {
    super();
    const shadow = this.attachShadow({ mode: "open" });
    shadow.innerHTML = `
      <style>
        :host {
          display: contents;
        }
        :host([color-scheme="dark"]) {
          color-scheme: dark;
          --goban-text: #eee;
          --goban-text-secondary: #999;
          --goban-text-muted: #888;
          --goban-comment: #ccc;
          --goban-panel-bg: linear-gradient(180deg, rgba(255, 255, 255, 0.1), rgba(255, 255, 255, 0.04));
          --goban-panel-border: rgba(255, 255, 255, 0.14);
          --goban-panel-shadow: 0 1px 3px rgba(0, 0, 0, 0.25);
          --goban-card-bg: linear-gradient(180deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.02));
          --goban-card-border: rgba(255, 255, 255, 0.09);
          --goban-card-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
          --goban-toggle-bg: rgba(255, 255, 255, 0.08);
          --goban-toggle-bg-hover: rgba(255, 255, 255, 0.14);
          --goban-toggle-border: rgba(255, 255, 255, 0.12);
          --goban-btn-bg: #3a3a3a;
          --goban-btn-bg-hover: #4a4a4a;
          --goban-btn-color: #eee;
          --goban-btn-playing-bg: #7a3a3a;
          --goban-counter: #bbb;
        }
        :host([color-scheme="light"]) {
          color-scheme: light;
          --goban-text: #1a1a1a;
          --goban-text-secondary: #666;
          --goban-text-muted: #767676;
          --goban-comment: #444;
          --goban-panel-bg: linear-gradient(180deg, rgba(0, 0, 0, 0.05), rgba(0, 0, 0, 0.015));
          --goban-panel-border: rgba(0, 0, 0, 0.18);
          --goban-panel-shadow: 0 1px 2px rgba(0, 0, 0, 0.08);
          --goban-card-bg: linear-gradient(180deg, rgba(0, 0, 0, 0.035), rgba(0, 0, 0, 0.015));
          --goban-card-border: rgba(0, 0, 0, 0.1);
          --goban-card-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
          --goban-toggle-bg: rgba(0, 0, 0, 0.06);
          --goban-toggle-bg-hover: rgba(0, 0, 0, 0.1);
          --goban-toggle-border: rgba(0, 0, 0, 0.14);
          --goban-btn-bg: #e6e4e0;
          --goban-btn-bg-hover: #d8d5cf;
          --goban-btn-color: #2a2a2a;
          --goban-btn-playing-bg: #f0c2c2;
          --goban-counter: #666;
        }
      </style>
      <slot></slot>
    `;
  }
}

customElements.define("goban-wrapper", GobanWrapperElement);
