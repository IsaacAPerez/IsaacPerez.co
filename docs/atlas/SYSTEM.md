# IsaacPerez.co — System Definition

_**This file is the living source of truth for the shape of isaacperez.co.** The interactive atlas is built from the same data._

_Question status: **1 open · 11 resolved**._

## One paragraph

IsaacPerez.co is Isaac's personal site: seven public pages of hand-written static HTML with no package.json, bundler, application build, tests or CI. The homepage follows Me → Experience → My company, with the original portrait in Me and a quiet personal contact footer. FIRSTUNIT branding appears only in the company section, linking to firstunit.io. Homepage styling and behavior live in css/personal.css and js/personal.js. The shared utility-page assets remain intact: /photo/pricing/ and /shootsort/ stay available but unpromoted, and four legal-style pages serve Quarters and Souvenir. /photo and /photo/ redirect to the existing FIRSTUNIT Studios destination. The old game files and app icons remain in the repository but the homepage no longer loads the game or exposes its achievement UI. A push to main is a production deploy through Vercel's git integration.

## Decisions locked

| Axis | Decision | ADR |
|---|---|---|
| Runtime | Vanilla HTML/CSS/JS, one IIFE per script. No framework, package.json, bundler, node_modules or application build. The repository tree is the site. | — |
| Homepage | Me → Experience → My company, then a quiet personal contact footer. Retain the original portrait. No apps catalogue, photography portfolio, pricing promotion, office game, achievements or skills marquee. | User direction · 2026-09-11 |
| FIRSTUNIT | Company branding appears only in the homepage company section, with one company destination: https://firstunit.io. Personal identity, employer experience and contact remain independent of the company brand. | User direction · 2026-09-11 |
| Asset ownership | css/personal.css and js/personal.js own homepage behavior and styling. css/site.css may supply base tokens but remains unchanged with js/site.js for utility pages. Game files and app icons are retained without homepage promotion; css/rpg.css remains unlinked. | User direction · 2026-09-11 |
| Hosting | Vercel git integration publishes main with no build step. vercel.json retains the response headers and permanent /photo redirects; production publication requires the approved preview. | — |
| Theme and motion | Keep the inline pre-paint theme script and localStorage theme preference. Guard runtime storage access and honor prefers-reduced-motion. The homepage no longer awards badges or bakes game art. | — |
| Asset paths | Root homepage asset paths are relative. Nested pages and 404.html use absolute paths. All references must match filename case exactly. | — |
| Existing URLs | All seven sitemap pages remain. Pricing and ShootSort are retained but unpromoted; /photo and /photo/ continue to return HTTP 308 to https://firstunit.io/fu-0001. Keep legal URLs permanent and preserve utility-page navigation back to the homepage. | User direction · 2026-09-11 |
| Commits | Fleet hooks enforce Conventional Commits. Do not bypass them or push an unapproved landing-page change to main. | — |

## Cost model

## Reading order (the atlas chapters)

1. **A personal page and a static host** — Me → Experience → My company, served as hand-written HTML. _(adds L, V)_
2. **Homepage assets** — A dedicated stylesheet, the original portrait and existing font integration. _(adds C, I, E)_
3. **A small, separate runtime** — Editorial uses native scroll reveals and CSS hover motion; theme remains the active saved preference. _(adds M, T, S)_
4. **The office is dormant** — The source assets remain; the homepage no longer initializes or exposes the game. _(adds G, A)_
5. **Retained photo URLs** — The old photo route redirects; pricing stays available without homepage promotion. _(adds P, R, O)_
6. **The retained download page** — ShootSort remains reachable at its existing URL. _(adds D)_
7. **The pages that remain permanent** — Four app-facing documents and the existing commit hooks stay in place. _(adds Q, H)_
8. **Other retained legacy assets** — Unlinked files stay unlinked instead of becoming a new cleanup project. _(adds X)_
9. **The whole system** — The personal homepage, retained utilities, dormant assets and static deployment together.

## Structures

### What a visitor lands on

#### L · Landing page

