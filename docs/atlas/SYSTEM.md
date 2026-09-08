# IsaacPerez.co — System Definition

_**This file is the living source of truth for the shape of isaacperez.co.** The interactive atlas is built from the same data._

_Question status: **3 open · 11 resolved**._

## One paragraph

IsaacPerez.co is Isaac's personal brand site: eight public URLs of hand-written static
HTML with no package.json, no bundler, no tests and no CI. The landing page carries the work,
experience and contact sections; /photo/pricing/ is the photo-and-film
practice, folded in from its own domain in August 2026; /shootsort/ is the download page for the
macOS card organizer; and four legal-style pages serve two iOS apps — /roommate/{privacy,terms,support}
for Quarters and /souvenir/privacy/ for Souvenir. The one piece of real engineering is
js/game.js — a ~1,700-line canvas game called "Isaac's Studio" that overlays the landing page and
lets a visitor walk a home office and press E on 23 exhibits that are the portfolio. Everything
ships as files: a push to main is a production deploy, because Vercel's git integration is the
whole pipeline — the only config in the tree is vercel.json, a response-headers block.

## Decisions locked

| Axis | Decision | ADR |
|---|---|---|
| Runtime | Vanilla HTML/CSS/JS, one IIFE per file. No package.json, no bundler, no framework, no node_modules — the repo tree IS the site. | — |
| Hosting | Vercel's git integration on `main` is the entire pipeline; a push to main is a production deploy with no staging gate. | — |
| Theme | `data-theme` on the root `html` element, persisted to `localStorage['theme']`, applied by an inline pre-paint IIFE in every page's `head` before the stylesheets. | — |
| Asset paths | `index.html` uses relative paths (`css/site.css`); every nested page — and `404.html`, which is served for a bad URL at any depth — uses absolute paths (`/css/design-system.css`). | — |
| Motion | Every animation branches on a `REDUCED` flag (`site.js:7`, `game.js:19`) or a `prefers-reduced-motion` media query. | — |
| Legal URLs | `/roommate/privacy/` and `/roommate/terms/` are permanent — App Store metadata points at them; the app renamed RoommateApp → Crib → Quarters, the path did not. `/roommate/support/` and `/souvenir/privacy/` joined them on 2026-09-02. | — |
| Photo brand | capturedbyip.com folded into `/photo/` and `/photo/pricing/` (commit 9ab8851, 2026-08-08); the CBIP theme was dropped and both pages rebuilt on this site's own tokens. On 2026-09-07 the CapturedByIP name retired into FIRSTUNIT, the company Isaac founded: `/photo/` became a 301 to `firstunit.io/fu-0001` (vercel.json `redirects`), `/photo/pricing/` stayed as a FIRSTUNIT practice page with the frozen wordmark on a band at its base. | — |
| FIRSTUNIT | The landing page presents FIRSTUNIT as the company behind the products: a `#firstunit` section between Work and the camera section (inline-SVG wordmark on a solid band, never live type), a `FU—00NN` code link and the fixed line `A FIRSTUNIT PRODUCT` on every product card. This site stays personal and links out to firstunit.io. | — |
| Commits | Conventional Commits enforced by the fleet `commit-msg` hook — `core.hooksPath` points at `~/Coding/platform/scripts/hooks`, shared with the other 11 fleet repos. | — |

## Cost model

## Reading order (the atlas chapters)

1. **A page and a host** — Strip it all away and this is the product: one hand-written HTML file, and a host that serves it exactly as committed. _(adds L, V)_
2. **What the page pulls in** — Style, pictures and type — three kinds of thing the landing page asks for once it arrives. _(adds C, I, E)_
3. **Making it feel alive** — Two small scripts and three keys in your own browser are the entire client-side runtime. _(adds M, T, S)_
4. **Step inside the office** — The one piece of real engineering: a walkable pixel studio where the furniture is the portfolio. _(adds G, A)_
5. **The photo brand moves in, then moves on** — capturedbyip.com became two pages here, and a month later the name retired into FIRSTUNIT. _(adds P, R, O)_
6. **A page per product** — Every work card should end somewhere. ShootSort was the one that did not. _(adds D)_
7. **The pages that cannot move** — Four legal documents two App Store listings point at, and the one gate every change has to pass. _(adds Q, H)_
8. **The road not taken** — One stylesheet in the repo belongs to a version of this site that never shipped. _(adds X)_
9. **The whole system** — Everything at once, for free exploration.

## Structures

### What a visitor lands on

#### L · Landing page

**In one line.** The front door at isaacperez.co — who Isaac is, what he has built, and how to reach him.

**What it does.** One long scrolling page: hero, a one-line statement, seven work cards (six of them carrying a FIRSTUNIT project code and the `A FIRSTUNIT PRODUCT` line), the FIRSTUNIT company section with the wordmark on a band, the photo-and-film section, a skills marquee, two jobs, an about block with the real photo, and a contact row. A button in the footer opens the playable office over the top of it.

**How it's built.** `index.html`, 427 lines, hand-written. Sections are `<section class="sec-pad" id="...">` anchored to the nav (`#work`, `#firstunit`, `#experience`, `#about`, `#contact`). It links `css/site.css` and `css/game.css` relatively, then loads `js/site.js` and `js/game.js` with `defer`. Two scripts are inlined in the page itself: the theme pre-paint IIFE in `<head>` and the achievement engine before the closing body tag. **Everything is one file** — there is no template, include, or partial.

**Steps in execution.**

