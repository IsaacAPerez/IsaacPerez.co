// IsaacPerez.co — system atlas source of truth.
// Build: node docs/atlas/build.mjs  → writes docs/atlas/SYSTEM.md + docs/atlas/atlas.html
// Every claim here is grounded in the repo: index.html, js/, css/, photo/, roommate/,
// sitemap.xml, .vercel/repo.json, CLAUDE.md, and ~/Coding/platform/scripts/products.json.

export const META = {
  title: 'IsaacPerez.co',
  outDir: '.',
  artifactUrl: '',
  sourcePath: 'docs/atlas/data.mjs',
  buildCmd: 'node docs/atlas/build.mjs',
  stats: [{ k: 'Product', v: 'isaac-perez-co · static' }, { k: 'Public URLs', v: '8' }],
  intro: `_**This file is the living source of truth for the shape of isaacperez.co.** The interactive atlas is built from the same data._`,
  onePara: `IsaacPerez.co is Isaac's personal brand site: eight public URLs of hand-written static
HTML with no package.json, no bundler, no tests and no CI. The landing page carries the work,
experience and contact sections; /photo/pricing/ is the photo-and-film
practice, folded in from its own domain in August 2026; /shootsort/ is the download page for the
macOS card organizer; and four legal-style pages serve two iOS apps — /roommate/{privacy,terms,support}
for Quarters and /souvenir/privacy/ for Souvenir. The one piece of real engineering is
js/game.js — a ~1,700-line canvas game called "Isaac's Studio" that overlays the landing page and
lets a visitor walk a home office and press E on 23 exhibits that are the portfolio. Everything
ships as files: a push to main is a production deploy, because Vercel's git integration is the
whole pipeline — the only config in the tree is vercel.json, a response-headers block.`,
  costModel: [],
  deepDive: '',
  platformGives: `Vercel hosts the repo directly — git integration on <code>main</code>, TLS on the apex
domain, the CDN, and extensionless URLs for directory-style pages — with no build command in the repo
and a <code>vercel.json</code> that carries response headers only (CSP, nosniff, X-Frame-Options,
Referrer-Policy, Permissions-Policy). GitHub stores the source. The fleet platform repo supplies the git hooks this
repo points at via <code>core.hooksPath</code> → <code>~/Coding/platform/scripts/hooks</code>:
<code>commit-msg</code> (Conventional Commits) and <code>post-commit</code> (logs the commit into the
CodeByIP dashboard feed). Google Fonts serves the three type families; youtube-nocookie.com serves the
five showreel embeds. That is the entire outside world the pages talk to — there is no Supabase project,
no API, no runner, no launchd job and no GitHub Actions workflow for this repo. Two of Isaac's
machine-level crontab entries do reach it from outside the tree: <code>product-audit.sh</code> reads its
git log every Monday, and <code>uptime-sentinel.sh</code> polls the deployed site every 30 minutes.`,
  weOwn: `Every byte the browser renders: eight hand-written HTML pages plus a 404, five stylesheets, two JS files
(a 132-line motion layer and the ~1,700-line canvas game), the achievement engine inlined in
index.html, the theme system, the image and document assets, and the discovery surface
(sitemap.xml, robots.txt, canonicals, Open Graph, one JSON-LD block).`,
  filesystem: `IsaacPerez.co/
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
  .vercel/              gitignored — project prj_sSFEIZN5xWUB25tlxb7MxXUADcmZ`,
};

export const DECISIONS = [
  { axis: 'Runtime', decision: 'Vanilla HTML/CSS/JS, one IIFE per file. No package.json, no bundler, no framework, no node_modules — the repo tree IS the site.', adr: '—' },
  { axis: 'Hosting', decision: "Vercel's git integration on `main` is the entire pipeline; a push to main is a production deploy with no staging gate.", adr: '—' },
  { axis: 'Theme', decision: "`data-theme` on the root `html` element, persisted to `localStorage['theme']`, applied by an inline pre-paint IIFE in every page's `head` before the stylesheets.", adr: '—' },
  { axis: 'Asset paths', decision: '`index.html` uses relative paths (`css/site.css`); every nested page — and `404.html`, which is served for a bad URL at any depth — uses absolute paths (`/css/design-system.css`).', adr: '—' },
  { axis: 'Motion', decision: 'Every animation branches on a `REDUCED` flag (`site.js:7`, `game.js:19`) or a `prefers-reduced-motion` media query.', adr: '—' },
  { axis: 'Legal URLs', decision: '`/roommate/privacy/` and `/roommate/terms/` are permanent — App Store metadata points at them; the app renamed RoommateApp → Crib → Quarters, the path did not. `/roommate/support/` and `/souvenir/privacy/` joined them on 2026-09-02.', adr: '—' },
  { axis: 'Photo brand', decision: 'capturedbyip.com folded into `/photo/` and `/photo/pricing/` (commit 9ab8851, 2026-08-08); the CBIP theme was dropped and both pages rebuilt on this site\'s own tokens. On 2026-09-07 the CapturedByIP name retired into FIRSTUNIT, the company Isaac founded: `/photo/` became a 301 to `firstunit.io/fu-0001` (vercel.json `redirects`), `/photo/pricing/` stayed as a FIRSTUNIT practice page with the frozen wordmark on a band at its base.', adr: '—' },
  { axis: 'FIRSTUNIT', decision: 'The landing page presents FIRSTUNIT as the company behind the products: a `#firstunit` section between Work and the camera section (inline-SVG wordmark on a solid band, never live type), a `FU—00NN` code link and the fixed line `A FIRSTUNIT PRODUCT` on every product card. This site stays personal and links out to firstunit.io.', adr: '—' },
  { axis: 'Commits', decision: 'Conventional Commits enforced by the fleet `commit-msg` hook — `core.hooksPath` points at `~/Coding/platform/scripts/hooks`, shared with the other 11 fleet repos.', adr: '—' },
];

export const GROUPS = [
  { id: 'pages', title: 'What a visitor lands on' },
  { id: 'runtime', title: 'What runs in the browser' },
  { id: 'assets', title: 'What ships with the page' },
  { id: 'ship', title: 'How it gets live' },
  { id: 'off', title: 'Not yet switched on' },
];