**In one line.** The personal front door: who Isaac is, his engineering experience, and the company he founded.

**What it does.** Three sections in order: Me, with the original portrait and personal introduction; Experience, with Tinder and Nextdoor; My company, with the only FIRSTUNIT branding and one link to firstunit.io. A quiet footer holds personal contact links. The former product catalogue, photo promotion, game, achievements and skills marquee are absent.

**How it's built.** `index.html` is hand-written HTML with relative asset paths. It loads homepage-only `css/personal.css` and `js/personal.js`; `css/site.css` may supply shared base tokens. The theme pre-paint IIFE remains inline before the stylesheets. `js/site.js`, `js/game.js` and `css/game.css` are not homepage dependencies. Native homepage anchors retain `#about` for Me, `#experience` and the legacy `#work` target for Experience, `#firstunit` for My company, and `#contact` for the footer.

**Steps in execution.**

1. **Pre-paint theme** — The inline head IIFE applies the saved theme before stylesheet parsing.
2. **Me** — Render the personal introduction and original isaac.JPG portrait.
3. **Experience** — Show Tinder and Nextdoor in the second section.
4. **My company** — Present FIRSTUNIT only here and link to https://firstunit.io.
5. **Contact** — Close with quiet personal links rather than a service-booking funnel.

**Questions.**

- ~~**Q-L1** Should the homepage still download and bake the office when nobody opens it?~~ ✓ No. The user removed the office from the personal homepage. Game markup, achievement integration and the game CSS/JS dependencies are absent; the source assets remain dormant in the repository (2026-09-11).

#### P · /photo/ redirect

**In one line.** A preserved permanent redirect from the former photo page to FIRSTUNIT Studios.

**What it does.** Requests to /photo or /photo/ reach the existing FIRSTUNIT Studios record. There is no photo/index.html and no photography portfolio on the personal homepage. The retained pricing page has its own separate route.

**How it's built.** Two `vercel.json` redirect rules use `permanent: true` and point to `https://firstunit.io/fu-0001`. Vercel currently returns **HTTP 308** for both. The redirected path is excluded from the sitemap. The external retired domain `capturedbyip.com` returns HTTP 301 directly to the same destination (verified 2026-09-11); its configuration is outside this repository.

**Steps in execution.**

1. **Request** — GET /photo or /photo/ reaches Vercel.
2. **Redirect** — Return HTTP 308 with Location: https://firstunit.io/fu-0001.
3. **Land** — The destination renders FIRSTUNIT Studios.

**Questions.**

- ~~**Q-P1** Does capturedbyip.com still take two hops through /photo/?~~ ✓ No. Live verification found capturedbyip.com returning HTTP 301 directly to https://firstunit.io/fu-0001. This repository separately retains its /photo redirects for older inbound links (2026-09-11).

#### R · Pricing page

**In one line.** A retained pricing utility page, available by URL but unpromoted on the personal homepage.

**What it does.** Four existing packages and their add-ons, booking explanation, and quote links remain intact. Removing their homepage promotion does not remove or change the offers.

**How it's built.** `photo/pricing/index.html` continues to load `/css/site.css`, `/css/photo.css` and `/js/site.js`. Its four visible prices and `OfferCatalog` JSON-LD must remain in step. Existing FIRSTUNIT practice copy and wordmark remain on this retained utility page; the homepage company-only branding rule does not silently authorize changing this page. Quote links still return to `/#contact`.

**Steps in execution.**

1. **Serve** — A direct or indexed visit receives /photo/pricing/index.html.
2. **Read** — The four packages and existing add-ons render with the shared utility styles.
3. **Contact** — Quote links return to the personal contact footer at /#contact.

**Questions.**

- ~~**Q-R1** Should removing homepage pricing promotion delete or rebrand the pricing page?~~ ✓ No. The user approved retaining every sitemap route and keeping this utility page functional but unpromoted. A later relocation or offer change is separate work (2026-09-11).

#### D · ShootSort page

**In one line.** A retained public ShootSort download page, without a homepage product card.