1. **Pre-paint theme** — The inline head IIFE reads localStorage["theme"] and stamps data-theme on the root html element before any stylesheet parses, so there is no flash.
2. **Paint** — site.css and game.css load; the hero renders; the office overlay sits hidden behind #gameRoot.
3. **Deferred scripts** — site.js wires reveals, parallax and the theme button; game.js builds the room map and bakes its art whether or not you ever open it.
4. **Scroll** — IntersectionObserver adds .in to every [data-reveal]; a rAF frame drives hero parallax, nav hide/show and the statement word-fill.
5. **Opt in to the office** — The footer #playGameBtn (or the #office hash) calls openOverlay() and the canvas takes over the viewport.

**Questions.**

- **Q-L1** Every landing-page visit downloads and boots `js/game.js` (94 KB) plus `css/game.css`, and `rebuildArt()` bakes the whole room to offscreen canvases at init — even for a visitor who never opens the office. Worth deferring the bake to `openOverlay()`?

#### P · /photo/ redirect

**In one line.** Where the CapturedByIP page used to be — now a 301 to the photo and film practice at firstunit.io/fu-0001.

**What it does.** No page. A visitor who lands on /photo/ (from the retired capturedbyip.com, an old link, or a search result) is sent to the FIRSTUNIT record for the practice. The five showreels and the ProfessionalService JSON-LD went with the page on 2026-09-07; the pricing page kept its own OfferCatalog with FIRSTUNIT as the provider.

**How it's built.** Two entries in the `redirects` array of `vercel.json` — `/photo` and `/photo/`, both `permanent: true`, both to `https://firstunit.io/fu-0001`. `photo/index.html` is deleted, `/photo/` is out of `sitemap.xml`, and every in-tree link that pointed at it (nav, footer, 404, the office's camera exhibit) points at the firstunit.io record instead. **Vercel evaluates redirects before the filesystem**, so the rule would win even if the file came back.

**Steps in execution.**

1. **Request** — GET /photo/ (or /photo) reaches Vercel.
2. **Redirect** — The vercel.json rule answers 308/301 with Location: https://firstunit.io/fu-0001.
3. **Land** — firstunit.io serves the FU—0001 project page — the practice, the films, the work.

**Questions.**

