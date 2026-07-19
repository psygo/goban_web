import { defineConfig } from "vite";

// Builds the demo app (the plain index.html board) as a normal static
// site, separate from the library build in vite.config.ts, so `vite
// preview` has something to serve.
export default defineConfig({
  build: {
    outDir: "dist-demo",
  },
});
