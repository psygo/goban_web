import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Builds/serves the demo app in ./demo, which consumes this package the
// same way an external app would (`import { GoBoard } from "goban-web-react"`).
export default defineConfig({
  root: "demo",
  plugins: [react()],
  build: {
    outDir: "../dist-demo",
    emptyOutDir: true,
  },
});