export const NODES = [
  // ---------------- pages ----------------
  {
    id: 'L', code: 'L', name: 'Landing page', short: 'LANDING PAGE', group: 'pages',
    gx: 0.5, gy: 8, w: 2.5, d: 2.5, h: 40, kind: 'screen',
    one: 'The front door at isaacperez.co — who Isaac is, what he has built, and how to reach him.',
    what: 'One long scrolling page: hero, a one-line statement, seven work cards (six of them carrying a FIRSTUNIT project code and the `A FIRSTUNIT PRODUCT` line), the FIRSTUNIT company section with the wordmark on a band, the photo-and-film section, a skills marquee, two jobs, an about block with the real photo, and a contact row. A button in the footer opens the playable office over the top of it.',
    how: '<code>index.html</code>, 427 lines, hand-written. Sections are <code>&lt;section class="sec-pad" id="..."&gt;</code> anchored to the nav (<code>#work</code>, <code>#firstunit</code>, <code>#experience</code>, <code>#about</code>, <code>#contact</code>). It links <code>css/site.css</code> and <code>css/game.css</code> relatively, then loads <code>js/site.js</code> and <code>js/game.js</code> with <code>defer</code>. Two scripts are inlined in the page itself: the theme pre-paint IIFE in <code>&lt;head&gt;</code> and the achievement engine before the closing body tag. <mark>Everything is one file</mark> — there is no template, include, or partial.',
    steps: [
      ['Pre-paint theme', 'The inline head IIFE reads localStorage["theme"] and stamps data-theme on the root html element before any stylesheet parses, so there is no flash.'],
      ['Paint', 'site.css and game.css load; the hero renders; the office overlay sits hidden behind #gameRoot.'],
      ['Deferred scripts', 'site.js wires reveals, parallax and the theme button; game.js builds the room map and bakes its art whether or not you ever open it.'],
      ['Scroll', 'IntersectionObserver adds .in to every [data-reveal]; a rAF frame drives hero parallax, nav hide/show and the statement word-fill.'],
      ['Opt in to the office', 'The footer #playGameBtn (or the #office hash) calls openOverlay() and the canvas takes over the viewport.'],
    ],
    cond: [
      { q: 'Every landing-page visit downloads and boots <code>js/game.js</code> (94 KB) plus <code>css/game.css</code>, and <code>rebuildArt()</code> bakes the whole room to offscreen canvases at init — even for a visitor who never opens the office. Worth deferring the bake to <code>openOverlay()</code>?' },
    ],
  },
  {
    id: 'P', code: 'P', name: '/photo/ redirect', short: 'PHOTO → FU—0001', group: 'pages',
    gx: 0.5, gy: 11, w: 2.5, d: 2, h: 16, kind: 'box',
    one: 'Where the CapturedByIP page used to be — now a 301 to the photo and film practice at firstunit.io/fu-0001.',
    what: 'No page. A visitor who lands on /photo/ (from the retired capturedbyip.com, an old link, or a search result) is sent to the FIRSTUNIT record for the practice. The five showreels and the ProfessionalService JSON-LD went with the page on 2026-09-07; the pricing page kept its own OfferCatalog with FIRSTUNIT as the provider.',
    how: 'Two entries in the <code>redirects</code> array of <code>vercel.json</code> — <code>/photo</code> and <code>/photo/</code>, both <code>permanent: true</code>, both to <code>https://firstunit.io/fu-0001</code>. <code>photo/index.html</code> is deleted, <code>/photo/</code> is out of <code>sitemap.xml</code>, and every in-tree link that pointed at it (nav, footer, 404, the office\'s camera exhibit) points at the firstunit.io record instead. <mark>Vercel evaluates redirects before the filesystem</mark>, so the rule would win even if the file came back.',
    steps: [
      ['Request', 'GET /photo/ (or /photo) reaches Vercel.'],
      ['Redirect', 'The vercel.json rule answers 308/301 with Location: https://firstunit.io/fu-0001.'],
      ['Land', 'firstunit.io serves the FU—0001 project page — the practice, the films, the work.'],
    ],
    cond: [
      { q: 'capturedbyip.com still 301s to <code>isaacperez.co/photo/</code> (the other repo\'s vercel.json), which now 301s again to firstunit.io. Two hops is fine for a browser, but should the CapturedByIP stub be repointed straight at <code>firstunit.io/fu-0001</code>?' },
    ],
  },
  {
    id: 'R', code: 'R', name: 'Pricing page', short: 'PRICING', group: 'pages',
    gx: 3.5, gy: 11, w: 2.5, d: 2, h: 36, kind: 'screen',
    one: 'What a shoot costs — four packages, written straight into the markup.',
    what: 'Sports Coverage from $300 (flagged "Most booked"), Real Estate Content from $250, Lifestyle & Brand from $400, Drone-Only from $200 — each with an includes list, and every one but Drone-Only with priced add-ons — then an always-included section, a common add-ons table, and a three-step booking explainer.',
    how: '<code>photo/pricing/index.html</code>. Prices live in the HTML and, since 2026-09-02, in the page\'s own <code>OfferCatalog</code> JSON-LD, which must be edited with them: the merge commit deliberately collapsed the old two-source setup (markup plus a <code>PRICING_CONFIG</code> object) down to <mark>markup alone</mark>, values unchanged. Styling is <code>/css/site.css</code> + <code>/css/photo.css</code> (<code>.ph-price</code>, <code>.ph-addon</code>); the only script is <code>/js/site.js</code>. Since 2026-09-07 the page is framed as a FIRSTUNIT practice — hero eyebrow, JSON-LD provider — and ends on the frozen FIRSTUNIT wordmark (inline SVG on a solid <code>.fu-band</code>) linking to <code>firstunit.io/fu-0001</code>; that band is the page\'s one attribution.',
    steps: [
      ['Serve', 'Vercel returns photo/pricing/index.html at /photo/pricing/.'],
      ['Render packages', 'Four <article class="ph-price"> cards in .ph-price-grid, the first flagged .ph-price--featured.'],
      ['Render add-ons', '.ph-addons blocks on the Sports, Real Estate and Lifestyle cards only — Drone-Only goes straight from .ph-price-body to .ph-price-foot — plus a shared #addons section.'],
      ['Close', 'The three .ph-step cards in #booking and the contact block send the visitor back to /#contact.'],
    ],
    cond: [
      { q: 'The pricing page ships no JSON-LD while <code>/photo/</code> does — four priced packages are invisible to search as <code>Offer</code>/<code>PriceSpecification</code>. Intentional, or an oversight from the merge?', r: 'An oversight, now closed. The page carries an <code>OfferCatalog</code> with four <code>Offer</code> entries, each with a <code>PriceSpecification</code> <code>minPrice</code> (the cards say "From", so minPrice rather than price), hung off the existing service by <code>"provider": { "@id": ".../photo/#business" }</code> so the two blocks describe one business. Prices live in the markup AND in the block — keep them in step (2026-09-02). Since 2026-09-07 the provider is an inline <code>Organization</code> named FIRSTUNIT, because the <code>/photo/</code> page that declared the ProfessionalService is gone.' },
    ],
  },
  {
    id: 'D', code: 'D', name: 'ShootSort page', short: 'SHOOTSORT', group: 'pages',
    gx: 0.5, gy: 14, w: 2.5, d: 2, h: 32, kind: 'screen',
    one: 'The download page for the macOS card organizer — the one work card that used to link nowhere.',
    what: 'A hero with the download button, the promise the whole app rests on ("it never touches the card"), the folder shape a shoot lands in, and three capability points. The landing page\'s ShootSort card now points here.',
    how: '<code>shootsort/index.html</code>, served at <code>/shootsort/</code>. Absolute asset paths: <code>/css/site.css</code> plus a page-scoped <code>&lt;style&gt;</code> block (no new stylesheet for one page), and <code>/js/site.js</code> for the shared reveals and theme toggle. The download points at the <mark>public mirror</mark>, <code>github.com/IsaacAPerez/ShootSort-releases/releases/latest/download/ShootSort.zip</code> — the source repo <code>IsaacAPerez/ShootSort</code> is private and its own README link 404s anonymously. There are no screenshots because ShootSort ships no product imagery in-tree.',
    steps: [
      ['Serve', 'Vercel returns shootsort/index.html for the extensionless /shootsort/ URL.'],
      ['Style', 'site.css supplies the tokens; the page block adds the promise card, the tree and the three-cell grid.'],
      ['Download', 'The hero and closing buttons hit the ShootSort-releases "latest" redirect, so a new release needs no edit here.'],
      ['Hand back', 'Footer and CTA return to /, /#work and /#contact.'],
    ],
    cond: [
      { q: 'The page claims Apple silicon + macOS 14 and a notarized build, taken from <code>dist/appcast.xml</code> and the README. Nothing re-checks that when ShootSort ships a release — should the requirements line be generated, or is a page that only changes when the app\'s floor changes fine as prose?' },
    ],
  },
  {
    id: 'Q', code: 'Q', name: 'App-facing legal pages', short: 'APP LEGAL', group: 'pages',
    gx: 0.5, gy: 5, w: 2.5, d: 2, h: 34, kind: 'screen',
    one: 'The privacy, terms and support pages two iOS apps point their App Store listings at.',
    what: 'Four plain documents. For Quarters: a privacy page (last updated May 4 2026) naming exactly what the app collects (Sign in with Apple identifier, chore-proof photos, chat messages, push tokens) and where it lives (Supabase Postgres and storage in AWS us-west-1), a terms page covering households, owners, bills and termination, and a support page. For Souvenir: a privacy page that accounts, field by field, for the one photograph per place that leaves the device when a book is pressed.',
    how: '<code>roommate/{privacy,terms,support}/index.html</code> and <code>souvenir/privacy/index.html</code>. They are the only pages on <code>/css/design-system.css</code> — a different token set (<code>--color-accent: #0071e3</code>, <code>--space-*</code>) from the rest of the site — plus a page-local <code>&lt;style&gt;</code> block for <code>.legal-container</code> (Souvenir\'s extends it with table, <code>&lt;pre&gt;</code> and <code>h3</code> rules). Absolute asset paths, canonical links to their exact URLs, no JS beyond the theme pre-paint IIFE. <mark>The path is permanent</mark>: the app renamed RoommateApp → Crib → Quarters and <code>/roommate/</code> stayed. Two of the four are renderings, not originals: <code>/souvenir/privacy/</code> comes from <code>~/Coding/Souvenir/docs/privacy.md</code>, and <code>/roommate/support/</code> deliberately summarises and links to <code>thequarters.app/support</code> (the URL App Store Connect actually declares) rather than forking that FAQ.',
    steps: [
      ['Serve', 'Vercel returns the directory index for /roommate/privacy/, /roommate/terms/, /roommate/support/ or /souvenir/privacy/.'],
      ['Style', 'design-system.css provides the tokens; a page-local style block lays out the legal container.'],
      ['Read', 'Static prose — collection, use, storage, choices, children, changes, contact.'],
      ['Exit', 'One footer link back to isaacperez.co.'],
    ],
    cond: [
      { q: 'Should these move to <code>/quarters/</code> now that the app has its final name?', r: 'No. App Store metadata and external systems point at the existing URLs; CLAUDE.md marks the path permanent and allows only copy renames — and a rename must match <code>\\bCrib\\b</code> case-sensitively, a precaution the rename commit 85c58c1 records because a case-insensitive replace would mangle the word "describes" in the privacy policy (2026-08-24).' },
    ],
  },

  // ---------------- runtime ----------------
  {
    id: 'G', code: 'G', name: "Isaac's Studio", short: 'THE OFFICE', group: 'runtime',
    gx: 6.5, gy: 6.5, w: 3, d: 3, h: 62, kind: 'tall',
    one: 'A walkable pixel home office layered over the landing page, where the furniture is the portfolio.',
    what: 'Press "Explore my office" and a canvas takes the screen. You walk with WASD or a thumbstick, press E next to anything, and a typewriter dialog opens: the phones on the console are the shipped apps, the framed prints are the jobs, the shelf gadgets are the skills, the printer points you at the Experience section. A Roomba wanders, a cat follows you, a drone unlocks, and a mini-fridge hides a taco.',
    how: 'One IIFE in <code>js/game.js</code>, 1,700 lines, no dependencies. A 40×26 tile map is built into a <code>Uint8Array</code> by <code>buildMap()</code>, then <code>bakeAtlas()</code>/<code>bakeWorld()</code> paint the whole room once into offscreen canvases; the frame loop only blits. <code>ENTITIES</code> is a 50-item array — 23 of them <code>core: true</code>, which is what the progress bar counts. A fixed-step loop (<code>STEP = 1/60</code>) drives <code>update()</code> and <code>render()</code>; audio is a tiny <mark>oscillator synth</mark> created on first gesture. <code>window.__ipGame</code> exposes <code>step</code>, <code>tp</code>, <code>inspect</code> and a <code>snapshot</code> getter for QA.',
    steps: [
      ['Boot', 'At load: buildMap() writes the tile grid, rebuildArt() reads the palette and bakes the atlas, character rigs and the world canvas.'],
      ['Open', 'openOverlay() adds .active to #gameRoot and .game-active to the body element; the start screen offers Step Inside, Back to the site, or a shortcut to the Experience section.'],
      ['Play', 'startGame() starts the rAF loop — update() moves the player, the Roomba, the cat and the drone; render() blits the baked world then sorts entities by screen-Y.'],
      ['Interact', 'E (or a tap within ~2.2 tiles) picks the nearest non-decor entity, plays a blip, opens the typewriter dialog and marks it visited.'],
      ['Persist', 'markVisited() writes the visited set to localStorage["ip-game-state"] and calls window.unlock() for that entity group.'],
      ['Exit', 'ESC or the HUD ✕ cancels the rAF, clears held keys, closes the dialog and hands the page back to the site.'],
    ],
    cond: [
      { q: 'The 🏆 HUD button exits the office and calls <code>scrollIntoView</code> on <code>#achievements</code> — but no element with that id exists anywhere in the repo, so it silently falls back to <code>window.scrollTo(0, 0)</code>. Add an achievements section to the landing page, or make the button just close the office?', r: 'Neither — the badges now render <em>inside</em> the office. <code>openAchievements()</code> fills the existing <code>#gameDialog</code> with all nine badges, locked and unlocked, headed "N / 8 unlocked"; the visitor never leaves the room. The badge table comes from <code>window.__ipAch</code>, published by the achievement engine in index.html, with a fallback copy in game.js. No landing-page section was added — that would have grown an unmeasured surface (2026-09-02).' },
      { q: 'Three guards skip an entity id <code>shrine_taco</code> that no longer exists in <code>ENTITIES</code>, while <code>wall_cracked</code> (the mini-fridge) is filtered out once <code>state.vaultOpen</code> is true — so the fridge can only ever be opened once per browser and its <code>else sfx("blip")</code> branch is unreachable. Was a second secret meant to take its place?', r: 'The three dead <code>shrine_taco</code> guards are gone (2026-09-02); they protected an id with no definition, so they never matched. The mini-fridge behaviour was left exactly as it is — one opening per browser is the intended secret, and a second one is a design question for Isaac, not a cleanup.' },
      { q: '<code>sessionStorage["ip-game-skip"]</code> is written on every exit and cleared on re-entry but is never read anywhere — a leftover from when the office was the landing experience instead of an opt-in. Remove it, or wire it back up?', r: 'Removed (2026-09-02). Nothing read it; the office is opt-in now, so there is no "skip" state worth remembering. <code>exitGame()</code> just tears the overlay down and <code>#playGameBtn</code> calls <code>openOverlay</code> directly.' },
    ],
  },
  {
    id: 'M', code: 'M', name: 'Site motion', short: 'SITE MOTION', group: 'runtime',
    gx: 3.5, gy: 8, w: 2.5, d: 2, h: 36, kind: 'box',
    one: 'The small script that makes the pages feel alive as you scroll.',
    what: 'Sections fade up as they enter view, the hero drifts and blurs as you leave it, the nav hides on the way down and returns on the way up, the statement sentence lights word by word, and anchor links glide instead of jumping.',
    how: '<code>js/site.js</code>, 132 lines, one ES5-style IIFE (<code>var</code>, not <code>const</code>). Reveals use an <code>IntersectionObserver</code> at <code>threshold: 0.12</code> that unobserves after firing. Scroll work is coalesced into a single <code>requestAnimationFrame</code> callback behind a <code>ticking</code> flag on a passive listener. The statement is split into <code>&lt;span class="word"&gt;</code> nodes at boot so opacity can be driven per word. <mark>Every effect is gated</mark> on <code>REDUCED</code> (<code>site.js:7</code>) — under reduced motion the reveals are simply added, and nothing parallaxes.',
    steps: [
      ['Read the preference', 'REDUCED = matchMedia("(prefers-reduced-motion: reduce)").matches, computed once.'],
      ['Wire reveals', 'Either add .in to every [data-reveal] immediately (reduced) or observe them.'],
      ['Split the statement', 'Walk #statementText and wrap each word in a span so the scroll fill can address it.'],
      ['Drive the frame', 'One rAF frame per scroll/resize: nav state, hero parallax, about-photo drift, word fill.'],
      ['Smooth anchors', 'Intercept every a[href^="#"], offset 56px for the fixed nav, and use behavior:"auto" under reduced motion.'],
    ],
    cond: [],
  },
  {
    id: 'T', code: 'T', name: 'Theme switch', short: 'THEME SWITCH', group: 'runtime',
    gx: 3.5, gy: 5, w: 2.5, d: 2, h: 34, kind: 'box',
    one: 'Light or dark, chosen once and remembered across every page and the office.',
    what: 'The sun/moon button in the nav flips the theme. The choice sticks in the browser, applies before the first paint on every page so nothing flashes, and the office re-paints its artwork to match.',
    how: 'Three cooperating pieces. (1) An inline IIFE in each page\'s <code>&lt;head&gt;</code>, before the stylesheets, reads <code>localStorage["theme"]</code> and sets <code>data-theme</code> on <code>&lt;html&gt;</code>. (2) <code>js/site.js</code> toggles the attribute and writes it back, seeding from <code>prefers-color-scheme</code> on a first visit so the first click always visibly flips. (3) <code>js/game.js</code> watches with a <code>MutationObserver</code> on <code>data-theme</code> and calls <code>rebuildArt()</code>, re-baking the atlas, the rigs and the whole world canvas. CSS answers on <code>:root</code>, <code>:root[data-theme="dark"]</code> and a <code>prefers-color-scheme</code> block guarded by <code>:not([data-theme="light"])</code>.',
    steps: [
      ['Pre-paint', 'The head IIFE stamps data-theme before any stylesheet parses — no flash of the wrong theme.'],
      ['Toggle', 'The nav button computes the next value (explicit value inverts; unset falls back to the opposite of the system preference) and writes localStorage["theme"].'],
      ['Restyle', 'Every stylesheet re-resolves its custom properties from the new :root block.'],
      ['Re-bake', "The office's MutationObserver fires rebuildArt() so the baked room matches the new palette."],
      ['Reward', 'The inline achievement engine unlocks "Day / Night Shifter" on the first toggle.'],
    ],
    cond: [
      { q: 'Every other localStorage access is try/catch-wrapped for Safari private mode; the pre-paint IIFEs call <code>getItem</code> bare. Bug?', r: 'Deliberate. CLAUDE.md rules that the inline pre-paint script stays verbatim in <code>&lt;head&gt;</code> before the stylesheets — never externalized, never deferred — because it exists to prevent FOUC (2026-08-24).' },
    ],
  },
  {
    id: 'A', code: 'A', name: 'Achievements', short: 'ACHIEVEMENTS', group: 'runtime',
    gx: 6.5, gy: 3.5, w: 2.5, d: 2, h: 34, kind: 'box',
    one: 'Eight badges that pop as a visitor explores — readable any time from the HUD — plus a hidden cheat code that does not count toward the total.',
    what: 'Read the app phones, the framed jobs, the shelf, the contact console — each group pops a toast the first time. Toggling the theme counts. Touring every exhibit fires confetti and a fanfare. And the old arrow-arrow-B-A cheat code still does something. "Stepped Inside" lands the moment the office opens, so the HUD counter can reach 8 of 8.',
    how: 'An inline IIFE at the bottom of <code>index.html</code>, not a file. It owns a nine-entry table (emoji + label), reads and writes <code>localStorage["ip-achievements"]</code>, and publishes <code>window.unlock(id)</code>, which builds a <code>.toast</code> node into <code>#toastStack</code> and removes it after 4.6s. <code>js/game.js</code> calls it through <code>gUnlock()</code> from <code>markVisited()</code>, mapping <code>e.group</code> (<code>project</code>, <code>crystal</code>, <code>study</code>, <code>contact</code>, <code>statue</code>) to a badge, and from <code>openOverlay()</code> for <code>adventurer</code>, while <code>index.html</code> itself unlocks only <code>shifter</code> and <code>konami</code> — eight countable ids plus <code>konami</code>. <code>syncAchCount()</code> filters <code>konami</code> out and renders <mark>n/8</mark>, a counter that now tops out at a real 8/8. A second Konami listener lives here on <code>window</code>, in parallel with the game\'s own — <code>unlock()</code> de-dupes. The table is also published as <code>window.__ipAch</code> so the game\'s 🏆 panel can render it.',
    steps: [
      ['Rehydrate', 'Parse localStorage["ip-achievements"] into a Set inside a try/catch.'],
      ['Publish', 'Expose window.unlock(id) so the game (and the theme button) can call it without importing anything.'],
      ['Award', 'On a new id: add, persist, and append a toast to #toastStack.'],
      ['Count', 'game.js syncAchCount() re-reads the store, drops konami, and writes "n/8" into the HUD — 8/8 is the ceiling.'],
      ['Review', 'The 🏆 HUD button calls openAchievements(), which renders the whole table into #gameDialog — unlocked badges lit, the rest under a lock, konami flagged as a bonus — without leaving the office.'],
      ['Complete', 'When all 23 core exhibits are visited the game unlocks completionist, bursts particles and plays the fanfare — once, guarded by state.confetti.'],
    ],
    cond: [
      { q: '<code>adventurer</code> (🚪 "Stepped Inside") is defined in the badge table at <code>index.html:376</code> but nothing ever calls <code>unlock(\'adventurer\')</code> — <code>js/game.js</code> only unlocks quests / statcheck / lorekeeper / raven / historian / completionist / konami, and <code>index.html</code> adds shifter. Since <code>syncAchCount()</code> counts against a literal 8, the HUD can never read 8/8. Award it on the first <code>openOverlay()</code>, or drop the entry and count against 7?', r: 'Wired, not dropped: <code>openOverlay()</code> now calls <code>gUnlock(\'adventurer\')</code> just before its existing <code>syncAchCount()</code>. Opening the office — via the "Explore my office" button or the <code>#office</code> deep link — is literally "Stepped Inside", so the badge has the trigger its emoji and label already implied, and the literal 8 becomes honest at 8 awardable ids (2026-08-24).' },
    ],
  },
  {
    id: 'S', code: 'S', name: 'Browser storage', short: 'BROWSER STORE', group: 'runtime',
    gx: 7, gy: 10.5, w: 3, d: 2.5, h: 24, kind: 'store',
    one: 'The only database this site has: three keys in the visitor\'s own browser.',
    what: 'The site remembers your theme, which badges you have earned, and how far you got in the office — nothing leaves the machine, and there is no account, no server and no analytics anywhere on the site.',
    how: '<code>localStorage["theme"]</code> (<code>"light"</code>/<code>"dark"</code>), <code>localStorage["ip-achievements"]</code> (a JSON array of badge ids) and <code>localStorage["ip-game-state"]</code> — the object built by <code>loadState()</code>: <code>visited[]</code>, <code>vaultOpen</code>, <code>vaultFound</code>, <code>chestOpened</code>, <code>drone</code>, <code>muted</code>, <code>confetti</code>. (<code>sessionStorage["ip-game-skip"]</code> was removed on 2026-09-02 — nothing ever read it.) Every read and write in <code>js/site.js</code>, <code>js/game.js</code> and the inline achievement engine is wrapped in <code>try/catch</code> for <mark>Safari private mode</mark>; only the pre-paint theme reads are bare, by rule.',
    steps: [
      ['Read at boot', 'The head IIFE reads theme; game.js loadState() merges the saved object over defaults; the achievement engine parses its array.'],
      ['Write on change', 'Theme on toggle, ip-achievements on each new badge, ip-game-state on visit / fridge / drone / mute / confetti.'],
      ['Fail soft', 'Any throw is swallowed — the site works with storage disabled, it just forgets.'],
      ['Never leave', 'No fetch, no XHR, no beacon, no analytics SDK exists anywhere in the repo.'],
    ],
    cond: [],
  },

  // ---------------- assets ----------------
  {
    id: 'C', code: 'C', name: 'Stylesheets', short: 'STYLESHEETS', group: 'assets',
    gx: 10.5, gy: 8, w: 2.5, d: 2, h: 34, kind: 'cards',
    one: 'Four live stylesheets, each owning exactly one kind of page — and one that owns nothing.',
    what: 'The landing page, the office overlay, the photo pages and the legal pages each have their own sheet. They are never mixed: picking the wrong one is how a page ends up looking like a different site. A one-off page keeps its handful of extra rules in a page-scoped style block instead of widening a shared sheet.',
    how: '<code>css/site.css</code> (386 lines) is the landing page and the token source — <code>:root</code>, <code>:root[data-theme="dark"]</code>, and a <code>prefers-color-scheme</code> block. <code>css/game.css</code> (543) is the overlay and deliberately declares <mark>its own tokens</mark> on <code>#gameRoot, .toast-stack</code> so it never depends on the site sheet. <code>css/photo.css</code> (206) layers <code>.ph-*</code> classes on top of site.css and is loaded only by the two <code>/photo/</code> pages. <code>css/design-system.css</code> (1,328) is a separate token system used only by the four legal-style pages (<code>/roommate/{privacy,terms,support}/</code>, <code>/souvenir/privacy/</code>). <code>/shootsort/</code> and <code>404.html</code> ride on site.css plus a page-scoped <code>&lt;style&gt;</code> block. <code>css/rpg.css</code> is loaded by nothing.',
    steps: [
      ['site.css', 'Tokens, nav, hero, work cards, experience, about, contact, footer — plus the reduced-motion block.'],
      ['game.css', 'Overlay chrome: start screen, HUD, dialog, joystick, toast stack, with its own light/dark tokens.'],
      ['photo.css', 'Hero stats, service grid, embed frames, price cards — additive over site.css tokens.'],
      ['design-system.css', 'A full independent token set (--color-*, --space-*, --text-*) for the legal pages only.'],
      ['page-scoped <style>', 'The legal pages, /shootsort/ and 404.html each carry their own block — one page, a handful of rules, no shared sheet widened.'],
    ],
    cond: [],
  },
  {
    id: 'I', code: 'I', name: 'Images & documents', short: 'IMAGES & DOCS', group: 'assets',
    gx: 10.5, gy: 11, w: 3, d: 2.5, h: 24, kind: 'store',
    one: 'The photos, app icons, logos and résumé the pages point at — committed straight into the repo.',
    what: 'Five app icons for the work cards, the two employer logos, Isaac\'s real photo and real résumé PDF, and the site favicon. There is no image pipeline: what is committed is what is served.',
    how: '<code>images/</code> holds <code>curbside-icon.png</code>, <code>runsbyip-icon.png</code>, <code>kangskuisine-icon.png</code>, <code>quarters-icon.png</code>, <code>teamup-icon-new.png</code>. Root holds <code>isaac.JPG</code> (also the <code>og:image</code> and <code>twitter:image</code> on all three marketing pages), <code>Resume.pdf</code>, <code>favicon.svg</code>, <code>ndLogo.webp</code>, <code>tinderLogo.png</code>. Two rules bite here: images are optimized <em>in place</em> before commit (icons ≲105 KB, photos ≲200 KB — the existing files define the budget), and references must match on-disk case exactly, because macOS is case-insensitive and <mark>Vercel is not</mark> — the hero really is <code>isaac.JPG</code>.',
    steps: [
      ['Reference', 'index.html uses relative src (images/*.png, isaac.JPG); nested pages use absolute (/favicon.svg).'],
      ['Lazy-load', 'Every below-the-fold img carries loading="lazy".'],
      ['Optimize in place', 'Resize/compress keeping the same filename so no reference has to change.'],
      ['Case-check', 'Diff every src/href against ls before committing — a wrong case renders locally and 404s in production.'],
    ],
    cond: [],
  },
  {
    id: 'E', code: 'E', name: 'Third-party embeds', short: 'THIRD PARTY', group: 'assets',
    gx: 13.5, gy: 8, w: 3, d: 2, h: 30, kind: 'slab',
    one: 'The only two outside services the pages actually call: Google Fonts and YouTube.',
    what: 'Type comes from Google Fonts on the three marketing pages; the two legal pages call nobody and fall back to a system font stack. The five showreels on the photo page are YouTube players in privacy-enhanced mode. That is the complete list of external requests — no analytics, no tag manager, no CDN scripts.',
    how: 'One <code>&lt;link&gt;</code> to <code>fonts.googleapis.com/css2</code> for Space Grotesk, Inter and JetBrains Mono, preceded by two <code>preconnect</code> hints, on <code>index.html</code>, <code>photo/index.html</code> and <code>photo/pricing/index.html</code> — and on those three only. <code>roommate/privacy/index.html</code> and <code>roommate/terms/index.html</code> carry no font link and no preconnect at all; they resolve type through <code>--font-sans</code> in <code>css/design-system.css</code>, an <code>-apple-system</code> stack. The showreels are five <code>&lt;iframe src="https://www.youtube-nocookie.com/embed/&lt;id&gt;"&gt;</code> with <code>loading="lazy"</code> inside <code>.ph-work-item</code>. CLAUDE.md holds the line: no new external dependency beyond <mark>the existing Google Fonts links</mark> without a conversation — and since 2026-09-02 the <code>vercel.json</code> CSP enforces exactly that list: <code>fonts.googleapis.com</code> for styles, <code>fonts.gstatic.com</code> for faces, <code>www.youtube-nocookie.com</code> for frames, <code>\'self\'</code> for everything else. A new origin now needs a header change as well as a conversation.',
    steps: [
      ['Preconnect', 'index.html, /photo/ and /photo/pricing/ each open early connections to fonts.googleapis.com and fonts.gstatic.com; the two legal pages open none.'],
      ['Fetch faces', 'One css2 request per marketing page pulls three families; every rule falls back to -apple-system / system-ui — which is all the legal pages ever use.'],
      ['Embed reels', 'youtube-nocookie iframes load lazily only on /photo/.'],
      ['Stop there', 'No other origin is contacted from any page in the repo.'],
    ],
    cond: [],
  },

  // ---------------- ship ----------------
  {
    id: 'H', code: 'H', name: 'Fleet commit hooks', short: 'COMMIT HOOKS', group: 'ship',
    gx: 10.5, gy: 3.5, w: 2.5, d: 2, h: 38, kind: 'gate',
    one: 'The one gate in the whole pipeline — a badly-worded commit message is refused before anything ships.',
    what: 'This repo borrows the fleet\'s shared git hooks. A commit whose subject is not a Conventional Commit is rejected outright; a commit that passes gets logged into the CodeByIP dashboard feed.',
    how: '<code>core.hooksPath</code> is set to <code>/Users/isaacperez/Coding/platform/scripts/hooks</code>, shared with the other eleven fleet repos. <code>commit-msg</code> is pure bash: it lets <code>Merge</code>/<code>Revert</code>/<code>fixup!</code>/<code>squash!</code>/empty through, then requires <code>^(feat|fix|chore|refactor|docs|test|perf|build|ci|revert)(\\(scope\\))?!?: subject</code>. <code>post-commit</code> shells <code>~/Coding/CodeByIP/Backend/luka-log.py</code> best-effort. <code>pre-commit</code> is the Swift lint and <mark>no-ops here</mark>. Almost every commit in this repo\'s history predates the 2026-06-25 hook and would be rejected today — never imitate the old log style.',
    steps: [
      ['Write the message', 'type(scope): subject — e.g. fix(game): point the CapturedByIP exhibit at /photo/.'],
      ['commit-msg', 'The bash regex accepts or rejects; --no-verify is the only bypass, and needs explicit permission.'],
      ['pre-commit', 'The shared Swift-lint hook finds nothing to lint in a repo with no Swift and exits clean.'],
      ['post-commit', 'The commit is logged to the CodeByIP activity feed, failures ignored.'],
      ['Push', 'git push origin main — which is also the deploy.'],
    ],
    cond: [
      { q: 'Does this repo have CI, a runner, or any release workflow?', r: 'No, by design. There is no package.json, no .github/ directory and no self-hosted runner for IsaacPerez.co (the eight runners on this Mac cover other repos). Vercel\'s git integration is the entire pipeline, and CLAUDE.md forbids adding tooling to "fix" it (2026-08-24).' },
    ],
  },
  {
    id: 'V', code: 'V', name: 'Vercel', short: 'VERCEL', group: 'ship',
    gx: 10.5, gy: 0.5, w: 3, d: 2.5, h: 28, kind: 'slab',
    one: 'The host: it watches main, and whatever is in the tree becomes the live site.',
    what: 'There is no build. Vercel clones the repo, serves the files as they are, gives each directory an extensionless URL, and terminates TLS on the apex domain. Pushing to main is publishing.',
    how: 'Vercel project <code>isaacperez</code>, id <code>prj_sSFEIZN5xWUB25tlxb7MxXUADcmZ</code>, org <code>team_kglkY3kYg639waIJAEOnAyuQ</code>, root directory <code>.</code> — recorded in the gitignored <code>.vercel/repo.json</code>, linked to GitHub <code>IsaacAPerez/IsaacPerez.co</code>. The repo carries a <code>vercel.json</code> with <mark>headers only</mark> — no build command, no rewrites, no redirects: CSP, X-Content-Type-Options, X-Frame-Options, Referrer-Policy and Permissions-Policy on <code>/(.*)</code> (added 2026-09-02). The CLI at <code>/opt/homebrew/bin/vercel</code> exists for a manual <code>vercel --prod</code>, but that path is discouraged — <code>git push origin main</code> is the deploy, and there is no staging gate in front of it.',
    steps: [
      ['Push', 'git push origin main.'],
      ['Build', 'Nothing to build — Vercel takes the tree as the output directory.'],
      ['Route', 'photo/index.html becomes /photo/, roommate/terms/index.html becomes /roommate/terms/.'],
      ['Serve', 'Static files over the CDN on https://isaacperez.co with TLS.'],
      ['Verify', 'curl -s https://isaacperez.co | grep <changed-text> — the whole post-deploy check.'],
    ],
    cond: [
      { q: 'Nothing in this repo redirects the retired <code>capturedbyip.com</code> to <code>/photo/</code>. Is that handled in the Vercel dashboard or at DNS, and does it need writing down somewhere in-tree?', r: 'It lives in the OTHER repo: <code>~/Coding/CapturedByIP/vercel.json</code> redirects <code>/(.*)</code> → <code>https://isaacperez.co/photo/</code> (301, commits 84c3fc5 / 6561464, 2026-08-08), so that project is now a redirect-only stub. Nothing to add here beyond this note; this repo\'s own vercel.json carries response headers only (2026-09-02).' },
    ],
  },
  {
    id: 'O', code: 'O', name: 'Discovery surface', short: 'DISCOVERY', group: 'ship',
    gx: 14, gy: 4, w: 2.5, d: 2, h: 34, kind: 'box',
    one: 'How search engines and link previews see the site — seven URLs, seven canonicals, two rich cards.',
    what: 'A sitemap listing every public URL, a fully-open robots file, a canonical link on every page, Open Graph and Twitter cards for the shareable pages, and one structured-data block describing the photo practice.',
    how: '<code>sitemap.xml</code> holds seven <code>&lt;loc&gt;</code> entries (eight until <code>/photo/</code> became a redirect on 2026-09-07): <code>/</code> (1.0), <code>/photo/pricing/</code> (0.7), <code>/shootsort/</code> (0.6), <code>/souvenir/privacy/</code>, <code>/roommate/privacy/</code>, <code>/roommate/terms/</code> and <code>/roommate/support/</code> (0.3). <code>404.html</code> is deliberately absent and carries <code>robots: noindex</code>. <code>robots.txt</code> is <code>Allow: /</code> plus the sitemap pointer. Every page carries a <code>&lt;link rel="canonical"&gt;</code> to its exact <code>https://isaacperez.co/</code> production URL; <code>index.html</code> and <code>/photo/pricing/</code> add <code>og:*</code> and <code>twitter:*</code> tags pointing at <code>isaac.JPG</code>. The JSON-LD is the <code>OfferCatalog</code> on <code>/photo/pricing/</code>, whose provider is an inline FIRSTUNIT <code>Organization</code>. The standing rule: <mark>sitemap and canonical move in the same commit</mark> as any page add or remove.',
    steps: [
      ['Add a page', 'New page lands at <path>/index.html with an absolute-path stylesheet link.'],
      ['Canonicalize', 'It gets a canonical link tag pointing at its exact production URL.'],
      ['List it', 'sitemap.xml gains the loc entry in the same commit; existing entries stay untouched.'],
      ['Check', 'Grepping the loc entries out of sitemap.xml is the audit — they should match the set of real directories.'],
    ],
    cond: [
      { q: 'CLAUDE.md still says the sitemap holds "currently exactly <code>/</code>, <code>/roommate/privacy/</code>, <code>/roommate/terms/</code>", but it has held five URLs since the <code>/photo/</code> merge on 2026-08-08. The operating manual needs that line refreshed — should it name the URLs at all, or just point at the grep?', r: 'Just the grep. CLAUDE.md now says the grep IS the list and refuses to hard-code it, precisely because the list drifted twice (3 → 5 → 8). The same commit refreshed the stale line count and the CSS-role line that never mentioned photo.css (2026-09-02).' },
    ],
  },

  // ---------------- ghost ----------------
  {
    id: 'X', code: 'X', name: 'RPG redesign', short: 'RPG.CSS', group: 'off', ghost: true,
    gx: 14, gy: 0.5, w: 2.5, d: 2, h: 34, kind: 'box',
    one: 'Designed for, not switched on: a whole RPG-styled skin for the site, written and then never linked to anything.',
    what: 'An earlier direction for the site — a fantasy/RPG treatment of the portfolio — got a complete stylesheet and was abandoned the next day. The current playable office is what the idea turned into instead. The file is still in the repo and is loaded by no page.',
    how: '<code>css/rpg.css</code>, 1,139 lines, added in commit <code>776549e</code> and orphaned a day later. Grepping every HTML page and both JS files for <code>rpg</code> returns nothing — it is dead weight in the deploy but costs nothing at runtime because <mark>no page links it</mark>. CLAUDE.md lists it explicitly under mistakes: do not link it, refactor it, or delete it.',
    steps: [
      ['Written', 'A full alternate skin lands in one commit.'],
      ['Orphaned', 'The direction changes the next day; no stylesheet link is ever added.'],
      ['Kept', 'It ships with every deploy, unreferenced, as a deliberate archive.'],
    ],
    cond: [
      { q: 'Delete it, or wire it up as an alternate theme?', r: 'Neither, without asking. CLAUDE.md rules it off-limits: never link, refactor, or delete css/rpg.css unless Isaac explicitly asks for it (2026-08-24).' },
    ],
  },
];

