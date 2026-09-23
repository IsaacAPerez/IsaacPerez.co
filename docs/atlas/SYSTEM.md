# IsaacPerez.co — System Definition

_**This file is the living source of truth for the shape of isaacperez.co.** The interactive atlas is built from the same data._

_Question status: **1 open · 7 resolved**._

## One paragraph

IsaacPerez.co is Isaac's personal site: eight public pages of hand-written static HTML with no package.json, bundler, application build or CI. The root homepage is a first-person, toy-eye-level room based on Isaac's photographs. Visitors explore the bedroom and bathroom, meet Mimi and Charlie, inspect work and sneaker details, control lights and music, and optionally make a three-photo postcard. The earlier Me → Experience → My company page remains at /about/ with the original portrait and personal contact; the room reads its content rather than forking the biography. Public scripts, GLBs and the short material-study film live under /room/, while the source/prototype and original reference photos stay outside the deployment under docs/room-preview and in Isaac's Downloads. Pricing, ShootSort and four legal pages retain their URLs; /photo redirects to FIRSTUNIT Studios. A push to main publishes through Vercel's git integration.

## Decisions locked

| Axis | Decision | ADR |
|---|---|---|
| Brand Studio ownership | The product owns existing design source, brand/studio.adapter.json pointers and a generated read-only catalog. The pinned platform checkout owns extraction, validation and the shared browser/native renderer; CodeByIP reads that same fingerprinted catalog instead of authoring a second design system. The source library is local-only: .vercelignore excludes brand/ and the launcher; the public static site gains no developer route. | brand/README.md |
| Runtime | Vanilla HTML/CSS/JS, one IIFE per script. No framework, package.json, bundler, node_modules or application build. The repository tree is the site. | — |
| Homepage | The room becomes /, with toy-eye-level first-person exploration. Preserve the prior Me → Experience → My company page at /about/ as the readable alternative and content source; retain its original portrait and contact footer. | User direction · 2026-09-22 |
| FIRSTUNIT | Company branding remains in /about/'s My company section and the corresponding room story; the company destination is https://firstunit.io. Personal identity, employer experience and contact remain independent of the company brand. | User direction · 2026-09-11 and 2026-09-22 |
| Asset ownership | The root loads curated public room styles and scripts from /room/. css/personal.css and js/personal.js move with the former editorial page to /about/; /room/portfolio.js fetches that page on demand. docs/room-preview/ remains the excluded source and local reference prototype. | User direction · 2026-09-22 |
| Hosting | Vercel git integration publishes main with no build step. vercel.json retains the response headers and permanent /photo redirects; production publication requires the approved preview. | — |
| Theme and motion | Keep the editorial /about/ pre-paint theme script and localStorage theme preference. The room honors prefers-reduced-motion, gates sound behind visitor entry, and keeps cat movement optional under reduced motion. | — |
| Asset paths | The root room and nested /about/ use exact absolute paths for their shared /room/ and /css/ resources. Existing nested pages and 404.html keep absolute paths; all references must match filename case exactly. | — |
| Existing URLs | The seven existing sitemap routes remain, and /about/ is added as the eighth. Pricing and ShootSort stay functional; /photo and /photo/ still return HTTP 308 to FIRSTUNIT Studios. Utility-page section links now target /about/# anchors; home links return to the room at /. | User direction · 2026-09-22 |
| Commits | Fleet hooks enforce Conventional Commits. Do not bypass them or push an unapproved landing-page change to main. | — |

## Cost model

## Reading order (the atlas chapters)

1. **A playable room and a readable page** — The room is /; the earlier personal page survives at /about/. _(adds L, A, V)_
2. **Public media and styles** — Curated GLBs and a short film ship; source photos stay private. _(adds C, I, E)_
3. **The room comes to life** — Navigate, inspect, play with cats, relight the scene and take photos. _(adds M, T, S)_
4. **Retained photo URLs** — The old photo route redirects; pricing stays available without homepage promotion. _(adds P, R, O)_
5. **The retained download page** — ShootSort remains reachable at its existing URL. _(adds D)_
6. **The pages that remain permanent** — Four app-facing documents and the existing commit hooks stay in place. _(adds Q, H)_
7. **The whole system** — The room, readable alternative, retained utilities and static deployment together.