**What it does.** Existing visitors can still read the card-ingest promise, folder structure and system requirements, then download the macOS app. The personal homepage no longer promotes the app.

**How it's built.** `shootsort/index.html` retains `/css/site.css`, its page-scoped style block and `/js/site.js`. Download buttons target the public `github.com/IsaacAPerez/ShootSort-releases/releases/latest/download/ShootSort.zip` endpoint. The source repository remains outside this site. Existing navigation to `/#work` now reaches the Experience section through a retained native anchor, without restoring the apps catalogue.

**Steps in execution.**

1. **Serve** — A direct visit receives /shootsort/index.html.
2. **Read** — Existing instructions and requirements render with the utility styles.
3. **Download** — The latest-release URL follows to the public macOS download.
4. **Return** — Homepage and contact links retain useful destinations.

**Questions.**

- **Q-D1** The page claims Apple silicon + macOS 14 and a notarized build, taken from `dist/appcast.xml` and the README. Nothing re-checks that when ShootSort ships a release — should the requirements line be generated, or is a page that only changes when the app's floor changes fine as prose?

#### Q · App-facing legal pages

**In one line.** The privacy, terms and support pages two iOS apps point their App Store listings at.

**What it does.** Four plain documents. For Quarters: a privacy page (last updated May 4 2026) naming exactly what the app collects (Sign in with Apple identifier, chore-proof photos, chat messages, push tokens) and where it lives (Supabase Postgres and storage in AWS us-west-1), a terms page covering households, owners, bills and termination, and a support page. For Souvenir: a privacy page that accounts, field by field, for the one photograph per place that leaves the device when a book is pressed.

**How it's built.** `roommate/{privacy,terms,support}/index.html` and `souvenir/privacy/index.html`. They are the only pages on `/css/design-system.css` — a different token set (`--color-accent: #0071e3`, `--space-*`) from the rest of the site — plus a page-local `<style>` block for `.legal-container` (Souvenir's extends it with table, `<pre>` and `h3` rules). Absolute asset paths, canonical links to their exact URLs, no JS beyond the theme pre-paint IIFE. **The path is permanent**: the app renamed RoommateApp → Crib → Quarters and `/roommate/` stayed. Two of the four are renderings, not originals: `/souvenir/privacy/` comes from `~/Coding/Souvenir/docs/privacy.md`, and `/roommate/support/` deliberately summarises and links to `thequarters.app/support` (the URL App Store Connect actually declares) rather than forking that FAQ.

**Steps in execution.**

1. **Serve** — Vercel returns the directory index for /roommate/privacy/, /roommate/terms/, /roommate/support/ or /souvenir/privacy/.
2. **Style** — design-system.css provides the tokens; a page-local style block lays out the legal container.
3. **Read** — Static prose — collection, use, storage, choices, children, changes, contact.
4. **Exit** — One footer link back to isaacperez.co.

**Questions.**

- ~~**Q-Q1** Should these move to `/quarters/` now that the app has its final name?~~ ✓ No. App Store metadata and external systems point at the existing URLs; AGENTS.md marks the path permanent and allows only copy renames — and a rename must match `\bCrib\b` case-sensitively, a precaution the rename commit 85c58c1 records because a case-insensitive replace would mangle the word "describes" in the privacy policy (2026-08-24).

### What runs in the browser

#### M · Page behavior

**In one line.** Homepage behavior is separate from the unchanged utility-page motion script.

**What it does.** Editorial adds one-time scroll reveals, a clipped portrait hover zoom, timed link underlines and arrow movements, and theme transitions. The homepage behavior stays independent of js/site.js, which remains unchanged for pricing, ShootSort and other existing utility surfaces.

**How it's built.** Both scripts stay vanilla IIFEs. `js/personal.js` handles the theme and uses IntersectionObserver to trigger one-time native Web Animations on `[data-reveal]` elements. Baseline content stays visible: supported motion briefly fades and translates it on entry, while missing APIs or reduced motion leave it fully readable. Live `prefers-reduced-motion` changes cancel active reveals; focus and hash navigation reveal their targets immediately. Anchors use native scrolling, with smooth behavior disabled under reduced motion. The homepage loads no `js/site.js` or external animation dependency; the retained shared utility script is unchanged.