export const FLOWS = [
  {
    id: 'visit', name: 'A first visit', hops: [
      ['L', 'V', 'GET https://isaacperez.co/', { path: '/', accept: 'text/html' }, 'yx'],
      ['V', 'L', '200 index.html', { file: 'index.html', bytes: 24252, build: 'none' }, 'xy'],
      ['L', 'E', 'fonts css2', { families: ['Space Grotesk', 'Inter', 'JetBrains Mono'], display: 'swap' }, 'xy'],
      ['L', 'C', 'stylesheets', { links: ['css/site.css', 'css/game.css'] }, 'xy'],
      ['L', 'I', 'images', { src: ['isaac.JPG', 'images/teamup-icon-new.png'], loading: 'lazy' }, 'xy'],
      ['S', 'T', 'saved theme', { key: 'theme', value: 'dark' }, 'yx'],
      ['T', 'L', 'data-theme on :root', { attr: 'data-theme', value: 'dark', prePaint: true }, 'xy'],
      ['L', 'M', 'scroll', { y: 640, reveal: '[data-reveal]', reduced: false }, 'yx'],
    ],
  },
  {
    id: 'office', name: 'Stepping into the office', hops: [
      ['L', 'G', 'Explore my office', { trigger: '#playGameBtn', hash: '#office' }, 'yx'],
      ['G', 'S', 'load saved run', { key: 'ip-game-state' }, 'xy'],
      ['S', 'G', 'restored state', { visited: 11, drone: true, muted: false, vaultFound: false }, 'yx'],
      ['G', 'A', 'unlock badge', { id: 'quests', from: 'cab_curbside', group: 'project' }, 'xy'],
      ['A', 'S', 'persist badges', { key: 'ip-achievements', count: 4 }, 'yx'],
      ['T', 'G', 'theme changed → re-bake', { attr: 'data-theme', value: 'light', action: 'rebuildArt()' }, 'xy'],
    ],
  },
  {
    id: 'ship', name: 'Shipping a change', hops: [
      ['H', 'V', 'git push origin main', { subject: 'fix(photo): tighten the pricing copy', hook: 'commit-msg ok' }, 'yx'],
      ['V', 'L', 'deploy /', { url: 'https://isaacperez.co/' }, 'xy'],
      ['V', 'P', 'deploy /photo/', { url: 'https://isaacperez.co/photo/' }, 'xy'],
      ['V', 'Q', 'deploy /roommate/*', { urls: ['/roommate/privacy/', '/roommate/terms/', '/roommate/support/'] }, 'xy'],
      ['V', 'D', 'deploy /shootsort/', { url: 'https://isaacperez.co/shootsort/' }, 'xy'],
      ['V', 'O', 'sitemap + robots live', { locs: 8, robots: 'Allow: /' }, 'yx'],
    ],
  },
];

