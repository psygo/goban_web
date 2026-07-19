# Theme asset sources

These are third-party Sabaki theme assets, repackaged here for use with
`<go-board theme="...">`'s built-in image-based themes (see "Themes" in
`Docs.md`). Each subdirectory corresponds to one `theme` attribute value.

- **`photorealistic/`** — from
  [SabakiHQ/theme-photorealistic](https://github.com/SabakiHQ/theme-photorealistic)
  by Yichuan Shen. License: [CC0 1.0](http://creativecommons.org/publicdomain/zero/1.0/)
  (public domain). Used as-is.

- **`happy-stones/`**, **`hikaru/`**, **`baduktv/`** — from
  [upsided/upsided-sabaki-themes](https://github.com/upsided/upsided-sabaki-themes)
  by upsided. License: MIT. The two stone images in `happy-stones/` and
  `baduktv/` were cropped/re-centered from the originals (which included
  large transparent margins sized for Shudan's CSS background-position
  trick); `hikaru/`'s SVGs and all board textures are used unmodified.

- **`battsgo/`** — from [JJscott/BattsGo](https://github.com/JJscott/BattsGo)
  by JJScott, a fan theme based on the BattsGo Twitch channel's chat
  emotes. No explicit license file, but the repository's sole purpose is
  distributing this theme for installation into Sabaki. Used as-is.

- **`wgojs/`** — the two default stone photos (`black.png`, renamed
  from `black00_128.png`; `white.png`, from `white00_128.png`) from
  [waltheri/wgo.js](https://github.com/waltheri/wgo.js) by Jan Prokop.
  No LICENSE file in the repo, but the same project is published to npm
  as `wgo` with `"license": "MIT"` in its `package.json`. Used as-is —
  WGo.js ships several photo variants per color for visual variety
  (`black00`-`black03`, `white00`-`white10`); only one of each is used
  here, since this project renders a single fixed image per color
  rather than picking randomly per stone.

  WGo.js's own board background (`wood_1024.jpg`) is **not** included
  here: unlike the stone photos, its JPEG comment field credits a
  separate photographer ("github.com/atarnowsky") for the image,
  suggesting different/uncertain terms from the rest of the repo. The
  `"wgojs"` theme instead uses a hand-authored SVG gradient tuned to
  the same saturated orange-brown tone (sampled from the original for
  color accuracy only, not copied) — the same approach this project's
  own default `"wood"` theme already uses.