## Structures

### What a visitor lands on

#### L · Room homepage

**In one line.** A first-person visit to Isaac's room, with the preserved personal page one link away.

**What it does.** Explore the bedroom and connected bathroom at toy height. The approved layout uses a 70-inch desk and a queen mattress as scale anchors, with the corrected window cabinet, sneaker wall, desk-mounted monitor and accessible bathroom route. Mimi and Charlie roam, loaf and use their cat furniture. Visitors can inspect objects, read Isaac's existing Me, Experience and company content, raise the desk, adjust lights, play local lo-fi or house music, and make an optional three-shot postcard.

**How it's built.** `index.html` owns the public root route and loads same-origin `/room/` scripts, styles and curated media. `/room/viewer.js` renders the static GLB through a small WebGL viewer and supports navigation, collision, reflections, lighting, cats and desk motion. The page links to `/about/` for the accessible, readable editorial alternative. Content panels fetch `/about/` rather than duplicating its biography and work copy.

**Steps in execution.**

1. **Load** — Show the entry overlay while the room GLB and cat models load.
2. **Enter** — Explore from toy height with keyboard/touch controls and optional pointer capture.
3. **Inspect** — Use nearby shoes, collectibles, the workstation and cats to open detail panels.
4. **Play** — Call or pet cats, hop onto furniture, set music and lights, and move the standing desk.
5. **Read or save** — Open /about/ for the full site, or complete the optional three-photo postcard.

**Questions.**

- ~~**Q-L1** Which page is the homepage?~~ ✓ The user chose the room at /, while the earlier editorial page remains at /about/ (2026-09-22).

#### A · About page

**In one line.** The earlier personal homepage survives intact as the readable content source.

**What it does.** Me → Experience → My company, followed by Isaac's personal contact footer. The original portrait, Tinder and Nextdoor experience, Berkeley education and FIRSTUNIT company section remain. Visitors can read it directly without loading or navigating the 3D room.

**How it's built.** `about/index.html` has an exact /about/ canonical, uses `/css/personal.css` and `/js/personal.js`, and keeps the pre-paint theme IIFE. Its `#about`, `#experience`, legacy `#work`, `#firstunit` and `#contact` anchors receive utility-page links. `/room/portfolio.js` fetches this public page on demand and extracts the existing copy, portrait and links for room stories and the monitor.

**Steps in execution.**

1. **Read** — Serve the original editorial content at /about/.
2. **Reuse** — Room stories and monitor draw from its content.
3. **Return** — The personal-name link leads back to the playable room at /.

#### P · /photo/ redirect

**In one line.** A preserved permanent redirect from the former photo page to FIRSTUNIT Studios.

**What it does.** Requests to /photo or /photo/ reach the existing FIRSTUNIT Studios record. There is no photo/index.html. The retained pricing page has its own separate route; the room's optional postcard activity does not change this redirect.

**How it's built.** Two `vercel.json` redirect rules use `permanent: true` and point to `https://firstunit.io/fu-0001`. Vercel currently returns **HTTP 308** for both. The redirected path is excluded from the sitemap. The external retired domain `capturedbyip.com` returns HTTP 301 directly to the same destination (verified 2026-09-11); its configuration is outside this repository.

**Steps in execution.**

1. **Request** — GET /photo or /photo/ reaches Vercel.
2. **Redirect** — Return HTTP 308 with Location: https://firstunit.io/fu-0001.
3. **Land** — The destination renders FIRSTUNIT Studios.

**Questions.**

- ~~**Q-P1** Does capturedbyip.com still take two hops through /photo/?~~ ✓ No. Live verification found capturedbyip.com returning HTTP 301 directly to https://firstunit.io/fu-0001. This repository separately retains its /photo redirects for older inbound links (2026-09-11).

#### R · Pricing page

**In one line.** A retained pricing utility page, available by its existing URL.