export const CH = [
  {
    id: 'page', title: 'A page and a host', reveal: ['L', 'V'],
    lede: `Strip it all away and this is the product: one hand-written HTML file, and a host that serves it exactly as committed.`,
    story: `<p>There is no build step, no framework and no server. Vercel watches <code>main</code>, clones the repo, and serves the tree — so <mark>a push to main is a production deploy</mark>, with nothing standing in between.</p><p>Everything that follows is either a file that page loads, or a rule about how it gets there.</p>`,
    flow: [
      ['L', 'V', 'GET /', { path: '/', accept: 'text/html' }],
      ['V', 'L', '200 index.html', { file: 'index.html', build: 'none' }],
    ],
  },
  {
    id: 'dress', title: 'What the page pulls in', reveal: ['C', 'I', 'E'],
    lede: `Style, pictures and type — three kinds of thing the landing page asks for once it arrives.`,
    story: `<p>Four live stylesheets each own exactly one kind of page and are never mixed. The images and the résumé are committed straight into the repo, optimized in place, and referenced with <mark>exact filename case</mark> — because macOS forgives a wrong capital and Vercel does not.</p><p>The only outside calls on the whole site are Google Fonts and, on the photo page, YouTube.</p>`,
    flow: [
      ['L', 'C', 'stylesheets', { links: ['css/site.css', 'css/game.css'] }],
      ['L', 'I', 'images + résumé', { src: 'isaac.JPG', ogImage: true }],
      ['L', 'E', 'fonts css2', { families: 3, display: 'swap' }],
    ],
  },
  {
    id: 'alive', title: 'Making it feel alive', reveal: ['M', 'T', 'S'],
    lede: `Two small scripts and three keys in your own browser are the entire client-side runtime.`,
    story: `<p>The theme is stamped onto <code>&lt;html&gt;</code> by an inline script before any stylesheet parses, so there is never a flash of the wrong colours; <code>js/site.js</code> then handles reveals, parallax and the toggle. <mark>Every effect branches on a REDUCED flag</mark> read from <code>prefers-reduced-motion</code>.</p><p>Nothing is stored anywhere but the visitor's browser — there is no account, no backend and no analytics on this site.</p>`,
    flow: [
      ['S', 'T', 'saved theme', { key: 'theme', value: 'dark' }],
      ['T', 'L', 'data-theme="dark"', { prePaint: true }],
      ['L', 'M', 'scroll', { y: 640, ticking: true }],
      ['M', 'L', 'reveal + parallax', { added: '.in', heroBlur: '2.4px' }],
    ],
  },
  {
    id: 'office', title: 'Step inside the office', reveal: ['G', 'A'],
    lede: `The one piece of real engineering: a walkable pixel studio where the furniture is the portfolio.`,
    story: `<p><code>js/game.js</code> is ~1,700 lines of dependency-free canvas — a 40×26 tile room baked once into offscreen canvases, 50 entities of which <mark>23 are exhibits you can read</mark>, and a fixed-step loop that only blits. The phones are the apps, the frames are the jobs, the printer sends you to the Experience section.</p><p>Reading a group of exhibits pops a badge from the achievement engine inlined in <code>index.html</code>, and both halves persist to the same browser storage.</p>`,
    flow: [
      ['L', 'G', 'Explore my office', { trigger: '#playGameBtn' }],
      ['G', 'S', 'load ip-game-state', { key: 'ip-game-state' }],
      ['S', 'G', 'restored run', { visited: 11, drone: true }],
      ['G', 'A', 'unlock("quests")', { from: 'cab_curbside', group: 'project' }],
      ['A', 'S', 'persist badges', { key: 'ip-achievements', count: 4 }],
    ],
  },
  {
    id: 'photo', title: 'The photo brand moves in, then moves on', reveal: ['P', 'R', 'O'],
    lede: `capturedbyip.com became two pages here, and a month later the name retired into FIRSTUNIT.`,
    story: `<p>In August 2026 the CapturedByIP marketing site was folded into <code>/photo/</code> and <code>/photo/pricing/</code>, rebuilt on this site's own tokens, with prices collapsed to <mark>markup as the single source</mark>.</p><p>On 2026-09-07 the CapturedByIP name retired. FIRSTUNIT — the company Isaac founded — is the maker behind the products and the home of the photo and film practice (<code>FU—0001</code>). <code>/photo/</code> became a 301 to <code>firstunit.io/fu-0001</code>, the pricing page stayed as a FIRSTUNIT practice page, and the landing page gained a <code>#firstunit</code> section plus a code and the <code>A FIRSTUNIT PRODUCT</code> line on every product card. Removing a public page is the same bookkeeping ritual as adding one: sitemap, links, same commit.</p>`,
    flow: [
      ['V', 'P', '301 /photo/', { to: 'https://firstunit.io/fu-0001' }],
      ['V', 'R', '200 /photo/pricing/', { url: '/photo/pricing/' }],
      ['R', 'O', 'canonical + OfferCatalog', { provider: 'FIRSTUNIT', offers: 4 }],
      ['L', 'O', 'sitemap loses /photo/', { locs: 7 }],
    ],
  },
  {
    id: 'product', title: 'A page per product', reveal: ['D'],
    lede: `Every work card should end somewhere. ShootSort was the one that did not.`,
    story: `<p>The macOS card organizer had a card on the landing page with <mark>no link at all</mark> — nothing to read, nothing to download. <code>/shootsort/</code> is that ending: the promise the app rests on, the folder shape a shoot lands in, and a download that points at the public releases mirror rather than the private source repo.</p><p>It is also the cheapest possible page: site.css plus one page-scoped style block, no new stylesheet, no new dependency.</p>`,
    flow: [
      ['V', 'D', '200 /shootsort/', { url: '/shootsort/' }],
      ['D', 'C', 'site.css + page <style>', { href: '/css/site.css' }],
      ['D', 'O', 'canonical + sitemap loc', { priority: 0.6 }],
    ],
  },
  {
    id: 'legal', title: 'The pages that cannot move', reveal: ['Q', 'H'],
    lede: `Four legal documents two App Store listings point at, and the one gate every change has to pass.`,
    story: `<p><code>/roommate/{privacy,terms,support}/</code> serve the Quarters iOS app and <code>/souvenir/privacy/</code> serves Souvenir. Quarters was renamed twice; <mark>the URL is permanent</mark>, because external systems point at it — only the copy inside gets updated. Two of the four are renderings of a source that lives in the app's own repo, so they are re-rendered, never re-written.</p><p>Every commit in this repo goes through the fleet's shared hooks: Conventional Commits enforced by <code>commit-msg</code>, the commit logged to the CodeByIP feed by <code>post-commit</code>. That is the entire pipeline — there is no CI here at all.</p>`,
    flow: [
      ['H', 'V', 'git push origin main', { subject: 'fix(legal): rename Crib to Quarters', hook: 'commit-msg ok' }],
      ['V', 'Q', '200 /roommate/privacy/', { url: '/roommate/privacy/' }],
      ['Q', 'C', 'design-system.css', { href: '/css/design-system.css' }],
    ],
  },
  {
    id: 'ghost', title: 'The road not taken', reveal: ['X'],
    lede: `One stylesheet in the repo belongs to a version of this site that never shipped.`,
    story: `<p><code>css/rpg.css</code> is 1,139 lines of an RPG-styled redesign, written in one commit and orphaned the next day; nothing links it. The playable office is what that idea became instead.</p><p>It stays because the operating manual says so — <mark>never link, refactor, or delete it</mark> without asking.</p>`,
    flow: [
      ['X', 'C', 'still unlinked', { file: 'css/rpg.css', lines: 1139, references: 0 }],
    ],
  },
  {
    id: 'all', title: 'The whole system', reveal: [], lede: `Everything at once, for free exploration.`,
    story: `<p>Choose which flow runs (bottom left): a first visit, stepping into the office, or shipping a change. Hover anything; click to pin; → goes inside a structure to see its steps.</p><p>The <mark>Open questions</mark> tab lists every question by ID — most of them are loose ends inside <code>js/game.js</code>.</p>`,
    flow: null,
  },
];

