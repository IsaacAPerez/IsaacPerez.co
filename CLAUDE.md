# IsaacPerez.co

Personal brand site for Isaac Perez (iOS engineer / founder). A single-page hero/portfolio
at `index.html` with an interactive canvas "studio" mini-game overlay, plus static legal
pages for the RoommateApp under `/roommate/`. Lives at https://isaacperez.co.

## Stack
- **Pure static site** — hand-written HTML5 + vanilla CSS + vanilla JS (ES5-style IIFEs, `'use strict'`). No framework, no bundler, no transpile step.
- **No package.json, no build, no test suite, no CI.** What's in the repo IS what ships.
- Fonts via Google Fonts CDN (Space Grotesk, Inter, JetBrains Mono).
- The mini-game is a hand-rolled 2D canvas engine in `js/game.js` (tile map, fixed 1/60 step loop, offscreen-baked room).

## Layout
- `index.html` — the whole site (hero, sections, game overlay markup). ~360 lines.
- `js/site.js` — scroll reveals, hero parallax/word-stagger, nav, theme toggle.
- `js/game.js` — playable "Isaac's Studio" canvas game (~1.6k lines).
- `css/site.css` — site styles (loaded by index.html).
- `css/game.css` — game overlay styles (loaded by index.html).
- `css/design-system.css` — design tokens + base styles; loaded ONLY by the `/roommate/` pages.
- `css/rpg.css` — UNREFERENCED / legacy; nothing loads it. Don't wire it in without intent.
- `roommate/privacy/index.html`, `roommate/terms/index.html` — RoommateApp legal pages (use `/css/design-system.css`, absolute path).
- `images/` — app icons (curbside, runsbyip, kangskuisine, teamup). Root has `isaac.JPG`, logos, `favicon.svg`, `Resume.pdf`.
- `robots.txt`, `sitemap.xml` — keep sitemap URLs in sync when adding pages.

## Build / Run / Deploy
- **No build.** Serve the directory statically to preview, e.g.:
  - `python3 -m http.server 8000` (then open http://localhost:8000), or any static server.
- **Deploy: Vercel.** Project `isaacperez` (id `prj_sSFEIZN5xWUB25tlxb7MxXUADcmZ`, team `team_kglkY3kYg639waIJAEOnAyuQ`), root `.`. Push to deploy; `vercel` / `vercel --prod` for manual.
- No backend, no Supabase, no API — this is a fully static front end.

## Conventions / red lines
- Theme: `data-theme` attr on `<html>`, persisted to `localStorage['theme']`; an inline head script applies it pre-paint to avoid FOUC — don't remove it.
- Honor `prefers-reduced-motion` — both JS files branch on it (`REDUCED`). New animation must respect it.
- Index.html uses RELATIVE asset paths (`css/...`, `js/...`); roommate pages use ABSOLUTE (`/css/...`). Match the page you're editing.
- Vanilla only — no jQuery, no npm deps, no build tooling. Keep JS in IIFE + `'use strict'` style.
- `.vercel/` is gitignored (and `.gitignore` contains only that line). No secrets, no `.env`, nothing sensitive in the repo — keep it that way.
- When adding/removing public pages, update `sitemap.xml` (and `robots.txt` if relevant).