**Steps in execution.**

1. **Baseline** — Keep content visible without JavaScript or animation support.
2. **Scroll entry** — IntersectionObserver starts each eligible Web Animation once and then unobserves it.
3. **Hover** — CSS clips portrait zoom within its rounded mask and animates links, arrows and theme changes when motion is allowed.
4. **Respect preferences** — Respond to live reduced-motion changes and cancel active reveals.
5. **Keep navigation immediate** — Focus and hash navigation reveal their destinations immediately while native anchors retain #about, #experience, #work, #firstunit and #contact.
6. **Utility pages** — Keep js/site.js and its behavior unchanged.

#### T · Theme switch

**In one line.** A saved light or dark preference shared by the personal homepage and utility pages.

**What it does.** The pre-paint script applies the saved theme early. Page-specific runtime code changes and stores the theme on request; there are no homepage achievement rewards or game-art updates.

**How it's built.** Each page keeps the existing inline head IIFE reading `localStorage["theme"]` and setting `data-theme` before styles load. `js/personal.js` handles the homepage toggle; `js/site.js` handles utility pages. Runtime storage access is guarded. CSS answers through the root theme attribute and the system color-scheme preference.

**Steps in execution.**

1. **Pre-paint** — Apply the saved theme before styles parse.
2. **Toggle** — The page script computes and stores the next theme.
3. **Restyle** — CSS custom properties and page rules react to data-theme.

**Questions.**

- ~~**Q-T1** Every other localStorage access is try/catch-wrapped for Safari private mode; the pre-paint IIFEs call `getItem` bare. Bug?~~ ✓ Deliberate. AGENTS.md rules that the inline pre-paint script stays verbatim in `<head>` before the stylesheets — never externalized, never deferred — because it exists to prevent FOUC (2026-08-24).

#### S · Browser storage

**In one line.** The active persistent website preference is the theme in the visitor’s browser.

**What it does.** The personal homepage remembers light or dark mode. There is no website account, application backend, analytics or game-state activity on the new homepage.

**How it's built.** `localStorage["theme"]` is read by the pre-paint IIFE and written by the active page script. Historic `ip-achievements` and `ip-game-state` values may remain in a returning visitor’s browser, but the new homepage neither reads nor writes them. Runtime theme storage access remains guarded; the existing inline pre-paint scripts are retained.

**Steps in execution.**

1. **Read** — Apply the saved theme before page paint.
2. **Write** — Save the preference when the visitor toggles it.
3. **Leave history alone** — Old game keys remain dormant; no migration or clearing is needed.

### What ships with the page

#### G · Retained office source _(not switched on)_

**In one line.** The previous canvas office implementation remains on disk but has no homepage entry point.

**What it does.** js/game.js and css/game.css are retained assets. The personal homepage does not load them, render their canvas or controls, expose the #office experience, or initialize their art and animation loop.

**How it's built.** The existing game IIFE contains its tile map, entities, canvas renderer, audio and browser-state helpers. Its former homepage markup and inline achievement engine have been removed from the active surface. The retained JavaScript and stylesheet alone are not a standalone game page. Restoring an office experience would require an explicit future scope decision.

**Steps in execution.**

1. **Retain** — Keep js/game.js and css/game.css unchanged on disk.
2. **Exclude** — Do not reference either asset from index.html.
3. **Stay dormant** — No canvas, game initialization, audio, animation loop or game-state writes run on homepage visits.

**Questions.**

- ~~**Q-G1** Should the office return as a footer easter egg?~~ ✓ No. The approved personal homepage contains Me, Experience and My company with a quiet contact footer, and explicitly excludes the office game. The source is retained without an entry point (2026-09-11).

#### A · Removed achievement integration _(not switched on)_

**In one line.** The former homepage achievement engine and toast UI are no longer active.

**What it does.** There is no inline award engine, theme-toggle badge, Konami listener, achievement counter or toast stack on the personal homepage. Old browser values are left alone.