export const HOW_HTML = `<div class="eyebrow">isaac-perez-co · static · Vercel</div><h1 class="t">How it's built</h1><div class="sub">eight hand-written pages, two scripts, no build step</div>

<h3 class="sec">The shape of it</h3>
<p>IsaacPerez.co is the fleet's only pure-static product. There is no <code>package.json</code>, no bundler, no test suite and no CI: the repository tree is literally the website, and Vercel's git integration on <code>main</code> is the entire deployment pipeline. Everything a browser runs is hand-written vanilla HTML, CSS and JavaScript — one IIFE per file, <code>'use strict'</code> at the top.</p>

<h3 class="sec">Filesystem</h3>
<pre>IsaacPerez.co/
  index.html               427 lines — landing page, inline theme pre-paint, inline achievements
  css/
    site.css               386  landing page + the token source (:root / [data-theme])
    game.css               543  the office overlay, with its own tokens
    photo.css              206  /photo/ and /photo/pricing/ only
    design-system.css     1328  the four legal-style pages only
    rpg.css               1139  abandoned redesign — zero references
  js/
    site.js                132  reveals, parallax, nav, theme toggle, anchor scroll
    game.js               1700  "Isaac's Studio" — 50 entities, 23 exhibits, 6 zones
  photo/index.html              CapturedByIP work + 5 YouTube embeds + JSON-LD
  photo/pricing/index.html      4 packages, add-ons, booking + Offer JSON-LD
  shootsort/index.html          the macOS card organizer — download + how it files
  roommate/privacy/index.html   Quarters privacy policy (App Store target)
  roommate/terms/index.html     Quarters terms (App Store target)
  roommate/support/index.html   Quarters support — summary + link to thequarters.app/support
  souvenir/privacy/index.html   Souvenir privacy policy (rendered from Souvenir/docs/privacy.md)
  404.html                      styled not-found — Vercel serves it for any bad URL
  images/                       5 app icons
  isaac.JPG  Resume.pdf  favicon.svg  ndLogo.webp  tinderLogo.png
  sitemap.xml  robots.txt  vercel.json  CLAUDE.md
  .vercel/                      gitignored — the linked Vercel project
  docs/atlas/                   this atlas (data.mjs → atlas.html + SYSTEM.md)</pre>

<h3 class="sec">What runs where</h3>
<p><b>Production</b> — Vercel project <code>isaacperez</code> (<code>prj_sSFEIZN5xWUB25tlxb7MxXUADcmZ</code>, org <code>team_kglkY3kYg639waIJAEOnAyuQ</code>, root <code>.</code>), auto-deploying <code>main</code> from GitHub <code>IsaacAPerez/IsaacPerez.co</code> onto the apex <code>isaacperez.co</code>. No build command and no rewrites; the only <code>vercel.json</code> is a response-headers block (CSP, nosniff, X-Frame-Options, Referrer-Policy, Permissions-Policy) added 2026-09-02.</p>
<p><b>CI</b> — none. There is no <code>.github/</code> directory in this repo and no self-hosted runner for it; the eight <code>actions.runner.IsaacAPerez-*</code> LaunchAgents on this Mac all belong to other products, and no launchd job runs this repo.</p>
<p><b>Scheduled, from outside the tree</b> — two crontab entries on this Mac do target it, neither of them living in the repo. <code>20 6 * * 1 ~/.openclaw/scripts/product-audit.sh</code> carries <code>isaacperez=IsaacPerez.co</code> in its lead list and runs <code>git log</code> / <code>git status</code> over the working copy every Monday. <code>3,33 * * * * ~/scripts/uptime-sentinel.sh</code> polls <code>https://isaacperez.co</code> every 30 minutes against the exact <code>&lt;title&gt;</code> string <code>Isaac Perez — Builder &amp; Creator</code>, plus <code>https://capturedbyip.com</code> for the redirect into <code>/photo/</code>. Neither writes to the repo.</p>
<p><b>Git hooks</b> — <code>core.hooksPath</code> → <code>~/Coding/platform/scripts/hooks</code> (shared fleet hooks): <code>commit-msg</code> enforces Conventional Commits in pure bash, <code>post-commit</code> logs the commit into the CodeByIP dashboard feed via <code>~/Coding/CodeByIP/Backend/luka-log.py</code>, <code>pre-commit</code> is the Swift lint and no-ops here.</p>
<p><b>Local preview</b> — <code>python3 -m http.server 8000</code> from the repo root. Any static server works; there is nothing to compile.</p>
<p><b>Roster</b> — <code>slug: isaac-perez-co</code>, <code>kind: web</code>, <code>type: static</code> in <code>~/Coding/platform/scripts/products.json</code>. Roster edits happen there, never in this repo.</p>

<h3 class="sec">The eight public URLs</h3>
<pre>/                      index.html                   priority 1.0
/photo/                photo/index.html             priority 0.8
/photo/pricing/        photo/pricing/index.html     priority 0.7
/shootsort/            shootsort/index.html         priority 0.6
/souvenir/privacy/     souvenir/privacy/index.html  priority 0.3  App Store target
/roommate/privacy/     roommate/privacy/index.html  priority 0.3  App Store target
/roommate/terms/       roommate/terms/index.html    priority 0.3  App Store target
/roommate/support/     roommate/support/index.html  priority 0.3
404.html                                            not in the sitemap, robots noindex</pre>
<p>Renaming or moving any of these is a stop-and-ask: external systems point at them, and the sitemap plus every canonical link must move in the same commit.</p>

<h3 class="sec">Rules that bite</h3>
<p><b>Filename case.</b> macOS is case-insensitive, Vercel is not — the hero photo really is <code>isaac.JPG</code>, and it is the <code>og:image</code>. Diff every <code>src</code>/<code>href</code> against <code>ls</code> before committing.</p>
<p><b>Path style.</b> <code>index.html</code> uses relative paths; every nested page — and <code>404.html</code>, which is served for a bad URL at any depth — uses absolute <code>/css/*.css</code>. Pasting one style into the other kind of page works locally and breaks deployed.</p>
<p><b>Reduced motion.</b> Both scripts compute a <code>REDUCED</code> flag (<code>site.js:7</code>, <code>game.js:19</code>) and branch on it everywhere; new motion must too.</p>
<p><b>The pre-paint script stays inline.</b> The theme IIFE in each <code>&lt;head&gt;</code> exists to prevent a flash of the wrong theme — never externalize or defer it.</p>
<p><b>No tooling.</b> No package.json, no bundler, no framework, no analytics, no workflows. Adding any of them is an architecture change, not a cleanup.</p>
<p><b>The CSP is load-bearing.</b> <code>vercel.json</code> allows exactly <code>'self'</code>, <code>fonts.googleapis.com</code>, <code>fonts.gstatic.com</code> and <code>www.youtube-nocookie.com</code>. A new origin, or moving an inline script to a nonce, breaks every page at once — test header changes against a local server that replays them before pushing.</p>`;