**What it does.** Four existing packages and their add-ons, booking explanation, and quote CTAs remain intact. The new room homepage does not change the offers.

**How it's built.** `photo/pricing/index.html` continues to load `/css/site.css`, `/css/photo.css` and `/js/site.js`. Its four visible prices and `OfferCatalog` JSON-LD must remain in step. Existing FIRSTUNIT practice copy and wordmark remain on this retained utility page. Every quote CTA mails `hello@firstunit.io` with the package in the subject. Me, Experience, company and contact links target the corresponding `/about/#` anchors; Home returns to the room at /.

**Steps in execution.**

1. **Serve** — A direct or indexed visit receives /photo/pricing/index.html.
2. **Read** — The four packages and existing add-ons render with the shared utility styles.
3. **Quote** — Each CTA opens a mail to hello@firstunit.io with its own package in the subject.

**Questions.**

- ~~**Q-R1** Should removing homepage pricing promotion delete or rebrand the pricing page?~~ ✓ No. The user approved retaining every sitemap route and keeping this utility page functional but unpromoted. A later relocation or offer change is separate work (2026-09-11).

#### D · ShootSort page

**In one line.** A retained public ShootSort download page at its existing URL.

**What it does.** Existing visitors can still read the card-ingest promise, folder structure and system requirements, then download the macOS app.

**How it's built.** `shootsort/index.html` retains `/css/site.css`, its page-scoped style block and `/js/site.js`. Download buttons target the public `github.com/IsaacAPerez/ShootSort-releases/releases/latest/download/ShootSort.zip` endpoint. The source repository remains outside this site. Section links navigate to `/about/#` anchors; Home returns to the room at /.

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

**How it's built.** `roommate/{privacy,terms,support}/index.html` and `souvenir/privacy/index.html`. They are the only pages on `/css/legal.css` — the tokens, reset and base type of the fleet design system, without the 76% of it (buttons, cards, navs, heroes, device frames, utilities) these pages never render — a different token set (`--color-accent: #0071e3`, `--space-*`) from the rest of the site — plus the `.legal-*` layout itself, which moved into that file once it turned out all four pages carried the same 106 lines inline. Only Souvenir keeps a page-local `<style>` block, for the table, `<pre>`, `hr`, `code` and `h3` rules it alone needs. Absolute asset paths, canonical links to their exact URLs, no JS beyond the theme pre-paint IIFE. **The path is permanent**: the app renamed RoommateApp → Crib → Quarters and `/roommate/` stayed. Two of the four are renderings, not originals: `/souvenir/privacy/` comes from `~/Coding/Souvenir/docs/privacy.md`, and `/roommate/support/` deliberately summarises and links to `thequarters.app/support` (the URL App Store Connect actually declares) rather than forking that FAQ.

**Steps in execution.**

1. **Serve** — Vercel returns the directory index for /roommate/privacy/, /roommate/terms/, /roommate/support/ or /souvenir/privacy/.
2. **Style** — legal.css provides the tokens and the shared .legal-* layout; only Souvenir adds a page-local block.
3. **Read** — Static prose — collection, use, storage, choices, children, changes, contact.
4. **Exit** — One footer link back to isaacperez.co.

**Questions.**

- ~~**Q-Q1** Should these move to `/quarters/` now that the app has its final name?~~ ✓ No. App Store metadata and external systems point at the existing URLs; AGENTS.md marks the path permanent and allows only copy renames — and a rename must match `\bCrib\b` case-sensitively, a precaution the rename commit 85c58c1 records because a case-insensitive replace would mangle the word "describes" in the privacy policy (2026-08-24).

### What runs in the browser

#### M · Room runtime

**In one line.** Small, same-origin browser scripts make the static room explorable.

**What it does.** A native WebGL viewer loads the room and cat GLBs. Separate scripts own cat routes, play interactions, desk movement, mirror and monitor surfaces, object details, original Web Audio music and toy sounds, and the optional photo adventure. The editorial page still has its own scroll behavior.