**How it's built.** The former integration lived inside `index.html` and cooperated with `js/game.js`. That homepage markup and script have been removed. Game-side helpers remain only in the dormant game source; they do not execute because the homepage no longer loads it.

**Steps in execution.**

1. **Remove active integration** — Omit the old inline engine and achievement markup from index.html.
2. **Preserve old data** — Do not clear ip-achievements or ip-game-state as part of the homepage revision.

**Questions.**

- ~~**Q-A1** Should theme changes still unlock a badge outside the game?~~ ✓ No. Achievement UI and code are excluded from the personal homepage. The theme toggle only changes the theme (2026-09-11).

#### C · Stylesheets

**In one line.** Homepage-only styles sit beside stable utility-page styles and dormant legacy sheets.

**What it does.** The personal homepage has css/personal.css. Pricing, ShootSort, the custom 404 and legal pages retain their existing stylesheet ownership. Game and RPG sheets remain on disk without homepage references.

**How it's built.** `css/personal.css` owns the homepage layout and components, including the portrait’s 28px rounded mask and fine-pointer hover zoom, timed underlines, arrow movements and theme transitions. CSS motion is gated by `prefers-reduced-motion`; native smooth scrolling becomes immediate scrolling when reduction is requested. `css/site.css` remains unchanged for utility pages. Pricing adds `css/photo.css`. The four legal-style pages use `css/design-system.css`. ShootSort and 404 keep their scoped style blocks. `css/game.css` and `css/rpg.css` are not loaded by the homepage.

**Steps in execution.**

1. **Homepage** — Use css/personal.css for the selected personal-page variation.
2. **Utility pages** — Keep site.css and page-specific additions unchanged.
3. **Legal pages** — Keep the separate design-system.css token system.
4. **Dormant assets** — Retain game.css and rpg.css without links from the homepage.

#### I · Images & documents

**In one line.** The original portrait stays prominent; existing images and the unlinked résumé stay on disk.

**What it does.** Me uses Isaac’s original isaac.JPG inside a 28px rounded frame that clips its fine-pointer hover zoom. Employer logos and favicon remain available. Product icons are retained even though the apps catalogue is removed. Resume.pdf remains unlinked because it is the old résumé.

**How it's built.** Assets are committed directly, with no transformation pipeline. The exact case of `isaac.JPG` matters on Vercel. Homepage references are relative; utility references are absolute. The original image also supplies existing share metadata. Asset optimization stays in place under the same filename, and removing a homepage reference does not authorize deleting the underlying asset.

**Steps in execution.**

1. **Reference** — Use the original isaac.JPG in Me.
2. **Retain** — Keep existing app icons, employer marks and unlinked Resume.pdf.
3. **Verify case** — Check every changed src/href against the on-disk filename.

#### E · External services and links

**In one line.** Existing Google Fonts requests and ordinary outbound links; no embedded photo portfolio.

**What it does.** Existing font links remain available on marketing-style pages, while legal pages use system fonts. The personal homepage has one company destination inside My company and ordinary personal contact links. No YouTube player or third-party script is embedded in the homepage.

**How it's built.** The current font allowlist remains `fonts.googleapis.com` for styles and `fonts.gstatic.com` for font files. `vercel.json` still permits `www.youtube-nocookie.com` frames from the earlier photo page, but that page is gone and there is no active homepage player. Visiting FIRSTUNIT navigates to another site; it is not an embedded runtime dependency.

**Steps in execution.**

1. **Load fonts** — Use the existing Google Fonts integration where already referenced.
2. **Visit company** — The company section links to https://firstunit.io.
3. **Contact Isaac** — Footer links open the chosen personal contact destination.
4. **Keep scope** — Do not add analytics, tag managers, external scripts or portfolio embeds.

### How it gets live

#### H · Fleet commit hooks

**In one line.** The one gate in the whole pipeline — a badly-worded commit message is refused before anything ships.

**What it does.** This repo borrows the fleet's shared git hooks. A commit whose subject is not a Conventional Commit is rejected outright; a commit that passes gets logged into the CodeByIP dashboard feed.