- **Q-P1** capturedbyip.com still 301s to `isaacperez.co/photo/` (the other repo's vercel.json), which now 301s again to firstunit.io. Two hops is fine for a browser, but should the CapturedByIP stub be repointed straight at `firstunit.io/fu-0001`?

#### R · Pricing page

**In one line.** What a shoot costs — four packages, written straight into the markup.

**What it does.** Sports Coverage from $300 (flagged "Most booked"), Real Estate Content from $250, Lifestyle & Brand from $400, Drone-Only from $200 — each with an includes list, and every one but Drone-Only with priced add-ons — then an always-included section, a common add-ons table, and a three-step booking explainer.

**How it's built.** `photo/pricing/index.html`. Prices live in the HTML and, since 2026-09-02, in the page's own `OfferCatalog` JSON-LD, which must be edited with them: the merge commit deliberately collapsed the old two-source setup (markup plus a `PRICING_CONFIG` object) down to **markup alone**, values unchanged. Styling is `/css/site.css` + `/css/photo.css` (`.ph-price`, `.ph-addon`); the only script is `/js/site.js`. Since 2026-09-07 the page is framed as a FIRSTUNIT practice — hero eyebrow, JSON-LD provider — and ends on the frozen FIRSTUNIT wordmark (inline SVG on a solid `.fu-band`) linking to `firstunit.io/fu-0001`; that band is the page's one attribution.

**Steps in execution.**

1. **Serve** — Vercel returns photo/pricing/index.html at /photo/pricing/.
2. **Render packages** — Four <article class="ph-price"> cards in .ph-price-grid, the first flagged .ph-price--featured.
3. **Render add-ons** — .ph-addons blocks on the Sports, Real Estate and Lifestyle cards only — Drone-Only goes straight from .ph-price-body to .ph-price-foot — plus a shared #addons section.
4. **Close** — The three .ph-step cards in #booking and the contact block send the visitor back to /#contact.

**Questions.**

- ~~**Q-R1** The pricing page ships no JSON-LD while `/photo/` does — four priced packages are invisible to search as `Offer`/`PriceSpecification`. Intentional, or an oversight from the merge?~~ ✓ An oversight, now closed. The page carries an `OfferCatalog` with four `Offer` entries, each with a `PriceSpecification` `minPrice` (the cards say "From", so minPrice rather than price), hung off the existing service by `"provider": { "@id": ".../photo/#business" }` so the two blocks describe one business. Prices live in the markup AND in the block — keep them in step (2026-09-02). Since 2026-09-07 the provider is an inline `Organization` named FIRSTUNIT, because the `/photo/` page that declared the ProfessionalService is gone.

#### D · ShootSort page

**In one line.** The download page for the macOS card organizer — the one work card that used to link nowhere.

**What it does.** A hero with the download button, the promise the whole app rests on ("it never touches the card"), the folder shape a shoot lands in, and three capability points. The landing page's ShootSort card now points here.

**How it's built.** `shootsort/index.html`, served at `/shootsort/`. Absolute asset paths: `/css/site.css` plus a page-scoped `<style>` block (no new stylesheet for one page), and `/js/site.js` for the shared reveals and theme toggle. The download points at the **public mirror**, `github.com/IsaacAPerez/ShootSort-releases/releases/latest/download/ShootSort.zip` — the source repo `IsaacAPerez/ShootSort` is private and its own README link 404s anonymously. There are no screenshots because ShootSort ships no product imagery in-tree.

**Steps in execution.**

1. **Serve** — Vercel returns shootsort/index.html for the extensionless /shootsort/ URL.
2. **Style** — site.css supplies the tokens; the page block adds the promise card, the tree and the three-cell grid.
3. **Download** — The hero and closing buttons hit the ShootSort-releases "latest" redirect, so a new release needs no edit here.
4. **Hand back** — Footer and CTA return to /, /#work and /#contact.

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

- ~~**Q-Q1** Should these move to `/quarters/` now that the app has its final name?~~ ✓ No. App Store metadata and external systems point at the existing URLs; CLAUDE.md marks the path permanent and allows only copy renames — and a rename must match `\bCrib\b` case-sensitively, a precaution the rename commit 85c58c1 records because a case-insensitive replace would mangle the word "describes" in the privacy policy (2026-08-24).

### What runs in the browser

#### G · Isaac's Studio

**In one line.** A walkable pixel home office layered over the landing page, where the furniture is the portfolio.

**What it does.** Press "Explore my office" and a canvas takes the screen. You walk with WASD or a thumbstick, press E next to anything, and a typewriter dialog opens: the phones on the console are the shipped apps, the framed prints are the jobs, the shelf gadgets are the skills, the printer points you at the Experience section. A Roomba wanders, a cat follows you, a drone unlocks, and a mini-fridge hides a taco.

**How it's built.** One IIFE in `js/game.js`, 1,700 lines, no dependencies. A 40×26 tile map is built into a `Uint8Array` by `buildMap()`, then `bakeAtlas()`/`bakeWorld()` paint the whole room once into offscreen canvases; the frame loop only blits. `ENTITIES` is a 50-item array — 23 of them `core: true`, which is what the progress bar counts. A fixed-step loop (`STEP = 1/60`) drives `update()` and `render()`; audio is a tiny **oscillator synth** created on first gesture. `window.__ipGame` exposes `step`, `tp`, `inspect` and a `snapshot` getter for QA.

**Steps in execution.**

1. **Boot** — At load: buildMap() writes the tile grid, rebuildArt() reads the palette and bakes the atlas, character rigs and the world canvas.
2. **Open** — openOverlay() adds .active to #gameRoot and .game-active to the body element; the start screen offers Step Inside, Back to the site, or a shortcut to the Experience section.
3. **Play** — startGame() starts the rAF loop — update() moves the player, the Roomba, the cat and the drone; render() blits the baked world then sorts entities by screen-Y.
4. **Interact** — E (or a tap within ~2.2 tiles) picks the nearest non-decor entity, plays a blip, opens the typewriter dialog and marks it visited.
5. **Persist** — markVisited() writes the visited set to localStorage["ip-game-state"] and calls window.unlock() for that entity group.
6. **Exit** — ESC or the HUD ✕ cancels the rAF, clears held keys, closes the dialog and hands the page back to the site.

**Questions.**

- ~~**Q-G1** The 🏆 HUD button exits the office and calls `scrollIntoView` on `#achievements` — but no element with that id exists anywhere in the repo, so it silently falls back to `window.scrollTo(0, 0)`. Add an achievements section to the landing page, or make the button just close the office?~~ ✓ Neither — the badges now render _inside_ the office. `openAchievements()` fills the existing `#gameDialog` with all nine badges, locked and unlocked, headed "N / 8 unlocked"; the visitor never leaves the room. The badge table comes from `window.__ipAch`, published by the achievement engine in index.html, with a fallback copy in game.js. No landing-page section was added — that would have grown an unmeasured surface (2026-09-02).
- ~~**Q-G2** Three guards skip an entity id `shrine_taco` that no longer exists in `ENTITIES`, while `wall_cracked` (the mini-fridge) is filtered out once `state.vaultOpen` is true — so the fridge can only ever be opened once per browser and its `else sfx("blip")` branch is unreachable. Was a second secret meant to take its place?~~ ✓ The three dead `shrine_taco` guards are gone (2026-09-02); they protected an id with no definition, so they never matched. The mini-fridge behaviour was left exactly as it is — one opening per browser is the intended secret, and a second one is a design question for Isaac, not a cleanup.
- ~~**Q-G3** `sessionStorage["ip-game-skip"]` is written on every exit and cleared on re-entry but is never read anywhere — a leftover from when the office was the landing experience instead of an opt-in. Remove it, or wire it back up?~~ ✓ Removed (2026-09-02). Nothing read it; the office is opt-in now, so there is no "skip" state worth remembering. `exitGame()` just tears the overlay down and `#playGameBtn` calls `openOverlay` directly.

#### M · Site motion

**In one line.** The small script that makes the pages feel alive as you scroll.

**What it does.** Sections fade up as they enter view, the hero drifts and blurs as you leave it, the nav hides on the way down and returns on the way up, the statement sentence lights word by word, and anchor links glide instead of jumping.

**How it's built.** `js/site.js`, 132 lines, one ES5-style IIFE (`var`, not `const`). Reveals use an `IntersectionObserver` at `threshold: 0.12` that unobserves after firing. Scroll work is coalesced into a single `requestAnimationFrame` callback behind a `ticking` flag on a passive listener. The statement is split into `<span class="word">` nodes at boot so opacity can be driven per word. **Every effect is gated** on `REDUCED` (`site.js:7`) — under reduced motion the reveals are simply added, and nothing parallaxes.

**Steps in execution.**

1. **Read the preference** — REDUCED = matchMedia("(prefers-reduced-motion: reduce)").matches, computed once.
2. **Wire reveals** — Either add .in to every [data-reveal] immediately (reduced) or observe them.
3. **Split the statement** — Walk #statementText and wrap each word in a span so the scroll fill can address it.
4. **Drive the frame** — One rAF frame per scroll/resize: nav state, hero parallax, about-photo drift, word fill.
5. **Smooth anchors** — Intercept every a[href^="#"], offset 56px for the fixed nav, and use behavior:"auto" under reduced motion.

#### T · Theme switch

**In one line.** Light or dark, chosen once and remembered across every page and the office.

**What it does.** The sun/moon button in the nav flips the theme. The choice sticks in the browser, applies before the first paint on every page so nothing flashes, and the office re-paints its artwork to match.

**How it's built.** Three cooperating pieces. (1) An inline IIFE in each page's `<head>`, before the stylesheets, reads `localStorage["theme"]` and sets `data-theme` on `<html>`. (2) `js/site.js` toggles the attribute and writes it back, seeding from `prefers-color-scheme` on a first visit so the first click always visibly flips. (3) `js/game.js` watches with a `MutationObserver` on `data-theme` and calls `rebuildArt()`, re-baking the atlas, the rigs and the whole world canvas. CSS answers on `:root`, `:root[data-theme="dark"]` and a `prefers-color-scheme` block guarded by `:not([data-theme="light"])`.

**Steps in execution.**

1. **Pre-paint** — The head IIFE stamps data-theme before any stylesheet parses — no flash of the wrong theme.
2. **Toggle** — The nav button computes the next value (explicit value inverts; unset falls back to the opposite of the system preference) and writes localStorage["theme"].
3. **Restyle** — Every stylesheet re-resolves its custom properties from the new :root block.
4. **Re-bake** — The office's MutationObserver fires rebuildArt() so the baked room matches the new palette.
5. **Reward** — The inline achievement engine unlocks "Day / Night Shifter" on the first toggle.

**Questions.**

- ~~**Q-T1** Every other localStorage access is try/catch-wrapped for Safari private mode; the pre-paint IIFEs call `getItem` bare. Bug?~~ ✓ Deliberate. CLAUDE.md rules that the inline pre-paint script stays verbatim in `<head>` before the stylesheets — never externalized, never deferred — because it exists to prevent FOUC (2026-08-24).

#### A · Achievements

**In one line.** Eight badges that pop as a visitor explores — readable any time from the HUD — plus a hidden cheat code that does not count toward the total.

**What it does.** Read the app phones, the framed jobs, the shelf, the contact console — each group pops a toast the first time. Toggling the theme counts. Touring every exhibit fires confetti and a fanfare. And the old arrow-arrow-B-A cheat code still does something. "Stepped Inside" lands the moment the office opens, so the HUD counter can reach 8 of 8.

**How it's built.** An inline IIFE at the bottom of `index.html`, not a file. It owns a nine-entry table (emoji + label), reads and writes `localStorage["ip-achievements"]`, and publishes `window.unlock(id)`, which builds a `.toast` node into `#toastStack` and removes it after 4.6s. `js/game.js` calls it through `gUnlock()` from `markVisited()`, mapping `e.group` (`project`, `crystal`, `study`, `contact`, `statue`) to a badge, and from `openOverlay()` for `adventurer`, while `index.html` itself unlocks only `shifter` and `konami` — eight countable ids plus `konami`. `syncAchCount()` filters `konami` out and renders **n/8**, a counter that now tops out at a real 8/8. A second Konami listener lives here on `window`, in parallel with the game's own — `unlock()` de-dupes. The table is also published as `window.__ipAch` so the game's 🏆 panel can render it.

**Steps in execution.**

1. **Rehydrate** — Parse localStorage["ip-achievements"] into a Set inside a try/catch.
2. **Publish** — Expose window.unlock(id) so the game (and the theme button) can call it without importing anything.
3. **Award** — On a new id: add, persist, and append a toast to #toastStack.
4. **Count** — game.js syncAchCount() re-reads the store, drops konami, and writes "n/8" into the HUD — 8/8 is the ceiling.
5. **Review** — The 🏆 HUD button calls openAchievements(), which renders the whole table into #gameDialog — unlocked badges lit, the rest under a lock, konami flagged as a bonus — without leaving the office.
6. **Complete** — When all 23 core exhibits are visited the game unlocks completionist, bursts particles and plays the fanfare — once, guarded by state.confetti.

**Questions.**

- ~~**Q-A1** `adventurer` (🚪 "Stepped Inside") is defined in the badge table at `index.html:376` but nothing ever calls `unlock('adventurer')` — `js/game.js` only unlocks quests / statcheck / lorekeeper / raven / historian / completionist / konami, and `index.html` adds shifter. Since `syncAchCount()` counts against a literal 8, the HUD can never read 8/8. Award it on the first `openOverlay()`, or drop the entry and count against 7?~~ ✓ Wired, not dropped: `openOverlay()` now calls `gUnlock('adventurer')` just before its existing `syncAchCount()`. Opening the office — via the "Explore my office" button or the `#office` deep link — is literally "Stepped Inside", so the badge has the trigger its emoji and label already implied, and the literal 8 becomes honest at 8 awardable ids (2026-08-24).

#### S · Browser storage

**In one line.** The only database this site has: three keys in the visitor's own browser.

**What it does.** The site remembers your theme, which badges you have earned, and how far you got in the office — nothing leaves the machine, and there is no account, no server and no analytics anywhere on the site.

**How it's built.** `localStorage["theme"]` (`"light"`/`"dark"`), `localStorage["ip-achievements"]` (a JSON array of badge ids) and `localStorage["ip-game-state"]` — the object built by `loadState()`: `visited[]`, `vaultOpen`, `vaultFound`, `chestOpened`, `drone`, `muted`, `confetti`. (`sessionStorage["ip-game-skip"]` was removed on 2026-09-02 — nothing ever read it.) Every read and write in `js/site.js`, `js/game.js` and the inline achievement engine is wrapped in `try/catch` for **Safari private mode**; only the pre-paint theme reads are bare, by rule.

**Steps in execution.**

1. **Read at boot** — The head IIFE reads theme; game.js loadState() merges the saved object over defaults; the achievement engine parses its array.
2. **Write on change** — Theme on toggle, ip-achievements on each new badge, ip-game-state on visit / fridge / drone / mute / confetti.
3. **Fail soft** — Any throw is swallowed — the site works with storage disabled, it just forgets.
4. **Never leave** — No fetch, no XHR, no beacon, no analytics SDK exists anywhere in the repo.

### What ships with the page

#### C · Stylesheets

**In one line.** Four live stylesheets, each owning exactly one kind of page — and one that owns nothing.

**What it does.** The landing page, the office overlay, the photo pages and the legal pages each have their own sheet. They are never mixed: picking the wrong one is how a page ends up looking like a different site. A one-off page keeps its handful of extra rules in a page-scoped style block instead of widening a shared sheet.

**How it's built.** `css/site.css` (386 lines) is the landing page and the token source — `:root`, `:root[data-theme="dark"]`, and a `prefers-color-scheme` block. `css/game.css` (543) is the overlay and deliberately declares **its own tokens** on `#gameRoot, .toast-stack` so it never depends on the site sheet. `css/photo.css` (206) layers `.ph-*` classes on top of site.css and is loaded only by the two `/photo/` pages. `css/design-system.css` (1,328) is a separate token system used only by the four legal-style pages (`/roommate/{privacy,terms,support}/`, `/souvenir/privacy/`). `/shootsort/` and `404.html` ride on site.css plus a page-scoped `<style>` block. `css/rpg.css` is loaded by nothing.

**Steps in execution.**

1. **site.css** — Tokens, nav, hero, work cards, experience, about, contact, footer — plus the reduced-motion block.
2. **game.css** — Overlay chrome: start screen, HUD, dialog, joystick, toast stack, with its own light/dark tokens.
3. **photo.css** — Hero stats, service grid, embed frames, price cards — additive over site.css tokens.
4. **design-system.css** — A full independent token set (--color-*, --space-*, --text-*) for the legal pages only.
5. **page-scoped <style>** — The legal pages, /shootsort/ and 404.html each carry their own block — one page, a handful of rules, no shared sheet widened.

#### I · Images & documents

**In one line.** The photos, app icons, logos and résumé the pages point at — committed straight into the repo.

**What it does.** Five app icons for the work cards, the two employer logos, Isaac's real photo and real résumé PDF, and the site favicon. There is no image pipeline: what is committed is what is served.

**How it's built.** `images/` holds `curbside-icon.png`, `runsbyip-icon.png`, `kangskuisine-icon.png`, `quarters-icon.png`, `teamup-icon-new.png`. Root holds `isaac.JPG` (also the `og:image` and `twitter:image` on all three marketing pages), `Resume.pdf`, `favicon.svg`, `ndLogo.webp`, `tinderLogo.png`. Two rules bite here: images are optimized _in place_ before commit (icons ≲105 KB, photos ≲200 KB — the existing files define the budget), and references must match on-disk case exactly, because macOS is case-insensitive and **Vercel is not** — the hero really is `isaac.JPG`.

**Steps in execution.**

1. **Reference** — index.html uses relative src (images/*.png, isaac.JPG); nested pages use absolute (/favicon.svg).
2. **Lazy-load** — Every below-the-fold img carries loading="lazy".
3. **Optimize in place** — Resize/compress keeping the same filename so no reference has to change.
4. **Case-check** — Diff every src/href against ls before committing — a wrong case renders locally and 404s in production.

#### E · Third-party embeds

**In one line.** The only two outside services the pages actually call: Google Fonts and YouTube.

**What it does.** Type comes from Google Fonts on the three marketing pages; the two legal pages call nobody and fall back to a system font stack. The five showreels on the photo page are YouTube players in privacy-enhanced mode. That is the complete list of external requests — no analytics, no tag manager, no CDN scripts.

**How it's built.** One `<link>` to `fonts.googleapis.com/css2` for Space Grotesk, Inter and JetBrains Mono, preceded by two `preconnect` hints, on `index.html`, `photo/index.html` and `photo/pricing/index.html` — and on those three only. `roommate/privacy/index.html` and `roommate/terms/index.html` carry no font link and no preconnect at all; they resolve type through `--font-sans` in `css/design-system.css`, an `-apple-system` stack. The showreels are five `<iframe src="https://www.youtube-nocookie.com/embed/<id>">` with `loading="lazy"` inside `.ph-work-item`. CLAUDE.md holds the line: no new external dependency beyond **the existing Google Fonts links** without a conversation — and since 2026-09-02 the `vercel.json` CSP enforces exactly that list: `fonts.googleapis.com` for styles, `fonts.gstatic.com` for faces, `www.youtube-nocookie.com` for frames, `'self'` for everything else. A new origin now needs a header change as well as a conversation.

**Steps in execution.**

1. **Preconnect** — index.html, /photo/ and /photo/pricing/ each open early connections to fonts.googleapis.com and fonts.gstatic.com; the two legal pages open none.
2. **Fetch faces** — One css2 request per marketing page pulls three families; every rule falls back to -apple-system / system-ui — which is all the legal pages ever use.
3. **Embed reels** — youtube-nocookie iframes load lazily only on /photo/.
4. **Stop there** — No other origin is contacted from any page in the repo.

### How it gets live

#### H · Fleet commit hooks

**In one line.** The one gate in the whole pipeline — a badly-worded commit message is refused before anything ships.

**What it does.** This repo borrows the fleet's shared git hooks. A commit whose subject is not a Conventional Commit is rejected outright; a commit that passes gets logged into the CodeByIP dashboard feed.

**How it's built.** `core.hooksPath` is set to `/Users/isaacperez/Coding/platform/scripts/hooks`, shared with the other eleven fleet repos. `commit-msg` is pure bash: it lets `Merge`/`Revert`/`fixup!`/`squash!`/empty through, then requires `^(feat|fix|chore|refactor|docs|test|perf|build|ci|revert)(\(scope\))?!?: subject`. `post-commit` shells `~/Coding/CodeByIP/Backend/luka-log.py` best-effort. `pre-commit` is the Swift lint and **no-ops here**. Almost every commit in this repo's history predates the 2026-06-25 hook and would be rejected today — never imitate the old log style.

**Steps in execution.**

1. **Write the message** — type(scope): subject — e.g. fix(game): point the CapturedByIP exhibit at /photo/.
2. **commit-msg** — The bash regex accepts or rejects; --no-verify is the only bypass, and needs explicit permission.
3. **pre-commit** — The shared Swift-lint hook finds nothing to lint in a repo with no Swift and exits clean.
4. **post-commit** — The commit is logged to the CodeByIP activity feed, failures ignored.
5. **Push** — git push origin main — which is also the deploy.

**Questions.**

- ~~**Q-H1** Does this repo have CI, a runner, or any release workflow?~~ ✓ No, by design. There is no package.json, no .github/ directory and no self-hosted runner for IsaacPerez.co (the eight runners on this Mac cover other repos). Vercel's git integration is the entire pipeline, and CLAUDE.md forbids adding tooling to "fix" it (2026-08-24).

#### V · Vercel

**In one line.** The host: it watches main, and whatever is in the tree becomes the live site.

**What it does.** There is no build. Vercel clones the repo, serves the files as they are, gives each directory an extensionless URL, and terminates TLS on the apex domain. Pushing to main is publishing.

**How it's built.** Vercel project `isaacperez`, id `prj_sSFEIZN5xWUB25tlxb7MxXUADcmZ`, org `team_kglkY3kYg639waIJAEOnAyuQ`, root directory `.` — recorded in the gitignored `.vercel/repo.json`, linked to GitHub `IsaacAPerez/IsaacPerez.co`. The repo carries a `vercel.json` with **headers only** — no build command, no rewrites, no redirects: CSP, X-Content-Type-Options, X-Frame-Options, Referrer-Policy and Permissions-Policy on `/(.*)` (added 2026-09-02). The CLI at `/opt/homebrew/bin/vercel` exists for a manual `vercel --prod`, but that path is discouraged — `git push origin main` is the deploy, and there is no staging gate in front of it.

**Steps in execution.**

1. **Push** — git push origin main.
2. **Build** — Nothing to build — Vercel takes the tree as the output directory.
3. **Route** — photo/index.html becomes /photo/, roommate/terms/index.html becomes /roommate/terms/.
4. **Serve** — Static files over the CDN on https://isaacperez.co with TLS.
5. **Verify** — curl -s https://isaacperez.co | grep <changed-text> — the whole post-deploy check.

**Questions.**

- ~~**Q-V1** Nothing in this repo redirects the retired `capturedbyip.com` to `/photo/`. Is that handled in the Vercel dashboard or at DNS, and does it need writing down somewhere in-tree?~~ ✓ It lives in the OTHER repo: `~/Coding/CapturedByIP/vercel.json` redirects `/(.*)` → `https://isaacperez.co/photo/` (301, commits 84c3fc5 / 6561464, 2026-08-08), so that project is now a redirect-only stub. Nothing to add here beyond this note; this repo's own vercel.json carries response headers only (2026-09-02).

#### O · Discovery surface

**In one line.** How search engines and link previews see the site — seven URLs, seven canonicals, two rich cards.

**What it does.** A sitemap listing every public URL, a fully-open robots file, a canonical link on every page, Open Graph and Twitter cards for the shareable pages, and one structured-data block describing the photo practice.

**How it's built.** `sitemap.xml` holds seven `<loc>` entries (eight until `/photo/` became a redirect on 2026-09-07): `/` (1.0), `/photo/pricing/` (0.7), `/shootsort/` (0.6), `/souvenir/privacy/`, `/roommate/privacy/`, `/roommate/terms/` and `/roommate/support/` (0.3). `404.html` is deliberately absent and carries `robots: noindex`. `robots.txt` is `Allow: /` plus the sitemap pointer. Every page carries a `<link rel="canonical">` to its exact `https://isaacperez.co/` production URL; `index.html` and `/photo/pricing/` add `og:*` and `twitter:*` tags pointing at `isaac.JPG`. The JSON-LD is the `OfferCatalog` on `/photo/pricing/`, whose provider is an inline FIRSTUNIT `Organization`. The standing rule: **sitemap and canonical move in the same commit** as any page add or remove.

**Steps in execution.**

1. **Add a page** — New page lands at <path>/index.html with an absolute-path stylesheet link.
2. **Canonicalize** — It gets a canonical link tag pointing at its exact production URL.
3. **List it** — sitemap.xml gains the loc entry in the same commit; existing entries stay untouched.
4. **Check** — Grepping the loc entries out of sitemap.xml is the audit — they should match the set of real directories.

**Questions.**

- ~~**Q-O1** CLAUDE.md still says the sitemap holds "currently exactly `/`, `/roommate/privacy/`, `/roommate/terms/`", but it has held five URLs since the `/photo/` merge on 2026-08-08. The operating manual needs that line refreshed — should it name the URLs at all, or just point at the grep?~~ ✓ Just the grep. CLAUDE.md now says the grep IS the list and refuses to hard-code it, precisely because the list drifted twice (3 → 5 → 8). The same commit refreshed the stale line count and the CSS-role line that never mentioned photo.css (2026-09-02).

### Not yet switched on (designed for, not built)

#### X · RPG redesign _(not switched on)_

**In one line.** Designed for, not switched on: a whole RPG-styled skin for the site, written and then never linked to anything.

**What it does.** An earlier direction for the site — a fantasy/RPG treatment of the portfolio — got a complete stylesheet and was abandoned the next day. The current playable office is what the idea turned into instead. The file is still in the repo and is loaded by no page.

**How it's built.** `css/rpg.css`, 1,139 lines, added in commit `776549e` and orphaned a day later. Grepping every HTML page and both JS files for `rpg` returns nothing — it is dead weight in the deploy but costs nothing at runtime because **no page links it**. CLAUDE.md lists it explicitly under mistakes: do not link it, refactor it, or delete it.

**Steps in execution.**

1. **Written** — A full alternate skin lands in one commit.
2. **Orphaned** — The direction changes the next day; no stylesheet link is ever added.
3. **Kept** — It ships with every deploy, unreferenced, as a deliberate archive.

**Questions.**

- ~~**Q-X1** Delete it, or wire it up as an alternate theme?~~ ✓ Neither, without asking. CLAUDE.md rules it off-limits: never link, refactor, or delete css/rpg.css unless Isaac explicitly asks for it (2026-08-24).

## Flows (representative packets)

Payload shapes are what the design implies, not measured traffic.

### A first visit

| # | From → To | Packet | Representative payload |
|---|---|---|---|
| 1 | L → V | GET https://isaacperez.co/ | `{"path":"/","accept":"text/html"}` |
| 2 | V → L | 200 index.html | `{"file":"index.html","bytes":24252,"build":"none"}` |
| 3 | L → E | fonts css2 | `{"families":["Space Grotesk","Inter","JetBrains Mono"],"display":"swap"}` |
| 4 | L → C | stylesheets | `{"links":["css/site.css","css/game.css"]}` |
| 5 | L → I | images | `{"src":["isaac.JPG","images/teamup-icon-new.png"],"loading":"lazy"}` |
| 6 | S → T | saved theme | `{"key":"theme","value":"dark"}` |
| 7 | T → L | data-theme on :root | `{"attr":"data-theme","value":"dark","prePaint":true}` |
| 8 | L → M | scroll | `{"y":640,"reveal":"[data-reveal]","reduced":false}` |

### Stepping into the office

| # | From → To | Packet | Representative payload |
|---|---|---|---|
| 1 | L → G | Explore my office | `{"trigger":"#playGameBtn","hash":"#office"}` |
| 2 | G → S | load saved run | `{"key":"ip-game-state"}` |
| 3 | S → G | restored state | `{"visited":11,"drone":true,"muted":false,"vaultFound":false}` |
| 4 | G → A | unlock badge | `{"id":"quests","from":"cab_curbside","group":"project"}` |
| 5 | A → S | persist badges | `{"key":"ip-achievements","count":4}` |
| 6 | T → G | theme changed → re-bake | `{"attr":"data-theme","value":"light","action":"rebuildArt()"}` |

### Shipping a change

| # | From → To | Packet | Representative payload |
|---|---|---|---|
| 1 | H → V | git push origin main | `{"subject":"fix(photo): tighten the pricing copy","hook":"commit-msg ok"}` |
| 2 | V → L | deploy / | `{"url":"https://isaacperez.co/"}` |
| 3 | V → P | deploy /photo/ | `{"url":"https://isaacperez.co/photo/"}` |
| 4 | V → Q | deploy /roommate/* | `{"urls":["/roommate/privacy/","/roommate/terms/","/roommate/support/"]}` |
| 5 | V → D | deploy /shootsort/ | `{"url":"https://isaacperez.co/shootsort/"}` |
| 6 | V → O | sitemap + robots live | `{"locs":8,"robots":"Allow: /"}` |

## Questions — index

Reference by ID. ✓ resolved (with date) · otherwise open.

- **Q-L1** (L) Every landing-page visit downloads and boots `js/game.js` (94 KB) plus `css/game.css`, and `rebuildArt()` bakes the whole room to offscreen canvases at init — even for a visitor who never opens the office. Worth deferring the bake to `openOverlay()`?
- **Q-P1** (P) capturedbyip.com still 301s to `isaacperez.co/photo/` (the other repo's vercel.json), which now 301s again to firstunit.io. Two hops is fine for a browser, but should the CapturedByIP stub be repointed straight at `firstunit.io/fu-0001`?
- ~~**Q-R1**~~ (R) ✓ An oversight, now closed. The page carries an `OfferCatalog` with four `Offer` entries, each with a `PriceSpecification` `minPrice` (the cards say "From", so minPrice rather than price), hung off the existing service by `"provider": { "@id": ".../photo/#business" }` so the two blocks describe one business. Prices live in the markup AND in the block — keep them in step (2026-09-02). Since 2026-09-07 the provider is an inline `Organization` named FIRSTUNIT, because the `/photo/` page that declared the ProfessionalService is gone.
- **Q-D1** (D) The page claims Apple silicon + macOS 14 and a notarized build, taken from `dist/appcast.xml` and the README. Nothing re-checks that when ShootSort ships a release — should the requirements line be generated, or is a page that only changes when the app's floor changes fine as prose?
- ~~**Q-Q1**~~ (Q) ✓ No. App Store metadata and external systems point at the existing URLs; CLAUDE.md marks the path permanent and allows only copy renames — and a rename must match `\bCrib\b` case-sensitively, a precaution the rename commit 85c58c1 records because a case-insensitive replace would mangle the word "describes" in the privacy policy (2026-08-24).
- ~~**Q-G1**~~ (G) ✓ Neither — the badges now render _inside_ the office. `openAchievements()` fills the existing `#gameDialog` with all nine badges, locked and unlocked, headed "N / 8 unlocked"; the visitor never leaves the room. The badge table comes from `window.__ipAch`, published by the achievement engine in index.html, with a fallback copy in game.js. No landing-page section was added — that would have grown an unmeasured surface (2026-09-02).
- ~~**Q-G2**~~ (G) ✓ The three dead `shrine_taco` guards are gone (2026-09-02); they protected an id with no definition, so they never matched. The mini-fridge behaviour was left exactly as it is — one opening per browser is the intended secret, and a second one is a design question for Isaac, not a cleanup.
- ~~**Q-G3**~~ (G) ✓ Removed (2026-09-02). Nothing read it; the office is opt-in now, so there is no "skip" state worth remembering. `exitGame()` just tears the overlay down and `#playGameBtn` calls `openOverlay` directly.
- ~~**Q-T1**~~ (T) ✓ Deliberate. CLAUDE.md rules that the inline pre-paint script stays verbatim in `<head>` before the stylesheets — never externalized, never deferred — because it exists to prevent FOUC (2026-08-24).
- ~~**Q-A1**~~ (A) ✓ Wired, not dropped: `openOverlay()` now calls `gUnlock('adventurer')` just before its existing `syncAchCount()`. Opening the office — via the "Explore my office" button or the `#office` deep link — is literally "Stepped Inside", so the badge has the trigger its emoji and label already implied, and the literal 8 becomes honest at 8 awardable ids (2026-08-24).
- ~~**Q-H1**~~ (H) ✓ No, by design. There is no package.json, no .github/ directory and no self-hosted runner for IsaacPerez.co (the eight runners on this Mac cover other repos). Vercel's git integration is the entire pipeline, and CLAUDE.md forbids adding tooling to "fix" it (2026-08-24).
- ~~**Q-V1**~~ (V) ✓ It lives in the OTHER repo: `~/Coding/CapturedByIP/vercel.json` redirects `/(.*)` → `https://isaacperez.co/photo/` (301, commits 84c3fc5 / 6561464, 2026-08-08), so that project is now a redirect-only stub. Nothing to add here beyond this note; this repo's own vercel.json carries response headers only (2026-09-02).
- ~~**Q-O1**~~ (O) ✓ Just the grep. CLAUDE.md now says the grep IS the list and refuses to hard-code it, precisely because the list drifted twice (3 → 5 → 8). The same commit refreshed the stale line count and the CSS-role line that never mentioned photo.css (2026-09-02).
- ~~**Q-X1**~~ (X) ✓ Neither, without asking. CLAUDE.md rules it off-limits: never link, refactor, or delete css/rpg.css unless Isaac explicitly asks for it (2026-08-24).

## What the platform gives vs what we own

**Platform gives:** Vercel hosts the repo directly — git integration on <code>main</code>, TLS on the apex
domain, the CDN, and extensionless URLs for directory-style pages — with no build command in the repo
and a <code>vercel.json</code> that carries response headers only (CSP, nosniff, X-Frame-Options,
Referrer-Policy, Permissions-Policy). GitHub stores the source. The fleet platform repo supplies the git hooks this
repo points at via <code>core.hooksPath</code> → <code>~/Coding/platform/scripts/hooks</code>:
<code>commit-msg</code> (Conventional Commits) and <code>post-commit</code> (logs the commit into the
CodeByIP dashboard feed). Google Fonts serves the three type families; youtube-nocookie.com serves the
five showreel embeds. That is the entire outside world the pages talk to — there is no Supabase project,
no API, no runner, no launchd job and no GitHub Actions workflow for this repo. Two of Isaac's
machine-level crontab entries do reach it from outside the tree: <code>product-audit.sh</code> reads its
git log every Monday, and <code>uptime-sentinel.sh</code> polls the deployed site every 30 minutes.

**We own:** Every byte the browser renders: eight hand-written HTML pages plus a 404, five stylesheets, two JS files
(a 132-line motion layer and the ~1,700-line canvas game), the achievement engine inlined in
index.html, the theme system, the image and document assets, and the discovery surface
(sitemap.xml, robots.txt, canonicals, Open Graph, one JSON-LD block).

## Planned filesystem

```
IsaacPerez.co/
  index.html            landing page + inline theme pre-paint + achievement engine
  css/
    site.css            landing-page theme + tokens (:root / [data-theme])
    game.css            the office overlay chrome (its own tokens)
    photo.css           /photo/pricing/ only
    design-system.css   /roommate/ legal pages only
    rpg.css             abandoned redesign — zero references
  js/
    site.js             reveal, parallax, nav, theme toggle, anchor scroll
    game.js             "Isaac's Studio" canvas game (50 entities, 23 exhibits)
  photo/
    (index.html gone — /photo/ is a 301 to firstunit.io/fu-0001 in vercel.json)
    pricing/index.html  four packages, add-ons, booking + Offer JSON-LD
  shootsort/index.html  the macOS card organizer — download + how it files
  roommate/
    privacy/index.html  Quarters privacy policy
    terms/index.html    Quarters terms
    support/index.html  Quarters support — summary + link to the canonical page
  souvenir/
    privacy/index.html  Souvenir privacy policy (rendered from Souvenir/docs/privacy.md)
  404.html              styled not-found, served by Vercel for any bad URL
  images/               5 app icons (curbside, runsbyip, kangskuisine, quarters, teamup)
  isaac.JPG  Resume.pdf  favicon.svg  ndLogo.webp  tinderLogo.png
  sitemap.xml  robots.txt  vercel.json  CLAUDE.md
  .vercel/              gitignored — project prj_sSFEIZN5xWUB25tlxb7MxXUADcmZ
```

## How this file is maintained

Generated from `docs/atlas/data.mjs` by `node docs/atlas/build.mjs`, which also builds the interactive atlas (`atlas.html`). Edit the data file, rebuild, republish — never edit this file by hand.