**How it's built.** The root loads `/room/viewer.js` with `renderer-math.js`, `room-config.js` and feature IIFEs under `/room/`. The viewer culls out-of-view meshes, limits its frame work to 60 Hz on desktop or 30 Hz on compact and touch screens, and redraws mirrors only when needed. The object inspector caches its scene targets and the cats use bounded route data. The approved enclosure stays fixed. `portfolio.js` fetches `/about/` on first story use. `/about/` loads `/js/personal.js` for its native reveals; pricing and ShootSort retain `/js/site.js`. No framework or third-party script is required.

**Steps in execution.**

1. **Load geometry** — Read static GLBs for the room, Mimi and Charlie.
2. **Navigate** — Render first-person movement, toy hopping, collisions and reflections.
3. **Interact** — Use nearby objects, the moving desk, cats, music and light controls.
4. **Read content** — Fetch /about/ for the monitor and story panels.
5. **Capture** — Use the live rendered scene for optional postcard photos.

#### T · Mood controls

**In one line.** Visitor-controlled lighting and local music make the room feel lived in.

**What it does.** Day, Warm and Night presets plus separate daylight, bedroom, bathroom and warmth sliders adjust the actual scene. The original lo-fi and house tracks are synthesized in the browser, with play/pause and volume controls; toy steps and interactions make local sounds. The editorial /about/ page separately retains its saved light/dark theme.

**How it's built.** `/room/room-audio.js` uses Web Audio, without streamed tracks or remote requests; it reuses fixed-position panners and gain nodes and releases finished source handlers. `/room/interface.js` exposes music and light controls; `/room/viewer.js` updates scene lights and mirror captures. Entry is a visitor gesture for audio startup. Hidden-tab and reduced-motion handling suspend sound or animated movement as appropriate. The existing pre-paint theme script and `localStorage["theme"]` continue on /about/ and utility pages.

**Steps in execution.**

1. **Enter** — Start quiet local music after visitor action.
2. **Choose** — Switch lo-fi or house, adjust volume or pause.
3. **Relight** — Apply a preset or change individual light sliders.
4. **Respect preferences** — Pause on hidden tabs and keep reduced-motion behavior optional.

#### S · Browser storage

**In one line.** The room needs no account or backend; theme is the existing saved preference.

**What it does.** The optional photo adventure keeps captures in the current page, then builds a downloadable postcard image in the browser. It does not upload a visitor's photos. The editorial and utility pages continue to remember the light/dark theme locally.

**How it's built.** `/room/photo-safari.js` captures the current WebGL canvas, stores the three shots in memory and composes a JPEG data URL for download. No analytics, account or application backend is involved. `localStorage["theme"]` remains active for /about/ and utility pages; historic game keys remain dormant.

**Steps in execution.**

1. **Frame** — Check each subject's position and visibility in the current room.
2. **Capture** — Keep three live-rendered shots in page memory.
3. **Compose** — Generate a downloadable postcard locally.
4. **Theme** — Leave the existing saved editorial preference intact.

### What ships with the page

#### C · Stylesheets

**In one line.** The room and editorial page each own their interface styling.

**What it does.** Room styles live under /room/ for the full-scene canvas, floating controls and detail panels. The earlier editorial design moves with its page to /about/ and keeps the original portrait treatment. Utility and legal styles remain separate.

**How it's built.** `/room/styles.css` and feature-specific room styles own the homepage interface. `/css/personal.css` serves /about/, preserving the portrait's rounded mask and reduced-motion handling. `/css/site.css` serves utility pages; pricing adds `/css/photo.css`, and legal pages use `/css/legal.css`. ShootSort and 404 retain their scoped blocks.

**Steps in execution.**

1. **Room** — Load /room/ styles for canvas controls and panels.
2. **About** — Use /css/personal.css for the readable editorial page.
3. **Utilities** — Keep existing site, photo and legal styles separate.

#### I · Room media and images

**In one line.** Curated public 3D assets and a short film ship separately from private references.

**What it does.** The room GLB and separate Mimi/Charlie GLBs supply live geometry. A short self-hosted Seedance 2.5 material-study film offers a cinematic view; it is not the navigable scene. The original portrait remains on /about/. Original multi-angle room and close-up reference photos are not published as a gallery.

