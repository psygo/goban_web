import { defineConfig } from "vite";

export default defineConfig({
  build: {
    // `tsc -p tsconfig.build.json` (in the `build` script) writes the
    // .d.ts files into dist/ first — Vite's default `emptyOutDir: true`
    // would otherwise wipe them out right after, since this build only
    // emits JS.
    emptyOutDir: false,
    lib: {
      entry: "src/index.ts",
      name: "GobanWebReact",
      fileName: () => "goban-web-react.js",
      formats: ["es"],
    },
    rollupOptions: {
      // react/react-dom/goban-web are peer dependencies, supplied by
      // whatever app consumes this package — bundling them would risk a
      // second React copy alongside the consumer's own.
      external: ["react", "react-dom", "react/jsx-runtime", "goban-web"],
    },
  },
});
