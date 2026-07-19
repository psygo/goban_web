// Declares the four custom element tags as valid JSX intrinsics so the
// wrapper components in this package can render them at all. Their
// goban-web attributes are kebab-case strings that don't map cleanly onto
// React's camelCase JSX prop convention, so they're set imperatively (see
// ./internal/use-attributes.ts) rather than typed here as JSX props.
//
// React 19's automatic JSX runtime resolves `JSX.IntrinsicElements` through
// `React.JSX` (re-exported from `react/jsx-runtime`), not the classic bare
// global `JSX` namespace — so this augments the `"react"` module itself
// rather than using `declare global { namespace JSX { ... } }`.
//
// Types are referenced via inline `import("...")` rather than top-level
// `import type` bindings: this file gets declaration-emitted (unlike a
// hand-written .d.ts, which is copied verbatim), and tsc can't carry a
// locally-scoped import into a `declare module` augmentation body — it
// needs each reference to be self-contained.
declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "go-board": import("react").DetailedHTMLProps<
        import("react").HTMLAttributes<import("goban-web").GoBoardElement>,
        import("goban-web").GoBoardElement
      >;
      "go-board-container": import("react").DetailedHTMLProps<
        import("react").HTMLAttributes<import("goban-web").GoBoardContainerElement>,
        import("goban-web").GoBoardContainerElement
      >;
      "go-metadata-container": import("react").DetailedHTMLProps<
        import("react").HTMLAttributes<import("goban-web").GoMetadataContainerElement>,
        import("goban-web").GoMetadataContainerElement
      >;
      "go-board-controls": import("react").DetailedHTMLProps<
        import("react").HTMLAttributes<import("goban-web").GoBoardControlsElement>,
        import("goban-web").GoBoardControlsElement
      >;
    }
  }
}

export {};
