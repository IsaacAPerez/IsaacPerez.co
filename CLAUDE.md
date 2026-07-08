# IsaacPerez.co — operating manual

Personal brand site at https://isaacperez.co: one hand-written landing page (`index.html`, ~360 lines) with a canvas mini-game overlay ("Isaac's Studio", `js/game.js`, ~1.6k lines), plus App Store-linked legal pages for the Crib iOS app under `/roommate/privacy/` and `/roommate/terms/`. Pure static — vanilla HTML/CSS/JS, no package.json, no build, no tests, no CI. Hosted on Vercel (project `isaacperez`, id `prj_sSFEIZN5xWUB25tlxb7MxXUADcmZ`, team `team_kglkY3kYg639waIJAEOnAyuQ`, root `.`), auto-deploying `main` from GitHub `IsaacAPerez/IsaacPerez.co`.
Prime directive: the repo tree IS the site and a push to main IS a production deploy — keep it vanilla, and preview before you ship anything user-visible.

## Commands
- Preview: `python3 -m http.server 8000` from repo root, open http://localhost:8000. No build step — any static server works.
- Deploy prod: `git push origin main` (Vercel auto-deploys; no CI, no staging gate).
- Manual deploy (avoid; ask first for prod): `vercel` (preview) / `vercel --prod` — CLI at `/opt/homebrew/bin/vercel`.
- Commit: `git commit -m 'type(scope): subject'` — types `feat|fix|chore|refactor|docs|test|perf|build|ci|revert`, enforced by hook (see Conventions).
- List public URLs that must stay in sync: `grep '<loc>' sitemap.xml` (currently exactly `/`, `/roommate/privacy/`, `/roommate/terms/`).
- Case-check asset refs before commit: `grep -o 'src="[^"]*"\|href="[^"]*"' index.html | sort -u` then compare against `ls` output. (added)

## Conventions
- Conventional Commits ENFORCED by the fleet hook: this repo's `core.hooksPath` → `/Users/isaacperez/Coding/platform/scripts/hooks`. `commit-msg` rejects anything not matching `type(scope): subject`. all but the most recent commit(s) predate the 2026-06-25 hook — do NOT imitate the old "Updated UI" log style. (added)
- Fleet hooks awareness: `post-commit` logs every commit to the CodeByIP dashboard feed (`~/Coding/CodeByIP/Backend/luka-log.py`, best-effort); `pre-commit` (Swift lint) no-ops here. No action needed for either. (added)
- Vanilla JS only: one IIFE per file with `'use strict'`. `js/site.js` is ES5-style (`var`); `js/game.js` uses `const`/`let`. Match the file you're in.
- Theme: `data-theme` on `<html>`, persisted to `localStorage['theme']`, applied by an inline pre-paint script in `index.html` head (~lines 27-33). `js/game.js` reads it (falls back to `prefers-color-scheme`) and re-bakes the offscreen room on toggle.
- `prefers-reduced-motion`: both JS files compute a `REDUCED` flag (site.js:7, game.js:19) and branch on it everywhere. All new motion must too.
- Asset paths: `index.html` uses RELATIVE (`css/site.css`); nested `/roommate/*/` pages use ABSOLUTE (`/css/design-system.css`). Match the page being edited.
- CSS roles: `css/site.css` = landing page; `css/game.css` = game overlay; `css/design-system.css` = ONLY the `/roommate/` legal pages; `css/rpg.css` = dead legacy, zero references.
- `localStorage`: writes, and all access in `js/site.js` / `js/game.js` / the achievements script in `index.html`, are wrapped in try/catch (Safari private mode). The inline pre-paint theme scripts in each page's `<head>` call `getItem` bare — leave them as-is. Keys in use: `theme`, `ip-achievements`, the game-state key.
- Every public page carries a canonical `<link>` to its exact `https://isaacperez.co/...` URL; `sitemap.xml` is updated in the same commit as any page add/remove.
- Images are optimized IN PLACE before committing, same filename: icons ≤ ~105KB, photos ≤ ~200KB (the existing `images/` files define the budget). (added)
- `.gitignore` is one line (`.vercel`). Zero secrets, no `.env`, no API calls anywhere — the fleet's 1Password setup has nothing to wire up here; keep it that way.
- Fleet roster: this site is `slug: isaac-perez-co` in `~/Coding/platform/scripts/products.json` — roster edits happen THERE, never in this repo.

