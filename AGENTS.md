# IsaacPerez.co — operating manual

Personal site at https://isaacperez.co: one hand-written homepage organized **Me → Experience → My company**, followed by a quiet personal contact footer. The original `isaac.JPG` portrait stays in Me. FIRSTUNIT branding appears only in the company section, with one company destination, `https://firstunit.io`. The homepage has no apps catalogue, photography portfolio, pricing promotion, office game, achievements or skills marquee.

Seven public pages remain in the sitemap: the homepage, `/photo/pricing/`, `/shootsort/`, `/roommate/{privacy,terms,support}/` (Quarters), and `/souvenir/privacy/` (Souvenir). Pricing and ShootSort remain functional for existing visitors but are not promoted on the homepage. `/photo` and `/photo/` are permanent Vercel redirects to `https://firstunit.io/fu-0001` (currently HTTP 308); there is no `photo/index.html`. The retired capturedbyip.com domain redirects directly to that destination (HTTP 301, verified 2026-09-11). `404.html` handles unknown URLs.

Pure static — vanilla HTML/CSS/JS, no package.json, application build, tests or CI. `vercel.json` contains the photo redirects and response headers (hash-based CSP + HSTS + nosniff + frame/referrer/permissions/CORS), with no build command. Hosted on Vercel (project `isaacperez`, id `prj_sSFEIZN5xWUB25tlxb7MxXUADcmZ`, team `team_kglkY3kYg639waIJAEOnAyuQ`, root `.`), auto-deploying `main` from GitHub `IsaacAPerez/IsaacPerez.co`.
Prime directive: the repo tree IS the site and a push to main IS a production deploy — keep it vanilla, and preview before you ship anything user-visible.

## Commands
- Rebuild the architecture atlas after changing how IsaacPerez.co works: `node docs/atlas/build.mjs` (edit `docs/atlas/data.mjs` only — `atlas.html` and `SYSTEM.md` are generated). It renders inside IsaacPerez.co's tab in the CodeByIP app, with a drift count since `data.mjs` was last committed; `docs/atlas/README.md` explains the set.
- Preview: `python3 -m http.server 8000` from repo root, open http://localhost:8000. No build step — any static server works.
- Deploy prod: `git push origin main` (Vercel auto-deploys; no CI, no staging gate).
- Manual deploy (avoid; ask first for prod): `vercel` (preview) / `vercel --prod` — CLI at `/opt/homebrew/bin/vercel`.
- Commit: `git commit -m 'type(scope): subject'` — types `feat|fix|chore|refactor|docs|test|perf|build|ci|revert`, enforced by hook (see Conventions).
- List public URLs that must stay in sync: `grep '<loc>' sitemap.xml` — that grep IS the list, don't hard-code it here (it has grown from 3 to 8 since this file first named them). `404.html` is deliberately not in it.
- Case-check asset refs before commit: `grep -o 'src="[^"]*"\|href="[^"]*"' index.html | sort -u` then compare against `ls` output. (added)