**How it's built.** Public assets are committed under `/room/` and fetched same-origin. The photos, editable Blender scene, generation provenance and local reference-panel server remain under `docs/room-preview/` or Isaac's Downloads and are excluded by `.vercelignore`. Exact filename case still matters on Vercel; the unlinked old `Resume.pdf` remains withheld.

**Steps in execution.**

1. **Load** — Fetch the room and two cat GLBs from /room/.
2. **Watch** — Play the optional self-hosted film on request.
3. **Protect** — Keep source photos and provenance out of the public bundle.
4. **Verify case** — Check changed asset references against exact filenames.

#### E · External services and links

**In one line.** The game loads its media from this origin; outbound links remain ordinary navigation.

**What it does.** The WebGL assets, material-study film and original music use no third-party runtime service. /room/portfolio.js fetches /about/ from the same origin. Inter is self-hosted for utility pages. Company and personal contact links remain ordinary navigation.

**How it's built.** The CSP grants `font-src 'self'` and `connect-src 'self'`, allowing the room's same-origin fetches while refusing third-party scripts. Its inline-script hashes continue to cover the /about/ pre-paint and Person graph plus existing utility-page blocks; `tools/check-site.sh` detects drift. Visiting FIRSTUNIT navigates to another site; it is not an embedded dependency. There is no streamed music or external video player.

**Steps in execution.**

1. **Load** — Serve GLBs, film, scripts and styles from this origin.
2. **Reuse content** — Fetch /about/ for the room's portfolio panels.
3. **Navigate out** — Follow company or contact links only when the visitor chooses.
4. **Keep scope** — Do not add analytics, tag managers or external players.

### How it gets live

#### H · Fleet commit hooks

**In one line.** The one gate in the whole pipeline — a badly-worded commit message is refused before anything ships.

**What it does.** This repo borrows the fleet's shared git hooks. A commit whose subject is not a Conventional Commit is rejected outright; a commit that passes gets logged into the CodeByIP dashboard feed.

**How it's built.** `core.hooksPath` points at `/Users/isaacperez/Coding/platform/scripts/hooks`. `commit-msg` enforces Conventional Commits. `post-commit` logs into the CodeByIP activity feed on a best-effort basis; the shared Swift-lint pre-commit hook has no Swift source to lint here. Preview and explicit production approval remain separate from these hooks.

**Steps in execution.**

1. **Write the message** — Use type(scope): subject, such as feat(site): launch the room homepage.
2. **Run hooks** — Commit normally; do not use --no-verify without explicit permission.
3. **Review preview** — Verify the room, /about/ and retained utility routes before production publication.
4. **Publish when approved** — A push to main triggers Vercel.

**Questions.**

- ~~**Q-H1** Does this repository need a new CI or build pipeline for the personal homepage?~~ ✓ No. The approved implementation remains vanilla static HTML/CSS/JS; Vercel git integration is the deployment pipeline (2026-09-11).

#### V · Vercel

**In one line.** The host watches main and serves the files not withheld by .vercelignore.

**What it does.** There is no build. Vercel clones the repo, serves the files as they are, gives each directory an extensionless URL, and terminates TLS on the apex domain. Pushing to main is publishing.

**How it's built.** Vercel project `isaacperez`, root `.`, serves GitHub `IsaacAPerez/IsaacPerez.co`; project and team ids stay in the dashboard. `vercel.json` has response headers and two permanent photo redirects, with no build command or rewrites. `.vercelignore` withholds repo-only files including `docs/room-preview/`, original references, `Resume.pdf` and `tools/`; curated `/room/` runtime files are public. The custom `404.html` handles unknown URLs. Git push to main publishes production after preview approval.

**Steps in execution.**

1. **Preview** — Review the room at /, editorial fallback at /about/ and utilities locally.
2. **Push approved main** — Vercel receives the git update.
3. **Serve files** — The repository tree supplies the static output.
4. **Route** — Root serves the room, /about/ serves editorial, and /photo returns HTTP 308.
5. **Verify** — Check changed content, utility pages and redirects after publication.