## Mistakes you will make here
- **Wrong filename case that works locally and 404s in prod.** macOS APFS is case-insensitive; Vercel is not — the hero photo really is `isaac.JPG` (uppercase, and it's the og:image; fix commit 3adf50c). Rule: reference assets with the exact on-disk case; after touching any `src`/`href`, diff the reference against `ls` before committing.
- **Wiring in or "cleaning up" `css/rpg.css`.** It's 1139 lines of abandoned RPG-redesign legacy (commit 776549e, orphaned next day); grep confirms nothing loads it. Rule: never link, refactor, or delete it unless Isaac explicitly asks.
- **Committing unoptimized images.** History has 1.37MB icons and a 2.8MB screenshot that later needed cleanup commits (d5f97e7, 0fe9671). Rule: resize/compress in place to the budget (icons ≤ ~105KB, photos ≤ ~200KB) before `git add`, keeping the filename.
- **Copying asset paths between page types.** A relative `css/...` path pasted into `/roommate/x/` resolves fine locally from root but breaks deployed. Rule: nested pages use absolute `/css/...` paths; `index.html` stays relative.
- **"Tidying" the inline theme script into site.js.** The pre-paint IIFE in `index.html` head exists to prevent FOUC. Rule: it stays inline, in `<head>`, before the stylesheets — never externalize or defer it.
- **Adding tooling to "fix" the missing build/CI.** No package.json, no `.github/`, no runner for this repo — by design; Vercel git integration is the entire pipeline. Rule: never add package.json, bundlers, frameworks, node_modules, or workflows.
- **Imitating the git log's commit style.** Almost all history predates the commit-msg hook and would be rejected today. Rule: write `fix(game): ...` / `feat(site): ...` regardless of what `git log` shows; no `--no-verify`.
- **New animation that ignores reduced motion.** Both files gate every effect on `REDUCED` (a11y pass cd35293). Rule: branch any new animation on the existing `REDUCED` flag or a `prefers-reduced-motion` media query in CSS.

## Quality bar
Landing-page edit (`index.html` / `css/site.css` / `js/site.js`):
- Renders via `python3 -m http.server 8000` with zero console errors.
- Inline theme pre-paint script still present verbatim in `<head>`.
- Every new/changed `src`/`href` matches on-disk case exactly (grep-vs-ls check passes).
- New motion branches on `REDUCED` or a reduced-motion media query.
- No new external dependencies beyond the existing Google Fonts `<link>`s.
- Commit passes the hook without `--no-verify`.

Game change (`js/game.js` / `css/game.css`):
- File still one IIFE with `'use strict'` at top.
- Served statically: canvas paints, HUD toggles, no console errors.
- All localStorage reads/writes wrapped in try/catch (pattern at game.js:46-50).
- Theme toggle still re-bakes the offscreen room (game.js:56-57 path intact or equivalent).

New public page (e.g. legal page for a fleet iOS app):
- Lives at `<app>/<page>/index.html` (extensionless URL with trailing slash).
- Absolute asset paths (`/css/design-system.css` pattern).
- Canonical `<link>` to its exact `https://isaacperez.co/<path>/` URL.
- `sitemap.xml` gains the `<loc>` entry in the same commit; existing URLs untouched.

Image/asset update:
- Size within budget vs existing files (`ls -la images/` to compare).
- Replaced in place under the same filename, OR every reference updated with exact case.
- If the hero photo changed: og:image/twitter:image still resolve.

Deploy:
- `git push origin main`, then verify: `curl -s https://isaacperez.co | grep <changed-text>` (or browser).
- `git status` shows no `.vercel/` contents, secrets, or `.env` staged.

## When uncertain
Decide autonomously: typo fixes, code-level refactors within a file's existing style, sitemap/canonical bookkeeping for approved page adds, in-place image optimization.
STOP and ask Isaac (show a local preview URL/screenshot and the exact diff when asking):
- Anything user-visible on the landing page (hero copy, sections, styling, redesigns) — push is instant prod with no staging; get an OK before `git push`.
- `/roommate/privacy/` and `/roommate/terms/`: App Store-linked legal pages for Crib. Never change legal substance, move, or delete; copy edits beyond typos need sign-off. The `/roommate/` path is permanent despite the Crib rebrand — never "fix" it.
- Renaming/moving ANY public URL (`/`, `/roommate/privacy/`, `/roommate/terms/`) — external systems point at them; if approved, update sitemap + canonicals in the same commit.
- `Resume.pdf` and `isaac.JPG` are Isaac's real resume/photo — replace only on explicit request.
- Vercel project/domain/DNS settings, `vercel link`, or any manual `vercel --prod` — prefer git push; ask first.
- Adding build tooling, frameworks, npm deps, analytics, or any third-party script — architecture change.
- Deleting anything from `images/` or root assets: grep index.html + roommate pages for references first; if referenced or ambiguous, ask.
- Fleet roster changes (`~/Coding/platform/scripts/products.json`) — flag to Isaac, don't edit cross-repo unprompted.
- `--no-verify` on the commit hook: only with explicit permission.