## Conventions
- Conventional Commits ENFORCED by the fleet hook: this repo's `core.hooksPath` → `/Users/isaacperez/Coding/platform/scripts/hooks`. `commit-msg` rejects anything not matching `type(scope): subject`. all but the most recent commit(s) predate the 2026-06-25 hook — do NOT imitate the old "Updated UI" log style. (added)
- Fleet hooks awareness: `post-commit` logs every commit to the CodeByIP dashboard feed (`~/Coding/CodeByIP/Backend/luka-log.py`, best-effort); `pre-commit` (Swift lint) no-ops here. No action needed for either. (added)
- Vanilla JS only: one IIFE per file with `'use strict'`. `js/personal.js` owns homepage behavior; `js/site.js` remains the shared utility-page behavior. Match the file you're in. Retained `js/game.js` is dormant and is not loaded by the homepage.
- Theme: `data-theme` on `<html>`, persisted to `localStorage['theme']`, applied by an inline pre-paint script in each page's `<head>`. `js/personal.js` handles the homepage toggle; `js/site.js` handles utility-page toggles. Homepage toggles do not initialize game art or award achievements.
- Mobbin is the design source of truth: before designing or redesigning any page or section, pull 2–3 real examples via the Mobbin MCP (`search_screens` for whole pages, `search_sections` for hero/pricing/footer-type sections; tool names may carry a server prefix — load via ToolSearch if deferred) with `platform: "web"`, `mode: "deep"` for nuanced queries, naming a top app to filter. Study the returned screenshot images — layout, hierarchy, spacing — not the metadata. Adapt the pattern, don't copy: colors/type stay on this site's own `css/site.css` theme (both `data-theme` modes). When presenting design directions to Isaac, cite each referenced screen as a markdown link to its `mobbin_url`.
- `prefers-reduced-motion`: gate any homepage motion in `js/personal.js` and `css/personal.css` on the user's preference. Shared `js/site.js` and dormant `js/game.js` retain their existing `REDUCED` handling.
- Editorial behavior: retain the portrait's 28px rounded mask. Fine-pointer hover adds a clipped portrait zoom; CSS handles link, arrow and theme transitions. `js/personal.js` uses IntersectionObserver and native Web Animations for one-time scroll reveals over always-visible baseline content. Honor live reduced-motion changes and reveal focused or hash-targeted content immediately; keep native anchor scrolling and add no motion dependency.
- Asset paths: `index.html` (root) uses RELATIVE (`css/site.css`); EVERY page in a subdirectory — `/photo/pricing/`, `/shootsort/`, `/roommate/*/`, `/souvenir/*/` — uses ABSOLUTE (`/css/...`, `/js/...`, `/favicon.svg`). `404.html` sits at the root but is served for a bad URL at ANY depth, so it uses absolute paths too. Match the page being edited.
- CSS roles: `css/personal.css` = homepage only. `css/site.css` retains the shared utility-page styling and may supply the homepage's base tokens; keep it unchanged when implementing a homepage variation. `css/photo.css` = `/photo/pricing/` only; `css/design-system.css` = only the four legal-style pages. `css/game.css` is retained with `js/game.js` but is not loaded by the homepage. `css/rpg.css` remains dead legacy, zero references.
- A one-off page (`/shootsort/`, `404.html`) carries its handful of extra rules in a page-scoped `<style>` block rather than widening a shared stylesheet's role. The legal-style pages do the same.
- Content that has a canonical source in ANOTHER repo is rendered here, not authored here: `/souvenir/privacy/` is a rendering of `~/Coding/Souvenir/docs/privacy.md`. Edit the source, then re-render. `/roommate/support/` deliberately summarises and links to `thequarters.app/support` (the App Store support URL, generated from `~/Coding/RoommateApp/legal/SUPPORT.md`) instead of forking that FAQ.
- `localStorage`: runtime reads and writes in `js/personal.js` and `js/site.js` are wrapped in try/catch (Safari private mode). The inline pre-paint theme scripts in each page's `<head>` call `getItem` bare — leave them as-is. `theme` is the active preference; any old `ip-achievements` or `ip-game-state` values are dormant and should not be cleared as homepage cleanup.
- Every public page carries a canonical `<link>` to its exact `https://isaacperez.co/...` URL; `sitemap.xml` is updated in the same commit as any page add/remove.
- Images are optimized IN PLACE before committing, same filename: icons ≤ ~105KB, photos ≤ ~200KB (the existing `images/` files define the budget). (added)
- `.gitignore` is one line (`.vercel`). Zero secrets, no `.env`, no API calls anywhere — the fleet's 1Password setup has nothing to wire up here; keep it that way.
- Fleet roster: this site is `slug: isaac-perez-co` in `~/Coding/platform/scripts/products.json` — roster edits happen THERE, never in this repo.