**How it's built.** `core.hooksPath` points at `/Users/isaacperez/Coding/platform/scripts/hooks`. `commit-msg` enforces Conventional Commits. `post-commit` logs into the CodeByIP activity feed on a best-effort basis; the shared Swift-lint pre-commit hook has no Swift source to lint here. Preview and explicit production approval remain separate from these hooks.

**Steps in execution.**

1. **Write the message** — Use type(scope): subject, such as feat(site): simplify the personal homepage.
2. **Run hooks** — Commit normally; do not use --no-verify without explicit permission.
3. **Review preview** — Verify the homepage and retained utility routes before production publication.
4. **Publish when approved** — A push to main triggers Vercel.

**Questions.**

- ~~**Q-H1** Does this repository need a new CI or build pipeline for the personal homepage?~~ ✓ No. The approved implementation remains vanilla static HTML/CSS/JS; Vercel git integration is the deployment pipeline (2026-09-11).

#### V · Vercel

**In one line.** The host: it watches main, and whatever is in the tree becomes the live site.

**What it does.** There is no build. Vercel clones the repo, serves the files as they are, gives each directory an extensionless URL, and terminates TLS on the apex domain. Pushing to main is publishing.

**How it's built.** Vercel project `isaacperez`, id `prj_sSFEIZN5xWUB25tlxb7MxXUADcmZ`, team `team_kglkY3kYg639waIJAEOnAyuQ`, root `.`, serves GitHub `IsaacAPerez/IsaacPerez.co`. `vercel.json` has response headers and two permanent photo redirects, with no build command or rewrites. The custom `404.html` handles unknown URLs. Git push to main publishes production; the three design branches are review alternatives until a version is approved.

**Steps in execution.**

1. **Preview** — Review a branch locally before publication.
2. **Push approved main** — Vercel receives the git update.
3. **Serve files** — The repository tree supplies the static output.
4. **Route** — Directory indexes serve retained pages; /photo and /photo/ return HTTP 308.
5. **Verify** — Check changed content, utility pages and redirects after publication.

**Questions.**

- ~~**Q-V1** Does /photo/ still correspond to an HTML file?~~ ✓ No. The file is removed and vercel.json returns HTTP 308 to https://firstunit.io/fu-0001. The existing rule is preserved by the personal-site redesign (2026-09-11).

#### O · Discovery surface

**In one line.** Seven sitemap pages remain discoverable even though the homepage is much smaller.

**What it does.** The sitemap, robots file, per-page canonicals, share metadata and pricing OfferCatalog remain. Removing a homepage card does not remove its public URL from the sitemap.

**How it's built.** `sitemap.xml` lists `/`, `/photo/pricing/`, `/shootsort/`, `/souvenir/privacy/`, and the three `/roommate/` pages. `/photo/` is excluded because it redirects. `404.html` is excluded and marked noindex. The homepage, pricing and ShootSort retain Open Graph and Twitter metadata; pricing retains its OfferCatalog. A future route change requires updating sitemap and canonical tags together.

**Steps in execution.**

1. **Preserve** — Keep all seven existing loc entries.
2. **Canonicalize** — Each public page points to its exact production URL.
3. **Share** — Metadata continues to identify the personal site or specific utility page.
4. **Audit** — Compare sitemap paths, real pages and intentional redirects.

**Questions.**

- ~~**Q-O1** Should the reduced homepage remove the pricing, ShootSort or legal URLs from the sitemap?~~ ✓ No. The user approved keeping all seven routes functional and unchanged. Homepage promotion and route existence are separate decisions (2026-09-11).

### Not yet switched on (designed for, not built)

#### X · RPG redesign _(not switched on)_

**In one line.** Designed for, not switched on: a whole RPG-styled skin for the site, written and then never linked to anything.

**What it does.** An abandoned fantasy/RPG stylesheet remains in the repository without any active reference. The later office game is also now dormant, but its files are separate from this earlier unused skin.

