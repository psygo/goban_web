#!/usr/bin/env node
// Builds both packages (the core `goban-web` Custom Elements library and
// the `goban-web-react` wrapper) and assembles their output into a single
// `release/` folder — a ready-to-use drop for anyone who wants either the
// plain/HTML version or the React version without necessarily going
// through `npm publish` first. See "Release process" in Docs.md.
//
// Also doubles as an integrity check for image-based themes (`theme="..."`
// on `<go-board>`, see "Themes" in Docs.md): several of them point at
// asset files under `public/assets/themes/`, which only reach a consumer
// because Vite's build copies `public/` into `dist/` as-is — this script
// verifies that copy actually happened and lists what's there, so a
// silently-missing theme asset doesn't slip out in a release unnoticed.

import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const REACT_DIR = join(ROOT, "react");
const RELEASE_DIR = join(ROOT, "release");

function run(cwd, command, args) {
  console.log(`\n$ ${command} ${args.join(" ")}  (in ${relative(ROOT, cwd) || "."})`);
  execFileSync(command, args, { cwd, stdio: "inherit" });
}

function fileSizeKB(path) {
  return (statSync(path).size / 1024).toFixed(1);
}

/** Every file under `dir`, recursively, as paths relative to `dir`. */
function listFilesRecursive(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listFilesRecursive(full).map((f) => join(entry.name, f)));
    else out.push(entry.name);
  }
  return out;
}

console.log("== Building goban-web ==");
run(ROOT, "npm", ["run", "build"]);
run(ROOT, "npm", ["test"]);

console.log("\n== Building goban-web-react ==");
run(REACT_DIR, "npm", ["run", "build"]);
run(REACT_DIR, "npm", ["run", "build:demo"]);

console.log("\n== Assembling release/ ==");
rmSync(RELEASE_DIR, { recursive: true, force: true });
mkdirSync(RELEASE_DIR, { recursive: true });

const coreOut = join(RELEASE_DIR, "goban-web");
const reactOut = join(RELEASE_DIR, "goban-web-react");
cpSync(join(ROOT, "dist"), coreOut, { recursive: true });
cpSync(join(REACT_DIR, "dist"), reactOut, { recursive: true });

writeFileSync(
  join(RELEASE_DIR, "README.md"),
  `# goban-web release

Built from this repo's \`npm run release\` — see Docs.md ("Release
process") for what generated this and how to reproduce it.

## \`goban-web/\` — plain Custom Elements, any page

\`\`\`html
<go-board size="19"></go-board>
<script type="module">
  import "./goban-web/goban-web.js";
</script>
\`\`\`

## \`goban-web-react/\` — React components

\`\`\`tsx
import { GoBoard } from "./goban-web-react/goban-web-react.js";
// peer deps: react, react-dom (not bundled here — see package.json)

<GoBoard size={19} />;
\`\`\`

Both folders are exactly what \`npm publish\` would ship for each
package (their own \`dist/\`) — copy either one wholesale into a
project, or point a bundler's resolution at it.

Image-based \`theme="..."\` values on \`<go-board>\` (see "Themes" in
Docs.md) reference files under \`goban-web/assets/themes/\`, included
here — host that folder (or just that theme's subfolder) at a matching
path on your own site, or set \`black-stone\`/\`white-stone\`/
\`background-image\` yourself to wherever you've put copies.
`,
);

// Only files actually nested in a theme subfolder — excludes the loose
// NOTICE.md sitting alongside them at assets/themes/ itself.
const themeAssetFiles = listFilesRecursive(join(coreOut, "assets", "themes")).filter((f) =>
  f.includes("/"),
);
const themes = [...new Set(themeAssetFiles.map((f) => f.split("/")[0]))].sort();

console.log(`\nTheme assets included (${themeAssetFiles.length} files across ${themes.length} themes):`);
for (const theme of themes) {
  const count = themeAssetFiles.filter((f) => f.startsWith(`${theme}/`)).length;
  console.log(`  - ${theme} (${count} file${count === 1 ? "" : "s"})`);
}

const coreEntry = join(coreOut, "goban-web.js");
const reactEntry = join(reactOut, "goban-web-react.js");
console.log("\nRelease ready:");
console.log(`  release/goban-web/         (${fileSizeKB(coreEntry)} KB goban-web.js + assets/ + .d.ts)`);
console.log(`  release/goban-web-react/   (${fileSizeKB(reactEntry)} KB goban-web-react.js + .d.ts)`);

if (!existsSync(join(RELEASE_DIR, "goban-web", "index.d.ts"))) {
  console.error("\nERROR: goban-web/index.d.ts is missing from the release output.");
  process.exit(1);
}
