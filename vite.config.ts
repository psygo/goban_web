import { defineConfig } from "vite";

export default defineConfig({
  build: {
    lib: {
      entry: "src/index.ts",
      name: "GobanWeb",
      fileName: () => "goban-web.js",
      formats: ["es"],
    },
  },
  test: {
    environment: "jsdom",
  },
});