**How it's built.** `css/rpg.css` is retained and loaded by no page. The operating manual explicitly forbids linking, refactoring or deleting it without Isaac requesting that work. It contributes no homepage network or rendering dependency.

**Steps in execution.**

1. **Written** — A full alternate skin lands in one commit.
2. **Orphaned** — The direction changes the next day; no stylesheet link is ever added.
3. **Kept** — It ships with every deploy, unreferenced, as a deliberate archive.

**Questions.**

- ~~**Q-X1** Delete it, or wire it up as an alternate theme?~~ ✓ Neither, without asking. AGENTS.md rules it off-limits: never link, refactor, or delete css/rpg.css unless Isaac explicitly asks for it (2026-08-24).

## Flows (representative packets)

Payload shapes are what the design implies, not measured traffic.

### A personal homepage visit

| # | From → To | Packet | Representative payload |
|---|---|---|---|
| 1 | L → V | GET / | `{"path":"/","accept":"text/html"}` |
| 2 | V → L | 200 index.html | `{"sections":["Me","Experience","My company"],"build":"none"}` |
| 3 | L → C | homepage styles | `{"sheet":"css/personal.css"}` |
| 4 | L → I | original portrait | `{"src":"isaac.JPG","section":"Me"}` |
| 5 | S → T | saved theme | `{"key":"theme","value":"dark"}` |
| 6 | T → L | pre-paint theme | `{"attribute":"data-theme","value":"dark"}` |
| 7 | L → M | homepage script | `{"src":"js/personal.js","defer":true}` |

### A retained utility-page visit

| # | From → To | Packet | Representative payload |
|---|---|---|---|
| 1 | R → V | GET /photo/pricing/ | `{"path":"/photo/pricing/"}` |
| 2 | V → R | 200 pricing page | `{"preserved":true,"homepagePromotion":false}` |
| 3 | R → C | utility styles | `{"links":["/css/site.css","/css/photo.css"]}` |
| 4 | R → M | utility script | `{"src":"/js/site.js"}` |
| 5 | R → L | personal contact | `{"href":"/#contact"}` |

### Publishing an approved change

| # | From → To | Packet | Representative payload |
|---|---|---|---|
| 1 | H → V | git push origin main | `{"subject":"feat(site): simplify the personal homepage","previewApproved":true}` |
| 2 | V → L | serve homepage | `{"path":"/"}` |
| 3 | V → P | preserve photo redirect | `{"status":308,"destination":"https://firstunit.io/fu-0001"}` |
| 4 | V → R | preserve pricing | `{"path":"/photo/pricing/"}` |
| 5 | V → D | preserve download page | `{"path":"/shootsort/"}` |
| 6 | V → Q | preserve legal pages | `{"count":4}` |
| 7 | V → O | preserve discovery | `{"sitemapPages":7}` |

## Questions — index

Reference by ID. ✓ resolved (with date) · otherwise open.