**Questions.**

- ~~**Q-V1** Does /photo/ still correspond to an HTML file?~~ ✓ No. The file is removed and vercel.json returns HTTP 308 to https://firstunit.io/fu-0001. The existing rule is preserved by the personal-site redesign (2026-09-11).

#### O · Discovery surface

**In one line.** The room and preserved editorial page have distinct canonical public URLs.

**What it does.** The sitemap, robots file, per-page canonicals, share metadata and pricing OfferCatalog remain. The seven existing routes stay; /about/ becomes the eighth listed page.

**How it's built.** `sitemap.xml` lists the room at `/`, editorial page at `/about/`, pricing, ShootSort, Souvenir privacy and the three Quarters pages. `/photo/` is excluded because it redirects. `404.html` is excluded and marked noindex. The room and editorial page each use their exact canonical; existing utility URLs remain unchanged.

**Steps in execution.**

1. **Add** — List /about/ alongside the seven retained URLs.
2. **Canonicalize** — Point / and /about/ to their own exact production URLs.
3. **Share** — Keep page-specific Open Graph and Twitter metadata.
4. **Audit** — Compare sitemap paths, real pages and intentional redirects.

**Questions.**

- ~~**Q-O1** Does moving the editorial page to /about/ remove pricing, ShootSort or legal URLs from the sitemap?~~ ✓ No. The seven earlier URLs remain and /about/ is added as the eighth; homepage format and route existence are separate decisions (2026-09-22).

## Flows (representative packets)

Payload shapes are what the design implies, not measured traffic.

### A first room visit

| # | From → To | Packet | Representative payload |
|---|---|---|---|
| 1 | L → V | GET / | `{"path":"/","accept":"text/html"}` |
| 2 | V → L | 200 room homepage | `{"entry":"toy-eye-level","build":"none"}` |
| 3 | L → C | room styles | `{"sheet":"/room/styles.css"}` |
| 4 | L → I | room and cat GLBs | `{"base":"/room/"}` |
| 5 | L → M | room scripts | `{"src":"/room/viewer.js","defer":true}` |
| 6 | M → T | music and lighting | `{"music":["lofi","house"],"lights":["day","warm","night"]}` |
| 7 | M → A | portfolio content | `{"fetch":"/about/"}` |

### A retained utility-page visit

| # | From → To | Packet | Representative payload |
|---|---|---|---|
| 1 | R → V | GET /photo/pricing/ | `{"path":"/photo/pricing/"}` |
| 2 | V → R | 200 pricing page | `{"preserved":true}` |
| 3 | R → C | utility styles | `{"links":["/css/site.css","/css/photo.css"]}` |
| 4 | R → M | utility script | `{"src":"/js/site.js"}` |
| 5 | R → A | editorial sections | `{"nav":["/about/#about","/about/#experience","/about/#firstunit"],"contact":"/about/#contact"}` |
| 6 | R → L | room home | `{"href":"/"}` |

### Publishing an approved change

| # | From → To | Packet | Representative payload |
|---|---|---|---|
| 1 | H → V | git push origin main | `{"subject":"feat(site): launch the room homepage","previewApproved":true}` |
| 2 | V → L | serve room | `{"path":"/"}` |
| 3 | V → A | serve editorial | `{"path":"/about/"}` |
| 4 | V → P | preserve photo redirect | `{"status":308,"destination":"https://firstunit.io/fu-0001"}` |
| 5 | V → R | preserve pricing | `{"path":"/photo/pricing/"}` |
| 6 | V → D | preserve download page | `{"path":"/shootsort/"}` |
| 7 | V → Q | preserve legal pages | `{"count":4}` |
| 8 | V → O | update discovery | `{"sitemapPages":8}` |

## Questions — index

Reference by ID. ✓ resolved (with date) · otherwise open.

