import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";

// This demo lives inside goban-web-react's own repo, so App.tsx imports
// the package straight from source (`from "../src/index"`) for
// live-reloading dev convenience. In a real consumer project, that would
// instead be `npm install goban-web-react` and `import { GoBoard } from
// "goban-web-react"`.
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