- ~~**Q-L1**~~ (L) ✓ No. The user removed the office from the personal homepage. Game markup, achievement integration and the game CSS/JS dependencies are absent; the source assets remain dormant in the repository (2026-09-11).
- ~~**Q-P1**~~ (P) ✓ No. Live verification found capturedbyip.com returning HTTP 301 directly to https://firstunit.io/fu-0001. This repository separately retains its /photo redirects for older inbound links (2026-09-11).
- ~~**Q-R1**~~ (R) ✓ No. The user approved retaining every sitemap route and keeping this utility page functional but unpromoted. A later relocation or offer change is separate work (2026-09-11).
- **Q-D1** (D) The page claims Apple silicon + macOS 14 and a notarized build, taken from `dist/appcast.xml` and the README. Nothing re-checks that when ShootSort ships a release — should the requirements line be generated, or is a page that only changes when the app's floor changes fine as prose?
- ~~**Q-Q1**~~ (Q) ✓ No. App Store metadata and external systems point at the existing URLs; AGENTS.md marks the path permanent and allows only copy renames — and a rename must match `\bCrib\b` case-sensitively, a precaution the rename commit 85c58c1 records because a case-insensitive replace would mangle the word "describes" in the privacy policy (2026-08-24).
- ~~**Q-T1**~~ (T) ✓ Deliberate. AGENTS.md rules that the inline pre-paint script stays verbatim in `<head>` before the stylesheets — never externalized, never deferred — because it exists to prevent FOUC (2026-08-24).
- ~~**Q-G1**~~ (G) ✓ No. The approved personal homepage contains Me, Experience and My company with a quiet contact footer, and explicitly excludes the office game. The source is retained without an entry point (2026-09-11).
- ~~**Q-A1**~~ (A) ✓ No. Achievement UI and code are excluded from the personal homepage. The theme toggle only changes the theme (2026-09-11).
- ~~**Q-H1**~~ (H) ✓ No. The approved implementation remains vanilla static HTML/CSS/JS; Vercel git integration is the deployment pipeline (2026-09-11).
- ~~**Q-V1**~~ (V) ✓ No. The file is removed and vercel.json returns HTTP 308 to https://firstunit.io/fu-0001. The existing rule is preserved by the personal-site redesign (2026-09-11).
- ~~**Q-O1**~~ (O) ✓ No. The user approved keeping all seven routes functional and unchanged. Homepage promotion and route existence are separate decisions (2026-09-11).
- ~~**Q-X1**~~ (X) ✓ Neither, without asking. AGENTS.md rules it off-limits: never link, refactor, or delete css/rpg.css unless Isaac explicitly asks for it (2026-08-24).

## What the platform gives vs what we own

**Platform gives:** Vercel provides git integration on <code>main</code>, TLS, CDN delivery, directory-style URLs and a custom 404 without an application build. <code>vercel.json</code> carries response headers and permanent redirects for <code>/photo</code> and <code>/photo/</code>. GitHub stores the source; the fleet platform supplies Conventional Commit and activity-feed hooks. Google Fonts supplies the existing font families. There is no application backend, analytics integration or GitHub Actions workflow in this repository. Machine-level monitoring is managed outside this repo; its configuration is not part of the website runtime.

**We own:** The personal homepage, retained pricing and download pages, four legal-style pages, custom 404, page-specific styles and scripts, inline theme pre-paint, image/document assets, redirect configuration and discovery metadata. We also retain dormant game assets and the unlinked RPG stylesheet without making them homepage dependencies.

## Planned filesystem

```
IsaacPerez.co/
  index.html            Me → Experience → My company; personal contact footer
  css/
    personal.css        homepage only; may use site.css base tokens
    site.css            shared utility-page styling and base tokens
    photo.css           /photo/pricing/ only
    design-system.css   four legal-style pages only
    game.css            retained office chrome; not loaded by the homepage
    rpg.css             abandoned redesign; no references
  js/
    personal.js         homepage theme and accessible one-time scroll reveals
    site.js             retained utility-page motion and theme behavior
    game.js             retained office implementation; not loaded by the homepage
  photo/
    (no index.html; /photo and /photo/ return 308 via vercel.json)
    pricing/index.html  retained pricing and OfferCatalog; unpromoted on homepage
  shootsort/index.html  retained macOS download page; unpromoted on homepage
  roommate/
    privacy/index.html  Quarters privacy policy
    terms/index.html    Quarters terms
    support/index.html  Quarters support summary and canonical-page link
  souvenir/
    privacy/index.html  rendered from Souvenir/docs/privacy.md
  404.html              custom not-found page
  images/               retained product icons
  isaac.JPG             original portrait, used in Me and share metadata
  Resume.pdf            old résumé, retained and unlinked
  favicon.svg  ndLogo.webp  tinderLogo.png
  sitemap.xml  robots.txt  vercel.json  AGENTS.md
  .vercel/              gitignored Vercel linkage
  docs/atlas/           data.mjs → atlas.html + SYSTEM.md
```

## How this file is maintained

Generated from `docs/atlas/data.mjs` by `node docs/atlas/build.mjs`, which also builds the interactive atlas (`atlas.html`). Edit the data file, rebuild, republish — never edit this file by hand.