- ~~**Q-L1**~~ (L) ✓ The user chose the room at /, while the earlier editorial page remains at /about/ (2026-09-22).
- ~~**Q-P1**~~ (P) ✓ No. Live verification found capturedbyip.com returning HTTP 301 directly to https://firstunit.io/fu-0001. This repository separately retains its /photo redirects for older inbound links (2026-09-11).
- ~~**Q-R1**~~ (R) ✓ No. The user approved retaining every sitemap route and keeping this utility page functional but unpromoted. A later relocation or offer change is separate work (2026-09-11).
- **Q-D1** (D) The page claims Apple silicon + macOS 14 and a notarized build, taken from `dist/appcast.xml` and the README. Nothing re-checks that when ShootSort ships a release — should the requirements line be generated, or is a page that only changes when the app's floor changes fine as prose?
- ~~**Q-Q1**~~ (Q) ✓ No. App Store metadata and external systems point at the existing URLs; AGENTS.md marks the path permanent and allows only copy renames — and a rename must match `\bCrib\b` case-sensitively, a precaution the rename commit 85c58c1 records because a case-insensitive replace would mangle the word "describes" in the privacy policy (2026-08-24).
- ~~**Q-H1**~~ (H) ✓ No. The approved implementation remains vanilla static HTML/CSS/JS; Vercel git integration is the deployment pipeline (2026-09-11).
- ~~**Q-V1**~~ (V) ✓ No. The file is removed and vercel.json returns HTTP 308 to https://firstunit.io/fu-0001. The existing rule is preserved by the personal-site redesign (2026-09-11).
- ~~**Q-O1**~~ (O) ✓ No. The seven earlier URLs remain and /about/ is added as the eighth; homepage format and route existence are separate decisions (2026-09-22).

## What the platform gives vs what we own

**Platform gives:** Vercel provides git integration on <code>main</code>, TLS, CDN delivery, directory-style URLs and a custom 404 without an application build. <code>vercel.json</code> carries response headers and permanent redirects for <code>/photo</code> and <code>/photo/</code>. <code>.vercelignore</code> withholds the source/prototype and original references under <code>docs/</code>; curated runtime files under <code>/room/</code> ship. GitHub stores the source; fleet hooks supply Conventional Commit enforcement and activity-feed logging. The room's GLBs, film and sound synthesis load from this origin without a backend, analytics, CDN, streaming service or GitHub Actions workflow. Machine-level monitoring is managed outside this repo.

**We own:** The playable room homepage, preserved /about/ editorial page, retained pricing and download pages, four legal-style pages, custom 404, self-hosted room assets and scripts, page-specific styles, redirect configuration and discovery metadata.

## Planned filesystem

```
IsaacPerez.co/
  index.html            first-person room homepage; links to /about/
  room/                 public room scripts, styles, GLBs and short film
  about/index.html      prior Me → Experience → My company page
  css/
    personal.css        /about/ editorial layout and reveals
    site.css            shared utility-page styling and base tokens
    photo.css           /photo/pricing/ only
    legal.css           four legal-style pages
  js/
    personal.js         /about/ theme and one-time scroll reveals
    site.js             retained utility-page motion and theme behavior
  photo/
    (no index.html; /photo and /photo/ return 308 via vercel.json)
    pricing/index.html  retained pricing and OfferCatalog
  shootsort/index.html  retained macOS download page
  roommate/             Quarters privacy, terms and support pages
  souvenir/privacy/     rendered from Souvenir/docs/privacy.md
  404.html              custom not-found page
  isaac.JPG  isaac.avif  original portrait, now displayed at /about/
  fonts/                self-hosted Inter; JetBrains Mono is repo-only
  Resume.pdf            old résumé, retained, unlinked and not deployed
  sitemap.xml  robots.txt  vercel.json
  tools/check-site.sh   repo-only static-site guard
  .vercelignore         repo-only files withheld from deployment
  docs/room-preview/    source/prototype and provenance; excluded from Vercel
  docs/atlas/           data.mjs → atlas.html + SYSTEM.md; repo-only
```

## How this file is maintained

Generated from `docs/atlas/data.mjs` by `node docs/atlas/build.mjs`, which also builds the interactive atlas (`atlas.html`). Edit the data file, rebuild, republish — never edit this file by hand.