## Mistakes you will make here
- **Wrong filename case that works locally and 404s in prod.** macOS APFS is case-insensitive; Vercel is not — the hero photo really is `isaac.JPG` (uppercase, and it's the og:image; fix commit 3adf50c). Rule: reference assets with the exact on-disk case; after touching any `src`/`href`, diff the reference against `ls` before committing.
- **Wiring in or "cleaning up" `css/rpg.css`.** It's 1139 lines of abandoned RPG-redesign legacy (commit 776549e, orphaned next day); grep confirms nothing loads it. Rule: never link, refactor, or delete it unless Isaac explicitly asks.
- **Committing unoptimized images.** History has 1.37MB icons and a 2.8MB screenshot that later needed cleanup commits (d5f97e7, 0fe9671). Rule: resize/compress in place to the budget (icons ≤ ~105KB, photos ≤ ~200KB) before `git add`, keeping the filename.
- **Copying asset paths between page types.** A relative `css/...` path pasted into `/roommate/x/` resolves fine locally from root but breaks deployed. Rule: every subdirectory page uses absolute `/css/...` paths (and so does `404.html`); only `index.html` stays relative.
- **"Tidying" the inline theme script into site.js.** The pre-paint IIFE in `index.html` head exists to prevent FOUC. Rule: it stays inline, in `<head>`, before the stylesheets — never externalize or defer it.
- **Editing an inline `<script>` without recomputing its CSP hash.** `script-src` in `vercel.json` has no `'unsafe-inline'`; it allowlists three exact sha256 hashes — the two pre-paint theme IIFE variants (root/`404.html`/`/shootsort/`/`/photo/pricing/` share one, the four legal pages share the `const` variant) and the `/photo/pricing/` JSON-LD block. The hashes are byte-exact, so changing so much as the indentation makes the browser silently refuse to run the block: the page pre-paints in the wrong theme with nothing in the console but a CSP report. Rule: after touching any inline `<script>`, regenerate the hash (`printf '%s' "$body" | openssl dgst -sha256 -binary | openssl base64`, where `$body` is the text between the tags, verbatim) and update `vercel.json` in the same commit. (added)
- **Adding tooling to "fix" the missing build/CI.** No package.json, no `.github/`, no runner for this repo — by design; Vercel git integration is the entire pipeline. Rule: never add package.json, bundlers, frameworks, node_modules, or workflows.
- **Imitating the git log's commit style.** Almost all history predates the commit-msg hook and would be rejected today. Rule: write `fix(game): ...` / `feat(site): ...` regardless of what `git log` shows; no `--no-verify`.
- **New animation that ignores reduced motion.** Rule: branch any new animation on the motion preference or a `prefers-reduced-motion` media query in CSS.

## Quality bar
Landing-page edit (`index.html` / `css/personal.css` / `js/personal.js`):
- Renders via `python3 -m http.server 8000` with zero console errors.
- Me → Experience → My company stays the content order; the original portrait remains in Me and personal contact stays in the footer.
- FIRSTUNIT branding stays inside the company section, with one company destination (`https://firstunit.io`); no apps catalogue, photo/pricing promotion, office UI, achievement engine or skills marquee.
- `css/game.css`, `js/game.js` and `js/site.js` are not homepage dependencies. Shared utility-page assets, all seven sitemap routes and the photo redirects remain functional.
- Preserve compatibility for existing utility-page links to homepage anchors when simplifying navigation.
- Inline theme pre-paint script still present verbatim in `<head>`.
- Every new/changed `src`/`href` matches on-disk case exactly (grep-vs-ls check passes).
- New motion branches on `REDUCED` or a reduced-motion media query.
- No new external dependencies beyond the existing Google Fonts `<link>`s.
- Commit passes the hook without `--no-verify`.

Retained game assets (`js/game.js` / `css/game.css`), only if Isaac later requests work on the game:
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
- `/roommate/privacy/`, `/roommate/terms/` and `/souvenir/privacy/`: App Store-facing legal pages (Quarters, Souvenir). Never change legal substance, move, or delete; copy edits beyond typos need sign-off. The `/roommate/` path is permanent despite the app being renamed (RoommateApp → Crib → Quarters) — never "fix" it. The app name in the page copy was updated Crib → Quarters on 2026-08-10; when doing that kind of rename, match `\bCrib\b` case-sensitively — a case-insensitive replace corrupts the word "des**crib**es" in the privacy policy.
- Renaming/moving ANY public URL (`grep '<loc>' sitemap.xml`) — external systems point at them; if approved, update sitemap + canonicals in the same commit.
- `Resume.pdf` and `isaac.JPG` are Isaac's real resume/photo — replace only on explicit request. `Resume.pdf` is the August-2020 student résumé and remains UNLINKED. Do not restore a résumé link until Isaac supplies a current PDF. The homepage's Me section uses the original `isaac.JPG`.
- Vercel project/domain/DNS settings, `vercel link`, or any manual `vercel --prod` — prefer git push; ask first. `vercel.json` counts: a header change (especially the CSP) can break every page at once, so change it only with a local header-replaying server test across all pages.
- Adding build tooling, frameworks, npm deps, analytics, or any third-party script — architecture change.
- Deleting anything from `images/` or root assets: grep index.html + roommate pages for references first; if referenced or ambiguous, ask.
- Fleet roster changes (`~/Coding/platform/scripts/products.json`) — flag to Isaac, don't edit cross-repo unprompted.
- `--no-verify` on the commit hook: only with explicit permission.
