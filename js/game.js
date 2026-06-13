/* ============================================================
   THE DUNGEON OF ISAAC — playable portfolio
   Vanilla canvas game. World is generated from room rects,
   baked once to an offscreen canvas, and re-baked only on
   theme change or when the secret vault opens.
   ============================================================ */
(function () {
  'use strict';

  const root = document.getElementById('gameRoot');
  const canvas = document.getElementById('gameCanvas');
  if (!root || !canvas || !canvas.getContext) return;
  const ctx = canvas.getContext('2d');

  // ---------------- Constants ----------------
  const TILE = 16;
  const MAPW = 60, MAPH = 42;
  const STEP = 1 / 60;
  const PLAYER_SPEED = 4.5 * TILE; // logical px/sec
  const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Tile ids
  const T = { VOID: 0, STONE: 1, BLUESTONE: 2, MARBLE: 3, WOOD: 4, GOLDFLOOR: 5, CARPET: 6, RUNE: 7, DAIS: 8, HELIPAD: 9, WALL: 10, CRACKED: 11 };
  const FLOOR_MAX = 9; // ids <= FLOOR_MAX are walkable

  const ROOMS = [
    { id: 'foyer', title: 'The Foyer', x1: 21, y1: 17, x2: 34, y2: 26, floor: T.STONE },
    { id: 'sanctum', title: 'Skills Sanctum', x1: 23, y1: 5, x2: 32, y2: 12, floor: T.BLUESTONE },
    { id: 'campaign', title: 'Campaign Hall', x1: 5, y1: 18, x2: 15, y2: 25, floor: T.MARBLE },
    { id: 'arcade', title: 'Quest Arcade', x1: 40, y1: 15, x2: 54, y2: 28, floor: T.STONE },
    { id: 'rookery', title: 'The Rookery', x1: 22, y1: 31, x2: 33, y2: 38, floor: T.WOOD },
    { id: 'study', title: "Hero's Study", x1: 6, y1: 5, x2: 13, y2: 11, floor: T.WOOD },
    { id: 'vault', title: 'The Secret Vault', x1: 50, y1: 31, x2: 54, y2: 34, floor: T.GOLDFLOOR },
  ];
  const CORRIDORS = [
    { x1: 27, y1: 13, x2: 28, y2: 16, floor: T.CARPET },  // foyer -> sanctum
    { x1: 16, y1: 21, x2: 20, y2: 22, floor: T.CARPET },  // foyer -> campaign
    { x1: 35, y1: 21, x2: 39, y2: 22, floor: T.CARPET },  // foyer -> arcade
    { x1: 27, y1: 27, x2: 28, y2: 30, floor: T.CARPET },  // foyer -> rookery
    { x1: 9, y1: 12, x2: 10, y2: 17, floor: T.STONE },    // campaign -> study
  ];
  const PLAQUES = [
    { x: 28, y: 15.6, text: 'SKILLS SANCTUM', arrow: '▲', foyer: true },
    { x: 18.5, y: 20.6, text: 'CAMPAIGN HALL', arrow: '◀', foyer: true },
    { x: 37.5, y: 20.6, text: 'QUEST ARCADE', arrow: '▶', foyer: true },
    { x: 28, y: 28.6, text: 'THE ROOKERY', arrow: '▼', foyer: true },
    { x: 10, y: 13.6, text: "HERO'S STUDY" },
  ];
  // Torches flank each corridor mouth (tile coords, drawn on walls)
  const TORCHES = [
    [26, 16], [29, 16], [26, 13], [29, 13],     // sanctum corridor
    [20, 20], [20, 23], [16, 20], [16, 23],     // campaign corridor
    [35, 20], [35, 23], [39, 20], [39, 23],     // arcade corridor
    [26, 27], [29, 27], [26, 30], [29, 30],     // rookery corridor
    [8, 13], [11, 13], [8, 16], [11, 16],       // study corridor
  ];

  // ---------------- Persistence ----------------
  const GS_KEY = 'ip-game-state';
  function loadState() {
    try { return Object.assign({ visited: [], vaultOpen: false, vaultFound: false, chestOpened: false, drone: false, muted: false, confetti: false }, JSON.parse(localStorage.getItem(GS_KEY) || '{}')); }
    catch (e) { return { visited: [], vaultOpen: false, vaultFound: false, chestOpened: false, drone: false, muted: false, confetti: false }; }
  }
  const state = loadState();
  function saveState() { try { localStorage.setItem(GS_KEY, JSON.stringify(state)); } catch (e) { /* private mode */ } }
  const visited = new Set(state.visited);

  // ---------------- Theme palette ----------------
  let PAL = {};
  function readPalette() {
    const cs = getComputedStyle(document.documentElement);
    const v = (name, fb) => (cs.getPropertyValue(name) || fb).trim() || fb;
    const light = document.documentElement.getAttribute('data-theme') === 'light' ||
      (!document.documentElement.getAttribute('data-theme') && window.matchMedia('(prefers-color-scheme: light)').matches);
    PAL = {
      light,
      gold: v('--gold', '#f5b942'),
      goldBright: v('--gold-bright', '#ffd166'),
      goldDeep: v('--gold-deep', '#b97e16'),
      text: v('--text', '#e8e6e1'),
      bg: v('--bg', '#0b0e14'),
      // dungeon tones
      floor: light ? '#e3d7bc' : '#1a2032',
      floorB: light ? '#d0c096' : '#171c2c',
      floorC: light ? '#efe6cf' : '#1d2438',
      blue: light ? '#d3d8cf' : '#18243a',
      blueB: light ? '#c9d0c8' : '#152033',
      marbleA: light ? '#efe6d2' : '#222a40',
      marbleB: light ? '#ddd2b8' : '#1a2133',
      wood: light ? '#d9b98c' : '#2e2418',
      woodB: light ? '#cfae80' : '#271e13',
      goldFloor: light ? '#e7c878' : '#4a3a14',
      goldFloorB: light ? '#dfbd66' : '#403210',
      carpet: light ? '#c9a84e' : '#3d3214',
      carpetEdge: light ? '#9a6b15' : '#f5b94233',
      wallTop: light ? '#b3a98f' : '#2c3450',
      wall: light ? '#998f74' : '#222942',
      wallDark: light ? '#7d7459' : '#171d30',
      voidc: light ? '#cfc4a6' : '#070a10',
    };
  }

  // ---------------- Map ----------------
  let grid = new Uint8Array(MAPW * MAPH);
  function gAt(x, y) { return (x < 0 || y < 0 || x >= MAPW || y >= MAPH) ? T.VOID : grid[y * MAPW + x]; }
  function gSet(x, y, v) { if (x >= 0 && y >= 0 && x < MAPW && y < MAPH) grid[y * MAPW + x] = v; }
  function isFloorId(id) { return id >= T.STONE && id <= T.HELIPAD; }

  function hash2(x, y) { let h = (x * 374761393 + y * 668265263) | 0; h = (h ^ (h >> 13)) * 1274126177; return ((h ^ (h >> 16)) >>> 0) / 4294967295; }

  function buildMap() {
    grid = new Uint8Array(MAPW * MAPH);
    const rects = ROOMS.concat(CORRIDORS);
    for (const r of rects) {
      if (r.id === 'vault' && false) continue;
      for (let y = r.y1; y <= r.y2; y++) for (let x = r.x1; x <= r.x2; x++) gSet(x, y, r.floor);
    }
    // Foyer gold carpet cross
    for (let y = 17; y <= 26; y++) { gSet(27, y, T.CARPET); gSet(28, y, T.CARPET); }
    for (let x = 21; x <= 34; x++) { gSet(x, 21, T.CARPET); gSet(x, 22, T.CARPET); }
    // Sanctum rune scatter
    for (let y = 5; y <= 12; y++) for (let x = 23; x <= 32; x++) if (gAt(x, y) === T.BLUESTONE && hash2(x, y) > 0.85) gSet(x, y, T.RUNE);
    // Special tiles
    gSet(27, 36, T.DAIS);
    gSet(45, 24, T.HELIPAD); gSet(46, 24, T.HELIPAD); gSet(45, 25, T.HELIPAD); gSet(46, 25, T.HELIPAD);
    // Vault passage (2 tiles wide to match the other corridors)
    if (state.vaultOpen) { gSet(51, 29, T.STONE); gSet(52, 29, T.STONE); gSet(51, 30, T.STONE); gSet(52, 30, T.STONE); }
    // Walls: any non-floor tile 8-adjacent to floor
    const wall = [];
    for (let y = 0; y < MAPH; y++) for (let x = 0; x < MAPW; x++) {
      if (isFloorId(gAt(x, y))) continue;
      let adj = false;
      for (let dy = -1; dy <= 1 && !adj; dy++) for (let dx = -1; dx <= 1; dx++) if (isFloorId(gAt(x + dx, y + dy))) { adj = true; break; }
      if (adj) wall.push([x, y]);
    }
    for (const [x, y] of wall) gSet(x, y, T.WALL);
    if (!state.vaultOpen) gSet(52, 29, T.CRACKED);
  }

  // ---------------- Tile atlas + world bake ----------------
  function mk(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
  let atlas = {};
  function bakeAtlas() {
    atlas = {};
    const variants = { [T.STONE]: 3, [T.BLUESTONE]: 2, [T.MARBLE]: 2, [T.WOOD]: 2, [T.GOLDFLOOR]: 2, [T.CARPET]: 1, [T.RUNE]: 1, [T.DAIS]: 1, [T.HELIPAD]: 1, [T.WALL]: 1, [T.CRACKED]: 1, [T.VOID]: 1 };
    for (const idStr of Object.keys(variants)) {
      const id = +idStr; const n = variants[id]; atlas[id] = [];
      for (let v = 0; v < n; v++) {
        const c = mk(TILE, TILE); const g = c.getContext('2d');
        drawTile(g, id, v); atlas[id].push(c);
      }
    }
  }
  function speckle(g, base, dotA, dotB, seed) {
    g.fillStyle = base; g.fillRect(0, 0, TILE, TILE);
    for (let i = 0; i < 10; i++) {
      const r = hash2(seed * 31 + i, i * 7);
      g.fillStyle = r > 0.5 ? dotA : dotB;
      g.fillRect((r * 97 | 0) % TILE, ((r * 41 + i * 3) | 0) % TILE, 1, 1);
    }
  }
  function drawTile(g, id, v) {
    switch (id) {
      case T.VOID: g.fillStyle = PAL.voidc; g.fillRect(0, 0, TILE, TILE); break;
      case T.STONE: speckle(g, [PAL.floor, PAL.floorB, PAL.floorC][v % 3], PAL.floorB, PAL.floorC, v + 1); break;
      case T.BLUESTONE: speckle(g, v ? PAL.blueB : PAL.blue, PAL.blue, PAL.blueB, v + 9); break;
      case T.MARBLE: g.fillStyle = v ? PAL.marbleA : PAL.marbleB; g.fillRect(0, 0, TILE, TILE); g.fillStyle = 'rgba(0,0,0,0.06)'; g.fillRect(0, TILE - 1, TILE, 1); break;
      case T.WOOD: {
        g.fillStyle = v ? PAL.wood : PAL.woodB; g.fillRect(0, 0, TILE, TILE);
        g.fillStyle = 'rgba(0,0,0,0.14)';
        for (let y = 3; y < TILE; y += 5) g.fillRect(0, y, TILE, 1);
        break;
      }
      case T.GOLDFLOOR: speckle(g, v ? PAL.goldFloor : PAL.goldFloorB, PAL.goldFloorB, PAL.gold, v + 21); break;
      case T.CARPET: {
        g.fillStyle = PAL.carpet; g.fillRect(0, 0, TILE, TILE);
        g.fillStyle = PAL.carpetEdge; g.fillRect(0, 0, TILE, 1); g.fillRect(0, TILE - 1, TILE, 1);
        break;
      }
      case T.RUNE: {
        speckle(g, PAL.blue, PAL.blue, PAL.blueB, 77);
        g.strokeStyle = PAL.light ? 'rgba(154,107,21,0.5)' : 'rgba(245,185,66,0.4)'; g.lineWidth = 1;
        g.strokeRect(4.5, 4.5, 7, 7); g.beginPath(); g.moveTo(8, 4.5); g.lineTo(8, 11.5); g.stroke();
        break;
      }
      case T.DAIS: {
        speckle(g, PAL.wood, PAL.wood, PAL.woodB, 88);
        g.fillStyle = PAL.light ? 'rgba(154,107,21,0.30)' : 'rgba(245,185,66,0.22)';
        g.beginPath(); g.arc(8, 8, 7, 0, 7); g.fill();
        break;
      }
      case T.HELIPAD: {
        speckle(g, PAL.floor, PAL.floorB, PAL.floorC, 99);
        g.strokeStyle = PAL.light ? '#9a6b15' : '#f5b942'; g.lineWidth = 1.5; g.globalAlpha = 0.65;
        g.beginPath(); g.arc(8, 8, 6, 0, 7); g.stroke(); g.globalAlpha = 1;
        break;
      }
      case T.WALL: {
        g.fillStyle = PAL.wall; g.fillRect(0, 0, TILE, TILE);
        g.fillStyle = PAL.wallTop; g.fillRect(0, 0, TILE, 2);
        g.fillStyle = PAL.wallDark; g.fillRect(0, TILE - 1, TILE, 1);
        g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(0, 7, TILE, 1);
        break;
      }
      case T.CRACKED: {
        drawTile(g, T.WALL, 0);
        g.strokeStyle = PAL.light ? 'rgba(60,50,30,0.55)' : 'rgba(200,210,235,0.30)'; g.lineWidth = 1;
        g.beginPath(); g.moveTo(4, 3); g.lineTo(7, 7); g.lineTo(5, 11); g.moveTo(7, 7); g.lineTo(11, 9); g.lineTo(12, 13); g.stroke();
        g.fillStyle = 'rgba(255,255,255,0.05)'; g.fillRect(0, 2, TILE, TILE - 3);
        break;
      }
    }
  }

  let world = mk(MAPW * TILE, MAPH * TILE);
  function bakeWorld() {
    const g = world.getContext('2d');
    g.imageSmoothingEnabled = false;
    for (let y = 0; y < MAPH; y++) for (let x = 0; x < MAPW; x++) {
      const id = gAt(x, y);
      const set = atlas[id] || atlas[T.VOID];
      const v = set.length > 1 ? Math.floor(hash2(x, y) * set.length) : 0;
      g.drawImage(set[v], x * TILE, y * TILE);
    }
    // Study bookshelf decor along north wall
    for (let x = 6; x <= 13; x++) if (x !== 7 && x !== 12) drawShelf(g, x * TILE, 5 * TILE);
  }
  function drawShelf(g, px, py) {
    g.fillStyle = PAL.woodB; g.fillRect(px + 1, py + 1, 14, 13);
    g.fillStyle = PAL.wood; g.fillRect(px + 2, py + 2, 12, 4); g.fillRect(px + 2, py + 8, 12, 4);
    const cols = PAL.light ? ['#9a6b15', '#7a5410', '#b3552e'] : ['#f5b942', '#5da9e9', '#ef6461'];
    for (let i = 0; i < 4; i++) { g.fillStyle = cols[i % 3]; g.fillRect(px + 3 + i * 3, py + 2, 2, 4); g.fillStyle = cols[(i + 1) % 3]; g.fillRect(px + 3 + i * 3, py + 8, 2, 4); }
  }

  // ---------------- Emoji rasters (with tofu fallback) ----------------
  const EMOJI_FONT = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
  const emojiCache = {};
  function rasterEmoji(ch, px) {
    const key = ch + px;
    if (emojiCache[key]) return emojiCache[key];
    const c = mk(px, px); const g = c.getContext('2d');
    g.font = (px - 4) + 'px ' + EMOJI_FONT;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(ch, px / 2, px / 2 + 1);
    // tofu check
    const data = g.getImageData(0, 0, px, px).data;
    let drawn = false;
    for (let i = 3; i < data.length; i += 16) if (data[i] > 8) { drawn = true; break; }
    if (!drawn) { g.fillStyle = PAL.gold; g.fillRect(px * 0.25, px * 0.25, px * 0.5, px * 0.5); }
    // Only cache a real glyph — on a cold load the emoji font may not be ready
    // yet, so a later frame re-rasterizes instead of caching gold squares forever.
    if (drawn) emojiCache[key] = c;
    return c;
  }

  // ---------------- Character sprites ----------------
  function makeRig(opts) {
    // 16x24, dirs: down/up/side, 2 frames each
    const frames = {};
    for (const dir of ['down', 'up', 'side']) {
      frames[dir] = [];
      for (let f = 0; f < 2; f++) {
        const c = mk(16, 24); const g = c.getContext('2d');
        // legs: frame 0 = standing, frame 1 = stride (left short, right long)
        const lH = f === 0 ? 4 : 3, rH = f === 0 ? 4 : 5;
        g.fillStyle = opts.pants;
        g.fillRect(4, 18, 3, lH); g.fillRect(9, 18, 3, rH);
        g.fillStyle = opts.shoes;
        g.fillRect(4, 18 + lH, 3, 2); g.fillRect(9, 18 + rH, 3, 2);
        // torso (hoodie / robe)
        g.fillStyle = opts.body; g.fillRect(3, 10, 10, 9);
        if (opts.robe) { g.fillRect(3, 10, 10, 13); }
        // arms
        g.fillStyle = opts.body;
        const sw = f === 1 ? 1 : 0;
        g.fillRect(1, 11 + sw, 2, 6); g.fillRect(13, 11 - sw, 2, 6);
        // zipper / trim
        if (dir !== 'up') { g.fillStyle = opts.trim; g.fillRect(7, 10, 1, 8); }
        // head
        g.fillStyle = opts.skin; g.fillRect(4, 2, 8, 8);
        // hair / hood
        g.fillStyle = opts.hair;
        g.fillRect(3, 1, 10, 3);
        g.fillRect(3, 1, 1, 5); g.fillRect(12, 1, 1, 5);
        if (dir === 'up') { g.fillRect(4, 2, 8, 7); }
        // face
        if (dir === 'down') {
          g.fillStyle = '#1a1205'; g.fillRect(6, 6, 1, 2); g.fillRect(9, 6, 1, 2);
        } else if (dir === 'side') {
          g.fillStyle = '#1a1205'; g.fillRect(9, 6, 1, 2);
        }
        if (opts.beard && dir !== 'up') { g.fillStyle = opts.beard; g.fillRect(dir === 'side' ? 7 : 5, 8, dir === 'side' ? 5 : 6, 2); }
        frames[dir].push(c);
      }
    }
    return frames;
  }
  let heroRig, sageRig;
  function bakeRigs() {
    heroRig = makeRig({ body: PAL.light ? '#27365c' : '#1d2740', trim: PAL.gold, pants: PAL.light ? '#4a5a7d' : '#31415f', shoes: '#15181f', skin: '#c98e5a', hair: '#241a10' });
    sageRig = makeRig({ body: PAL.light ? '#8e8878' : '#565d6e', trim: PAL.gold, pants: PAL.light ? '#8e8878' : '#565d6e', shoes: '#2a2d35', skin: '#d8b48a', hair: '#aab0bb', robe: true, beard: '#cfd4dc' });
  }

  // ---------------- Entities ----------------
  // kind: drawing recipe. core: counts toward completion. group: achievement group.
  const ENTITIES = [
    { id: 'sign_welcome', x: 28, y: 19, w: 1, h: 1, kind: 'sign', emoji: '', core: true, kicker: 'Signpost', title: 'Welcome, Traveler', body: "You've found the Dungeon of Isaac — Isaac Perez: iOS engineer, founder, Angeleno. Five wings, zero monsters, one suspiciously hireable hero. Walk up to anything glowing and press E. That's the whole tutorial." },
    { id: 'npc_sage', x: 24, y: 19, w: 1, h: 1, kind: 'sage', emoji: '', core: true, solid: false, kicker: 'NPC', title: 'The Old Sage', body: "I've swept these halls since the Objective-C era. Two tips, traveler: the Arcade's south wall has one brick too many... and if your thumbs still remember the old arcade dance — the one every 90s kid knows by heart — this dungeon answers to it." },
    { id: 'dungeon_cat', x: 24, y: 25, w: 1, h: 1, kind: 'emoji', emoji: '🐈‍⬛', core: false, solid: false, kicker: 'Cat', title: 'Dungeon Cat', body: 'Mrow. (The cat has audited all five wings and finds the code acceptable. This is the highest rating the cat gives.)' },
    { id: 'stairs_exit', x: 33, y: 25, w: 1, h: 1, kind: 'stairs', emoji: '', core: false, solid: false, kicker: 'Exit', title: 'Stairs to the Overworld', body: 'Beyond lies the classic site — same lore, fewer pixels. Your achievements climb with you.' },
    // Quest Arcade
    { id: 'cab_curbside', x: 42, y: 16, w: 1, h: 2, kind: 'cabinet', emoji: '🚚', accent: '#e8590c', core: true, group: 'project', kicker: 'Main Quest · In Progress', title: 'CurbSide', body: 'A street-food discovery iOS app for finding the taco truck before the line forms. Currently cooking, launching soon. Built in SwiftUI on a Supabase backend.', link: 'https://thecurbside.app', linkLabel: 'Visit thecurbside.app' },
    { id: 'cab_runsbyip', x: 45, y: 16, w: 1, h: 2, kind: 'cabinet', emoji: '🏀', accent: '#b86cff', core: true, group: 'project', kicker: 'Weekly Raid', title: 'Runs by IP', body: "Weekly pickup basketball in LA with RSVPs and payments built in — no flaky group chats, no 'who's got cash.' Founded, built, and occasionally crossed-over-at by Isaac. SwiftUI, Supabase, Stripe, with waitlists and a team randomizer under the hood.", link: 'https://runsbyip.com', linkLabel: 'Join at runsbyip.com' },
    { id: 'cab_kangs', x: 48, y: 16, w: 1, h: 2, kind: 'cabinet', emoji: '🍜', accent: '#4aa8ff', core: true, group: 'project', kicker: 'Side Quest', title: "Kang's Kuisine", body: 'Online ordering for a Korean pop-up kitchen: menu drops, pre-orders, instant sellouts. Next.js + Supabase + Stripe, with real-time inventory and an admin dashboard. (The tteokbokki handles marketing.)', link: 'https://kangskuisine.food', linkLabel: 'Order at kangskuisine.food' },
    { id: 'cab_teamup', x: 51, y: 16, w: 1, h: 2, kind: 'cabinet', emoji: '⚽', accent: '#4ade80', core: true, group: 'project', kicker: 'Live on the App Store', title: 'TeamUp', body: 'Find a pickup game for any sport and join in two taps. Shipped in SwiftUI on Firebase and live on the App Store right now — the one you can download mid-dungeon.', link: 'https://theteamup.app', linkLabel: 'Visit theteamup.app' },
    { id: 'pad_captured', x: 45, y: 24, w: 2, h: 2, kind: 'drone', emoji: '🚁', core: true, group: 'project', solid: false, kicker: 'The Aerial Mount', title: 'CapturedByIP', body: "Isaac's photography and drone brand: portraits, aerials, and golden-hour LA from angles the freeway will never know. The drone likes you — it'll tag along for the rest of the run.", link: 'https://capturedbyip.com', linkLabel: 'View capturedbyip.com' },
    { id: 'wall_cracked', x: 52, y: 29, w: 1, h: 1, kind: 'hidden', emoji: '', core: false, kicker: 'Hm?', title: 'A Suspicious Wall', body: "These bricks don't match. You push — and the wall slides aside with a satisfied click." },
    { id: 'shrine_taco', x: 52, y: 32, w: 1, h: 1, kind: 'taco', emoji: '🌮', core: false, kicker: 'Secret', title: 'The Golden Taco', body: "The hero's one documented weakness, enshrined in gold. You found the secret room — Curiosity stat maxed. (The Sage owes you a sweep of this floor.)" },
    // Campaign Hall
    { id: 'statue_tinder', x: 7, y: 20, w: 1, h: 2, kind: 'statue', emoji: '🔥', accent: '#fd5564', core: true, group: 'statue', kicker: 'Chapter II — Current', title: 'Guild of the Flame — Tinder', body: 'iOS Engineer, 2026–present. Building features for one of the world’s most-used dating apps — millions of users, where a dropped frame is a matter of the heart. Focus: launch performance and Xcode tooling.' },
    { id: 'statue_nextdoor', x: 13, y: 20, w: 1, h: 2, kind: 'statue', emoji: '🏘️', accent: '#8ed500', core: true, group: 'statue', kicker: 'Chapter I — 2021–2025', title: 'Guild of the Neighborhood — Nextdoor', body: 'iOS Engineer, 2021–2025. Four and a half years scaling the iOS app for millions of neighbors — core features in Swift, SwiftUI, TCA & Combine, and the experiments that decided what stayed. Every quest in the Arcade traces back here.' },
    // Skills Sanctum
    { id: 'crystal_ios', x: 24, y: 7, w: 1, h: 1, kind: 'crystal', accent: '#4aa8ff', stat: 96, core: true, group: 'crystal', kicker: 'Skill Crystal', title: 'iOS Development — 96', body: 'Forged in Swift, tempered across 5+ years of production iOS. The main weapon, fully upgraded.' },
    { id: 'crystal_mobile', x: 28, y: 7, w: 1, h: 1, kind: 'crystal', accent: '#2dd4bf', stat: 92, core: true, group: 'crystal', kicker: 'Skill Crystal', title: 'Mobile Apps — 92', body: "Five apps from prototype to App Store and counting. Here, shipping isn't a milestone — it's a habit." },
    { id: 'crystal_ai', x: 31, y: 7, w: 1, h: 1, kind: 'crystal', accent: '#4ade80', stat: 90, core: true, group: 'crystal', kicker: 'Skill Crystal', title: 'AI Tools — 90', body: 'Fights alongside the machines, not against them. A big part of why this dungeon shipped in one sitting.' },
    { id: 'crystal_startups', x: 24, y: 10, w: 1, h: 1, kind: 'crystal', accent: '#f5b942', stat: 88, core: true, group: 'crystal', kicker: 'Skill Crystal', title: 'Startups — 88', body: 'Founder-class stat: four products shipped solo. See the gap, build the thing, ship the thing, learn in public. Repeat.' },
    { id: 'crystal_photo', x: 28, y: 10, w: 1, h: 1, kind: 'crystal', accent: '#b86cff', stat: 85, core: true, group: 'crystal', kicker: 'Skill Crystal', title: 'Photography — 85', body: 'An off-hours specialization that went pro. Exhibit A hangs in the Rookery; Exhibit B flies.' },
    { id: 'crystal_drones', x: 31, y: 10, w: 1, h: 1, kind: 'crystal', accent: '#5da9e9', stat: 83, core: true, group: 'crystal', kicker: 'Skill Crystal', title: 'Drones — 83', body: 'Licensed aerial mount, steady hands, cinematic instincts. The sky is just another viewfinder.' },
    // Hero's Study
    { id: 'tome_about', x: 7, y: 6, w: 1, h: 1, kind: 'emojiBase', emoji: '📚', core: true, group: 'study', kicker: 'Lore', title: 'Tome of Origins', body: 'Isaac builds for real-world community — food trucks, pickup runs, neighborhoods that actually talk to each other. Doctrine: ship fast, learn in public, repeat.' },
    { id: 'tablet_stats', x: 10, y: 8, w: 1, h: 1, kind: 'emojiBase', emoji: '📜', core: true, group: 'study', kicker: 'Lore', title: 'The Attribute Sheet', body: 'Alignment: Chaotic Builder. Main Weapon: Swift. Mount: DJI Drone. Weakness: Street Tacos. (The scholars confirm all four.)' },
    { id: 'map_la', x: 12, y: 6, w: 1, h: 1, kind: 'emojiBase', emoji: '🗺️', core: true, group: 'study', kicker: 'Lore', title: 'Map of the Realm — Los Angeles', body: 'Home turf, test market, infinite taco supply. Every quest in this dungeon was playtested on these streets.' },
    // Rookery
    { id: 'mailbox_email', x: 24, y: 32, w: 1, h: 1, kind: 'emojiBase', emoji: '✉️', core: true, group: 'contact', kicker: 'Contact', title: 'The Raven Post', body: 'Quests, contracts, collabs, and good ideas: iperez2435@gmail.com. Replies arrive faster than the raven — and the raven is motivated.', link: 'mailto:iperez2435@gmail.com', linkLabel: 'Send a Raven' },
    { id: 'statue_github', x: 27, y: 32, w: 1, h: 1, kind: 'emojiBase', emoji: '🐙', core: true, group: 'contact', kicker: 'Contact', title: 'The Octocat Shrine', body: 'A thousand green squares and the occasional heroic 2 a.m. commit. The public quest log is open for inspection.', link: 'https://github.com/IsaacAPerez', linkLabel: 'Open GitHub' },
    { id: 'portal_linkedin', x: 30, y: 32, w: 1, h: 1, kind: 'emojiBase', emoji: '💼', core: true, group: 'contact', kicker: 'Contact', title: 'The Guild Registry', body: 'The official scroll of titles, dates, and endorsements. Recruiters roll with advantage here.', link: 'https://linkedin.com/in/isaacabelperez', linkLabel: 'Open LinkedIn' },
    { id: 'frame_instagram', x: 33, y: 32, w: 1, h: 1, kind: 'emojiBase', emoji: '📷', core: true, group: 'contact', kicker: 'Contact', title: 'The Scrying Glass', body: "Drone aerials, street food, and golden hour over LA. Visual proof the Photography crystal isn't bluffing.", link: 'https://instagram.com/isaacabelperez', linkLabel: 'Open Instagram' },
    { id: 'chest_resume', x: 27, y: 36, w: 1, h: 1, kind: 'chest', emoji: '', core: true, group: 'contact', kicker: 'Treasure', title: 'The Sacred Scroll', body: 'You got Resume.pdf — one page, zero fluff, +10 to Hiring Power. The chest restocks itself.', link: 'Resume.pdf', linkLabel: 'Take the Scroll' },
  ];
  const CORE_TOTAL = ENTITIES.filter(e => e.core).length;
  for (const e of ENTITIES) { e.px = e.x * TILE; e.py = e.y * TILE; if (e.solid === undefined) e.solid = true; }

  // ---------------- Player & NPC state ----------------
  const player = { x: 28.5 * TILE, y: 23.5 * TILE, dir: 'up', moving: false, frame: 0, ft: 0, dist: 0 };
  const sage = { x: 24 * TILE, y: 19.5 * TILE, tx: 24 * TILE, ty: 19.5 * TILE, t: 0, dir: 'down', frame: 0, taps: [] };
  const cat = { x: 24 * TILE, y: 25.5 * TILE, tx: 25 * TILE, ty: 25.5 * TILE, t: 1, follow: 0, fx: 0 };
  const drone = { x: 45.9 * TILE, y: 24.6 * TILE, active: !!state.drone, roll: 0, idleT: 0 };
  let particles = [];
  let tacoRain = [];
  let gameActive = false, playing = false, raf = 0, acc = 0, last = 0, time = 0;
  let hintUsed = false;
  let camX = 0, camY = 0, SCALE = 3, viewW = 0, viewH = 0, dpr = 1;
  let currentRoom = null, zoneFade = 0;

  // ---------------- Achievements glue ----------------
  function achStore() { try { return JSON.parse(localStorage.getItem('ip-achievements') || '[]'); } catch (e) { return []; } }
  function gUnlock(id) {
    if (typeof window.unlock === 'function') window.unlock(id);
    syncAchCount();
  }
  function syncAchCount() {
    const n = achStore().filter(a => a !== 'konami').length;
    const el = document.getElementById('gameAchCount');
    if (el) el.textContent = n + '/8';
  }

  function coreVisited() { return ENTITIES.filter(e => e.core && visited.has(e.id)).length; }
  function refreshProgress() {
    const fill = document.getElementById('gameProgressFill');
    if (fill) fill.style.width = (coreVisited() / CORE_TOTAL * 100) + '%';
    const star = document.getElementById('gameProgressStar');
    if (star) star.hidden = !state.vaultFound;
  }

  function markVisited(e) {
    if (visited.has(e.id)) return;
    visited.add(e.id);
    state.visited = [...visited];
    saveState();
    if (e.group === 'project') gUnlock('quests');
    if (e.group === 'crystal') gUnlock('statcheck');
    if (e.group === 'study') gUnlock('lorekeeper');
    if (e.group === 'contact') gUnlock('raven');
    if (e.group === 'statue' && visited.has('statue_tinder') && visited.has('statue_nextdoor')) gUnlock('historian');
    refreshProgress();
    if (e.core && coreVisited() === CORE_TOTAL) {
      gUnlock('completionist');
      if (!state.confetti) {
        state.confetti = true; saveState();
        burst(player.x, player.y - 10, 60, [PAL.gold, PAL.goldBright, PAL.goldDeep, '#fff'], 2.2);
        sfx('fanfare');
      }
    }
  }

  // ---------------- Audio (tiny synth, gesture-gated) ----------------
  let ac = null;
  function ensureAudio() { if (!ac) { try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { ac = null; } } }
  function tone(freq, t0, dur, type, gain) {
    if (!ac) return;
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type || 'triangle'; o.frequency.value = freq;
    g.gain.setValueAtTime(0, ac.currentTime + t0);
    g.gain.linearRampToValueAtTime(gain || 0.05, ac.currentTime + t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + t0 + dur);
    o.connect(g); g.connect(ac.destination);
    o.start(ac.currentTime + t0); o.stop(ac.currentTime + t0 + dur + 0.05);
  }
  function sfx(name) {
    if (state.muted || !ac) return;
    if (name === 'blip') tone(620, 0, 0.07, 'square', 0.025);
    else if (name === 'close') tone(420, 0, 0.06, 'square', 0.02);
    else if (name === 'chime') { tone(740, 0, 0.25, 'sine', 0.04); tone(1108, 0.08, 0.3, 'sine', 0.03); }
    else if (name === 'fanfare') { tone(523, 0, 0.16, 'triangle', 0.05); tone(659, 0.14, 0.16, 'triangle', 0.05); tone(784, 0.28, 0.34, 'triangle', 0.06); }
    else if (name === 'meow') { tone(880, 0, 0.09, 'sine', 0.03); tone(660, 0.07, 0.12, 'sine', 0.025); }
    else if (name === 'step') tone(118 + hash2(player.dist | 0, 3) * 42, 0, 0.045, 'triangle', 0.016);
    else if (name === 'near') tone(880, 0, 0.05, 'sine', 0.018);
  }

  // ---------------- Particles ----------------
  function burst(x, y, n, colors, life) {
    for (let i = 0; i < n; i++) {
      if (particles.length >= 80) break;
      const a = (i / n) * Math.PI * 2 + hash2(i, n);
      const sp = 30 + hash2(i, 3) * 60;
      particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 40, g: 90, life: life || 1, t: 0, color: colors[i % colors.length], size: 2 });
    }
  }
  function hearts(x, y) {
    for (let i = 0; i < 4; i++) particles.push({ x: x + (hash2(i, 9) - 0.5) * 12, y, vx: 0, vy: -18, g: 0, life: 0.9, t: 0, color: '#ef6461', size: 2, heart: true });
  }
  function dust(x, y) {
    if (REDUCED || particles.length >= 40) return;
    particles.push({ x: x + (hash2(time * 60 | 0, 5) - 0.5) * 8, y, vx: 0, vy: -6, g: 0, life: 0.5, t: 0, color: PAL.light ? 'rgba(120,100,60,0.5)' : 'rgba(220,220,255,0.25)', size: 1.5 });
  }
  function startTacoRain() {
    tacoRain = [];
    for (let i = 0; i < 20; i++) tacoRain.push({ x: hash2(i, 1) , y: -hash2(i, 2) * 0.8, v: 0.35 + hash2(i, 3) * 0.5, r: hash2(i, 4) * 6 });
    gUnlock('konami');
    sfx('fanfare');
  }

  // ---------------- Collision & movement ----------------
  function solidAt(px, py) {
    const tx = Math.floor(px / TILE), ty = Math.floor(py / TILE);
    const id = gAt(tx, ty);
    if (!isFloorId(id)) return true;
    return false;
  }
  function entityBlocks(px, py, hw, hh) {
    for (const e of ENTITIES) {
      if (!e.solid) continue;
      if (e.id === 'wall_cracked') continue; // baked into the wall grid
      if (e.id === 'shrine_taco' && !state.vaultOpen) continue;
      const ex1 = e.px, ey1 = e.py, ex2 = e.px + e.w * TILE, ey2 = e.py + e.h * TILE;
      if (px + hw > ex1 && px - hw < ex2 && py + hh > ey1 && py - hh < ey2) return true;
    }
    return false;
  }
  function canStand(px, py) {
    const hw = 6, hh = 5; // feet box 12x10
    if (solidAt(px - hw, py - hh) || solidAt(px + hw, py - hh) || solidAt(px - hw, py + hh) || solidAt(px + hw, py + hh)) return false;
    if (entityBlocks(px, py, hw, hh)) return false;
    return true;
  }
  function moveActor(a, dx, dy, dt, speed) {
    if (dx || dy) {
      const len = Math.hypot(dx, dy); dx /= len; dy /= len;
      const nx = a.x + dx * speed * dt, ny = a.y + dy * speed * dt;
      if (canStand(nx, a.y)) a.x = nx;
      if (canStand(a.x, ny)) a.y = ny;
    }
  }

  // ---------------- Input ----------------
  const keys = {};
  const KONAMI = ['arrowup', 'arrowup', 'arrowdown', 'arrowdown', 'arrowleft', 'arrowright', 'arrowleft', 'arrowright', 'b', 'a'];
  let kIdx = 0;
  window.addEventListener('keydown', (ev) => {
    if (!gameActive) return;
    const k = ev.key.toLowerCase();
    if (dialogOpen) {
      // Let Enter/Space activate a focused link/button inside the dialog
      const onAction = document.activeElement && document.activeElement.closest &&
        document.activeElement.closest('.game-dialog-actions');
      if ((k === 'enter' || k === ' ') && onAction) return;
      if (k === 'e' || k === 'escape' || k === 'enter' || k === ' ') {
        if (typing) finishType(); else closeDialog();
        ev.preventDefault();
      }
      if (k === 'tab') trapFocus(ev);
      return;
    }
    if (!playing) return;
    // game-side konami (parallel to the site's — unlock() dedupes); gated so it
    // can't advance while a dialog is open or the game is paused
    kIdx = (k === KONAMI[kIdx]) ? kIdx + 1 : (k === KONAMI[0] ? 1 : 0);
    if (kIdx === KONAMI.length) { kIdx = 0; startTacoRain(); }
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'w', 'a', 's', 'd', ' ', 'e', 'enter'].includes(k)) ev.preventDefault();
    keys[k] = true;
    if (k === 'e' || k === ' ' || k === 'enter') tryInteract();
    if (k === 'escape') exitGame();
  });
  window.addEventListener('keyup', (ev) => { keys[ev.key.toLowerCase()] = false; });

  // Touch
  const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  const joy = { active: false, id: null, dx: 0, dy: 0, ox: 0, oy: 0 };
  if (isTouch) root.classList.add('touch');
  const joyEl = document.getElementById('gameJoystick');
  const stickEl = document.getElementById('gameJoystickStick');
  // Movement is relative to where the thumb first landed, so touching the pad's
  // edge doesn't start the hero pre-walking.
  function joyFrom(t) {
    let dx = t.clientX - joy.ox, dy = t.clientY - joy.oy;
    const len = Math.hypot(dx, dy), max = 40;
    if (len > max) { dx = dx / len * max; dy = dy / len * max; }
    stickEl.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
    joy.dx = Math.abs(dx) / max > 0.12 ? dx / max : 0;
    joy.dy = Math.abs(dy) / max > 0.12 ? dy / max : 0;
  }
  function joyReset() { joy.active = false; joy.id = null; joy.dx = 0; joy.dy = 0; stickEl.style.transform = 'translate(-50%,-50%)'; }
  function nearJoystick(t) {
    const r = joyEl.getBoundingClientRect(), m = 30;
    return t.clientX >= r.left - m && t.clientX <= r.right + m && t.clientY >= r.top - m && t.clientY <= r.bottom + m;
  }
  root.addEventListener('touchstart', (ev) => {
    if (!playing) return;
    for (const t of ev.changedTouches) {
      if (!joy.active && nearJoystick(t)) {
        joy.active = true; joy.id = t.identifier; joy.ox = t.clientX; joy.oy = t.clientY; joyFrom(t); ev.preventDefault();
      } else if (ev.target === canvas) {
        // tap-to-interact: tap an entity near the player
        tapInteract(t.clientX, t.clientY);
      }
    }
  }, { passive: false });
  root.addEventListener('touchmove', (ev) => {
    for (const t of ev.changedTouches) if (joy.active && t.identifier === joy.id) { joyFrom(t); ev.preventDefault(); }
  }, { passive: false });
  function endTouch(ev) {
    for (const t of ev.changedTouches) if (joy.active && t.identifier === joy.id) joyReset();
  }
  root.addEventListener('touchend', endTouch);
  root.addEventListener('touchcancel', endTouch);
  const actionBtn = document.getElementById('gameActionBtn');
  actionBtn.addEventListener('touchstart', (ev) => { ev.preventDefault(); ev.stopPropagation(); if (dialogOpen) { typing ? finishType() : closeDialog(); } else tryInteract(); }, { passive: false });
  actionBtn.addEventListener('click', (ev) => { ev.stopPropagation(); if (dialogOpen) { typing ? finishType() : closeDialog(); } else tryInteract(); });

  function screenToWorld(sx, sy) {
    const r = canvas.getBoundingClientRect();
    return [camX + (sx - r.left) / SCALE, camY + (sy - r.top) / SCALE];
  }
  function tapInteract(sx, sy) {
    if (dialogOpen) { typing ? finishType() : closeDialog(); return; }
    const [wx, wy] = screenToWorld(sx, sy);
    for (const e of ENTITIES) {
      if (e.id === 'wall_cracked' && state.vaultOpen) continue;
      if (e.id === 'shrine_taco' && !state.vaultOpen) continue;
      const cx = e.px + e.w * TILE / 2, cy = e.py + e.h * TILE / 2;
      if (Math.abs(wx - cx) < TILE && Math.abs(wy - cy) < TILE &&
          Math.hypot(player.x - cx, player.y - cy) < 2.2 * TILE) {
        // mobile konami: 5 taps on the sage within 2s
        if (e.id === 'npc_sage') {
          sage.taps.push(time);
          sage.taps = sage.taps.filter(t => time - t < 2);
          if (sage.taps.length >= 5) { sage.taps = []; startTacoRain(); return; }
        }
        interact(e);
        return;
      }
    }
  }

  // ---------------- Interaction ----------------
  function interactTarget() {
    let best = null, bd = 1.6 * TILE;
    for (const e of ENTITIES) {
      if (e.id === 'wall_cracked' && state.vaultOpen) continue;
      if (e.id === 'shrine_taco' && !state.vaultOpen) continue;
      const cx = e.px + e.w * TILE / 2, cy = e.py + e.h * TILE / 2;
      let d = Math.hypot(player.x - cx, player.y - (cy + (e.h > 1 ? e.h * TILE / 4 : 0)));
      if (e.w > 1 || e.h > 1) d -= TILE * 0.4;
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  }
  function tryInteract() { const e = interactTarget(); if (e) interact(e); }

  function interact(e) {
    ensureAudio();
    hintUsed = true;
    if (e.id === 'wall_cracked') {
      openDialog(e);
      if (!state.vaultOpen) {
        state.vaultOpen = true; state.vaultFound = true; saveState();
        buildMap(); bakeWorld(); refreshProgress(); sfx('chime');
      }
      return;
    }
    if (e.id === 'shrine_taco' && !state.vaultFound) { state.vaultFound = true; saveState(); refreshProgress(); }
    if (e.id === 'dungeon_cat') { hearts(cat.x, cat.y - 14); cat.follow = 5 * TILE; sfx('meow'); }
    else if (e.id === 'pad_captured' && !state.drone) { state.drone = true; drone.active = true; drone.roll = REDUCED ? 0 : Math.PI * 2; saveState(); sfx('chime'); }
    else if (e.id === 'chest_resume' && !state.chestOpened) {
      state.chestOpened = true; saveState();
      burst(e.px + 8, e.py, 12, [PAL.gold, PAL.goldBright, '#fff'], 1.4);
      sfx('fanfare');
    } else sfx('blip');
    openDialog(e);
    if (e.core) markVisited(e);
  }

  // ---------------- Dialog ----------------
  const dlg = document.getElementById('gameDialog');
  const dlgEmoji = document.getElementById('gameDialogEmoji');
  const dlgKicker = document.getElementById('gameDialogKicker');
  const dlgTitle = document.getElementById('gameDialogTitle');
  const dlgBody = document.getElementById('gameDialogBody');
  const dlgActions = document.getElementById('gameDialogActions');
  const dlgClose = document.getElementById('gameDialogClose');
  let dialogOpen = false, typing = false, typeTimer = 0, fullText = '';

  function sageBody() {
    return coreVisited() === CORE_TOTAL
      ? "You read EVERYTHING? Hired. Wait — no, that's my line."
      : ENTITIES.find(x => x.id === 'npc_sage').body;
  }

  function openDialog(e) {
    dialogOpen = true;
    const KIND_EMOJI = { sign: '🪧', sage: '🧙', stairs: '🪜', cabinet: e.emoji, crystal: '💎', statue: e.emoji, chest: '🪙', drone: '🚁', taco: '🌮', hidden: '🧱' };
    dlgEmoji.textContent = e.emoji || KIND_EMOJI[e.kind] || '📜';
    dlgKicker.textContent = e.kicker || '';
    dlgTitle.textContent = e.title;
    fullText = e.id === 'npc_sage' ? sageBody() : e.body;
    dlgBody.textContent = '';
    dlgActions.innerHTML = '';
    // stat bar for crystals
    if (e.kind === 'crystal') {
      const wrap = document.createElement('div');
      wrap.style.cssText = 'display:flex;align-items:center;gap:10px;margin-top:4px;width:100%;';
      wrap.innerHTML = `<div class="stat-track" style="flex:1"><div class="stat-fill"></div></div><span class="stat-num">${e.stat}</span>`;
      dlgActions.appendChild(wrap);
      requestAnimationFrame(() => requestAnimationFrame(() => { wrap.querySelector('.stat-fill').style.width = e.stat + '%'; }));
    }
    if (e.link) {
      const a = document.createElement('a');
      a.className = 'btn btn-gold';
      a.href = e.link;
      if (!e.link.startsWith('mailto:')) { a.target = '_blank'; a.rel = 'noopener'; }
      a.textContent = e.linkLabel || 'Open';
      a.addEventListener('click', () => { if (e.group === 'contact') gUnlock('raven'); });
      dlgActions.appendChild(a);
    }
    if (e.id === 'stairs_exit') {
      const b = document.createElement('button');
      b.className = 'btn btn-gold'; b.textContent = 'Step Through';
      b.addEventListener('click', () => { closeDialog(); exitGame(); });
      dlgActions.appendChild(b);
      const k = document.createElement('button');
      k.className = 'btn btn-ghost'; k.textContent = 'Keep Exploring';
      k.addEventListener('click', closeDialog);
      dlgActions.appendChild(k);
    }
    dlg.classList.add('open');
    dlg.setAttribute('aria-modal', 'true');
    // typewriter
    if (REDUCED) { dlgBody.textContent = fullText; typing = false; }
    else { typing = true; typeTimer = 0; }
    const focusable = dlgActions.querySelector('a,button') || dlgClose;
    setTimeout(() => focusable.focus({ preventScroll: true }), 60);
  }
  function finishType() { dlgBody.textContent = fullText; typing = false; }
  function closeDialog() {
    dialogOpen = false; typing = false;
    dlg.classList.remove('open');
    dlg.setAttribute('aria-modal', 'false');
    sfx('close');
    canvas.focus({ preventScroll: true });
  }
  dlgClose.addEventListener('click', closeDialog);
  function trapFocus(ev) {
    const els = [...dlg.querySelectorAll('a,button')].filter(el => el.offsetParent !== null);
    if (!els.length) return;
    const first = els[0], lastEl = els[els.length - 1];
    if (ev.shiftKey && document.activeElement === first) { lastEl.focus(); ev.preventDefault(); }
    else if (!ev.shiftKey && document.activeElement === lastEl) { first.focus(); ev.preventDefault(); }
  }

  // ---------------- Rooms / zone label ----------------
  function roomAt(tx, ty) {
    for (const r of ROOMS) if (tx >= r.x1 && tx <= r.x2 && ty >= r.y1 && ty <= r.y2) return r;
    return null;
  }
  function updateZone() {
    const r = roomAt(Math.floor(player.x / TILE), Math.floor(player.y / TILE));
    if (r && r !== currentRoom) {
      currentRoom = r;
      const label = document.getElementById('gameZoneLabel');
      if (label) {
        label.textContent = r.title;
        label.style.transition = 'none';
        label.style.opacity = '0';
        void label.offsetWidth; // flush so the next transition runs
        label.style.transition = 'opacity 0.4s';
        label.style.opacity = '1';
      }
    }
  }

  // ---------------- Update ----------------
  function update(dt) {
    time += dt;
    // player input
    let dx = (keys['arrowright'] || keys['d'] ? 1 : 0) - (keys['arrowleft'] || keys['a'] ? 1 : 0) + joy.dx;
    let dy = (keys['arrowdown'] || keys['s'] ? 1 : 0) - (keys['arrowup'] || keys['w'] ? 1 : 0) + joy.dy;
    if (dialogOpen) { dx = 0; dy = 0; }
    player.moving = !!(dx || dy);
    if (player.moving) {
      if (Math.abs(dx) >= Math.abs(dy)) player.dir = dx > 0 ? 'right' : 'left';
      else player.dir = dy > 0 ? 'down' : 'up';
      const ox = player.x, oy = player.y;
      moveActor(player, dx, dy, dt, PLAYER_SPEED * Math.min(1, Math.hypot(dx, dy)));
      const moved = Math.hypot(player.x - ox, player.y - oy);
      player.dist += moved;
      player.ft += dt;
      if (player.ft > 0.14) { player.ft = 0; player.frame = 1 - player.frame; if (player.frame) { dust(player.x, player.y + 10); sfx('step'); } }
      if (cat.follow > 0) cat.follow -= moved;
      drone.idleT = 0;
    } else { player.frame = 0; drone.idleT += dt; }

    // typewriter
    if (typing) {
      typeTimer += dt * 45;
      const n = Math.min(fullText.length, typeTimer | 0);
      dlgBody.textContent = fullText.slice(0, n);
      if (n >= fullText.length) typing = false;
    }

    // sage wander
    sage.t -= dt;
    if (sage.t <= 0) {
      sage.t = 2 + hash2(time * 13 | 0, 7) * 3;
      sage.tx = (23 + hash2(time * 7 | 0, 3) * 2.6) * TILE;
      sage.ty = (19.4 + hash2(time * 11 | 0, 5) * 1.2) * TILE;
    }
    if (!dialogOpen) {
      const sdx = sage.tx - sage.x, sdy = sage.ty - sage.y;
      if (Math.hypot(sdx, sdy) > 2) {
        sage.x += sdx * dt * 0.8; sage.y += sdy * dt * 0.8;
        sage.dir = Math.abs(sdx) > Math.abs(sdy) ? (sdx > 0 ? 'right' : 'left') : (sdy > 0 ? 'down' : 'up');
        sage.frame = (time * 4 | 0) % 2;
      } else sage.frame = 0;
    } else {
      sage.dir = player.x < sage.x ? 'left' : 'right';
    }
    ENTITIES.find(e => e.id === 'npc_sage').px = sage.x - 8;
    ENTITIES.find(e => e.id === 'npc_sage').py = sage.y - 8;

    // cat
    if (cat.follow > 0) {
      const cdx = player.x - cat.x, cdy = player.y - cat.y, d = Math.hypot(cdx, cdy);
      if (d > TILE * 1.2) { cat.x += cdx / d * 60 * dt; cat.y += cdy / d * 60 * dt; }
    } else {
      cat.t -= dt;
      if (cat.t <= 0) { cat.t = 2.5 + hash2(time * 17 | 0, 2) * 3; cat.tx = (22.5 + hash2(time * 5 | 0, 8) * 3.5) * TILE; cat.ty = (24.4 + hash2(time * 3 | 0, 4) * 1.6) * TILE; }
      const cdx = cat.tx - cat.x, cdy = cat.ty - cat.y;
      if (Math.hypot(cdx, cdy) > 2) { cat.x += cdx * dt * 0.7; cat.y += cdy * dt * 0.7; }
    }
    const catEnt = ENTITIES.find(e => e.id === 'dungeon_cat');
    catEnt.px = cat.x - 8; catEnt.py = cat.y - 8;

    // drone companion
    if (state.drone) {
      const behind = { up: [0, 24], down: [0, -24], left: [24, 0], right: [-24, 0] }[player.dir];
      const k2 = Math.min(1, dt * (REDUCED ? 60 : 4.8));
      drone.x += (player.x + behind[0] - drone.x) * k2;
      drone.y += (player.y + behind[1] - 14 - drone.y) * k2;
      if (drone.roll > 0) drone.roll = Math.max(0, drone.roll - dt * 7);
      if (!REDUCED && drone.idleT > 5 && drone.roll <= 0) { drone.roll = Math.PI * 2; drone.idleT = 0; }
    }

    // particles
    for (const p of particles) { p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += (p.g || 0) * dt; }
    particles = particles.filter(p => p.t < p.life);
    for (const t of tacoRain) t.y += t.v * dt;
    tacoRain = tacoRain.filter(t => t.y < 1.2);

    // camera
    const targetX = player.x - viewW / 2, targetY = player.y - viewH / 2;
    const k = REDUCED ? 1 : Math.min(1, dt * 7);
    camX += (targetX - camX) * k; camY += (targetY - camY) * k;
    camX = Math.max(0, Math.min(MAPW * TILE - viewW, camX));
    camY = Math.max(0, Math.min(MAPH * TILE - viewH, camY));

    updateZone();

    // interaction target: chirp + glyph pop the moment a new target comes in range
    const tgt = dialogOpen ? null : interactTarget();
    const tgtId = tgt ? tgt.id : null;
    if (tgtId && tgtId !== lastTargetId) { sfx('near'); promptPop = REDUCED ? 0 : 0.18; }
    lastTargetId = tgtId;
    if (promptPop > 0) promptPop = Math.max(0, promptPop - dt);
    if (isTouch) actionBtn.classList.toggle('ready', !!tgt);
  }
  let lastTargetId = null, promptPop = 0;

  // ---------------- Render ----------------
  function drawShadow(x, y, w) {
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(sx(x), sy(y), w * SCALE / 2, 2.2 * SCALE, 0, 0, 7);
    ctx.fill();
  }
  function sx(wx) { return Math.round((wx - camX) * SCALE); }
  function sy(wy) { return Math.round((wy - camY) * SCALE); }

  function drawRig(rig, x, y, dir, frame, bob) {
    const side = dir === 'left' || dir === 'right';
    const img = rig[side ? 'side' : dir][frame];
    const w = 16 * SCALE, h = 24 * SCALE;
    drawShadow(x, y + 10, 12);
    ctx.save();
    if (dir === 'left') { ctx.translate(sx(x), 0); ctx.scale(-1, 1); ctx.translate(-sx(x), 0); }
    ctx.drawImage(img, sx(x) - w / 2, sy(y) - h + 10 * SCALE + (bob || 0) * SCALE, w, h);
    ctx.restore();
  }

  function drawEntity(e) {
    const px = e.px, py = e.py;
    const X = sx(px), Y = sy(py);
    const S = SCALE;
    // desynced by position so a room of crystals shimmers instead of beating in lockstep
    const pulse = REDUCED ? 0.5 : (Math.sin(time * Math.PI + (px + py) * 0.05) + 1) / 2;
    switch (e.kind) {
      case 'sign': {
        drawShadow(px + 8, py + 14, 11);
        ctx.fillStyle = '#6b4a2a'; ctx.fillRect(X + 7 * S, Y + 6 * S, 2 * S, 9 * S);
        ctx.fillStyle = '#8a623c'; ctx.fillRect(X + 2 * S, Y + 1 * S, 12 * S, 7 * S);
        ctx.strokeStyle = PAL.gold; ctx.lineWidth = S; ctx.strokeRect(X + 2 * S, Y + 1 * S, 12 * S, 7 * S);
        ctx.fillStyle = PAL.light ? '#3a2c14' : '#f0e2bb';
        ctx.fillRect(X + 4 * S, Y + 3 * S, 8 * S, S); ctx.fillRect(X + 4 * S, Y + 5 * S, 6 * S, S);
        break;
      }
      case 'sage': drawRig(sageRig, sage.x, sage.y, sage.dir, sage.frame); return;
      case 'emoji': { // cat
        drawShadow(cat.x, cat.y + 7, 10);
        ctx.drawImage(rasterEmoji(e.emoji, 32), sx(cat.x) - 7 * S, sy(cat.y) - 11 * S, 14 * S, 14 * S);
        return;
      }
      case 'stairs': {
        for (let i = 0; i < 4; i++) {
          ctx.fillStyle = i % 2 ? PAL.gold : PAL.goldDeep;
          ctx.globalAlpha = 0.55 + pulse * 0.45;
          ctx.fillRect(X + i * S, Y + (12 - i * 3) * S, (16 - i * 2) * S, 3 * S);
        }
        ctx.globalAlpha = 1;
        break;
      }
      case 'cabinet': {
        const acc = e.accent || PAL.gold;
        drawShadow(px + 8, py + 30, 14);
        ctx.fillStyle = PAL.light ? '#5a5142' : '#10141f';
        ctx.fillRect(X + 1 * S, Y + 0, 14 * S, 30 * S);
        ctx.fillStyle = acc; ctx.fillRect(X + 1 * S, Y, 14 * S, 4 * S);
        ctx.fillStyle = PAL.light ? '#fffaf0' : '#1c2540';
        ctx.fillRect(X + 3 * S, Y + 6 * S, 10 * S, 9 * S);
        if (!REDUCED && ((time * 2 | 0) % 2)) { ctx.fillStyle = 'rgba(255,255,255,0.07)'; ctx.fillRect(X + 3 * S, Y + 6 * S, 10 * S, 2 * S); }
        ctx.drawImage(rasterEmoji(e.emoji, 32), X + 4 * S, Y + 6.5 * S, 8 * S, 8 * S);
        ctx.fillStyle = PAL.light ? '#4a4334' : '#0a0d15';
        ctx.fillRect(X + 2 * S, Y + 17 * S, 12 * S, 4 * S);
        ctx.fillStyle = acc; ctx.fillRect(X + 4 * S, Y + 18 * S, 2 * S, 2 * S); ctx.fillRect(X + 10 * S, Y + 18 * S, 2 * S, 2 * S);
        if (e.id === 'cab_teamup') { ctx.fillStyle = PAL.gold; ctx.fillRect(X + 11 * S, Y + 1 * S, 4 * S, 2 * S); }
        break;
      }
      case 'drone': {
        // helipad drone (pre-pickup) — bobbing
        if (!state.drone) {
          const bob = REDUCED ? 0 : Math.sin(time * 2.4) * 2;
          drawShadow(px + TILE, py + TILE * 1.6, 14);
          ctx.drawImage(rasterEmoji('🚁', 32), sx(px + 4), sy(py + 2 + bob), 24 * S, 24 * S);
        }
        return;
      }
      case 'hidden': return; // cracked wall is baked into the world
      case 'taco': {
        if (!state.vaultOpen) return;
        ctx.fillStyle = PAL.goldDeep; ctx.fillRect(X + 4 * S, Y + 10 * S, 8 * S, 5 * S);
        ctx.fillStyle = PAL.gold; ctx.fillRect(X + 3 * S, Y + 9 * S, 10 * S, 2 * S);
        const bob2 = REDUCED ? 0 : Math.sin(time * 2) * 2;
        ctx.save();
        ctx.translate(X + 8 * S, Y + (2 + bob2) * S);
        if (!REDUCED) ctx.rotate(Math.sin(time * 0.8) * 0.25);
        ctx.drawImage(rasterEmoji('🌮', 32), -9 * S, -7 * S, 18 * S, 18 * S);
        ctx.restore();
        if (!REDUCED && hash2(time * 8 | 0, 4) > 0.6) {
          ctx.fillStyle = PAL.goldBright; ctx.globalAlpha = 0.8;
          ctx.fillRect(X + (2 + hash2(time * 8 | 0, 9) * 12) * S, Y + hash2(time * 8 | 0, 11) * 8 * S, S, S);
          ctx.globalAlpha = 1;
        }
        break;
      }
      case 'statue': {
        drawShadow(px + 8, py + 30, 13);
        // banner
        ctx.fillStyle = e.accent; ctx.globalAlpha = 0.85;
        ctx.fillRect(X + 3 * S, Y - 8 * S, 10 * S, 7 * S);
        ctx.globalAlpha = 1;
        ctx.fillStyle = PAL.gold; ctx.fillRect(X + 3 * S, Y - 9 * S, 10 * S, S);
        // plinth + figure
        ctx.fillStyle = PAL.light ? '#b9ae90' : '#39435f';
        ctx.fillRect(X + 2 * S, Y + 24 * S, 12 * S, 6 * S);
        ctx.fillStyle = PAL.light ? '#cabf9f' : '#46527a';
        ctx.fillRect(X + 4 * S, Y + 8 * S, 8 * S, 16 * S);
        ctx.fillRect(X + 5 * S, Y + 4 * S, 6 * S, 6 * S);
        ctx.drawImage(rasterEmoji(e.emoji, 32), X + 4 * S, Y - 6.5 * S, 8 * S, 8 * S);
        break;
      }
      case 'crystal': {
        drawShadow(px + 8, py + 15, 9);
        ctx.fillStyle = PAL.light ? '#b9ae90' : '#39435f';
        ctx.fillRect(X + 4 * S, Y + 10 * S, 8 * S, 5 * S);
        ctx.fillRect(X + 5 * S, Y + 8 * S, 6 * S, 3 * S);
        const a = 0.55 + pulse * 0.45;
        ctx.globalAlpha = a;
        ctx.fillStyle = e.accent;
        ctx.beginPath();
        ctx.moveTo(X + 8 * S, Y - 2 * S);
        ctx.lineTo(X + 12 * S, Y + 4 * S);
        ctx.lineTo(X + 8 * S, Y + 10 * S);
        ctx.lineTo(X + 4 * S, Y + 4 * S);
        ctx.closePath(); ctx.fill();
        ctx.globalAlpha = a * 0.5; ctx.fillStyle = '#fff';
        ctx.fillRect(X + 7 * S, Y + 1 * S, S, 3 * S);
        ctx.globalAlpha = 1;
        break;
      }
      case 'emojiBase': {
        drawShadow(px + 8, py + 15, 9);
        ctx.fillStyle = PAL.light ? '#b9ae90' : '#39435f';
        ctx.fillRect(X + 3 * S, Y + 11 * S, 10 * S, 4 * S);
        ctx.drawImage(rasterEmoji(e.emoji, 32), X + 2.5 * S, Y - 1 * S, 11 * S, 11 * S);
        break;
      }
      case 'chest': {
        drawShadow(px + 8, py + 15, 11);
        const open = state.chestOpened;
        ctx.fillStyle = PAL.goldDeep;
        ctx.fillRect(X + 2 * S, Y + (open ? 6 : 4) * S, 12 * S, 9 * S);
        ctx.fillStyle = PAL.gold;
        ctx.fillRect(X + 2 * S, Y + (open ? 2 : 4) * S, 12 * S, 3 * S);
        ctx.fillStyle = PAL.goldBright;
        ctx.fillRect(X + 7 * S, Y + (open ? 5 : 7) * S, 2 * S, 3 * S);
        if (!REDUCED && hash2(time * 6 | 0, 13) > 0.55) {
          ctx.fillStyle = '#fff'; ctx.globalAlpha = 0.7;
          ctx.fillRect(X + (3 + hash2(time * 6 | 0, 17) * 10) * S, Y - (1 + hash2(time * 6 | 0, 19) * 5) * S, S, S);
          ctx.globalAlpha = 1;
        }
        break;
      }
    }
    // visited check pip
    if (e.core && visited.has(e.id)) {
      const ty = e.kind === 'cabinet' || e.kind === 'statue' ? Y - 12 * S : Y - 6 * S;
      ctx.fillStyle = PAL.gold;
      ctx.font = `${7 * S}px ${'"JetBrains Mono",monospace'}`;
      ctx.textAlign = 'center';
      ctx.fillText('✓', X + 8 * S, (e.kind === 'statue' ? Y - 11 * S : ty));
    }
  }

  function render() {
    const cw = canvas.width / dpr, ch = canvas.height / dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = PAL.voidc;
    ctx.fillRect(0, 0, cw, ch);
    // world
    const icx = Math.round(camX), icy = Math.round(camY);
    ctx.drawImage(world, icx, icy, viewW, viewH, 0, 0, viewW * SCALE, viewH * SCALE);

    // torch glow + flames
    for (const [tx, ty] of TORCHES) {
      const X = sx(tx * TILE), Y = sy(ty * TILE);
      if (X < -60 || Y < -60 || X > cw + 60 || Y > ch + 60) continue;
      const fl = REDUCED ? 0 : ((time * 6 + tx * 3.7 + ty) | 0) % 2;
      ctx.fillStyle = '#6b4a2a'; ctx.fillRect(X + 7 * SCALE, Y + 8 * SCALE, 2 * SCALE, 5 * SCALE);
      ctx.fillStyle = fl ? '#ffb13d' : '#ff8b3d';
      ctx.fillRect(X + 6 * SCALE, Y + 4 * SCALE, 4 * SCALE, 4 * SCALE);
      ctx.fillStyle = '#ffe08a';
      ctx.fillRect(X + 7 * SCALE, Y + (5 + fl) * SCALE, 2 * SCALE, 2 * SCALE);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = (PAL.light ? 0.22 : 0.5) + (fl ? 0.1 : 0);
      ctx.drawImage(glowSprite(), X - 16 * SCALE, Y - 14 * SCALE, 36 * SCALE, 36 * SCALE);
      ctx.restore();
      ctx.globalAlpha = 1;
    }

    // entities y-sorted with player
    const drawables = ENTITIES.filter(e => e.kind !== 'hidden' && !(e.kind === 'taco' && !state.vaultOpen));
    const items = drawables.map(e => ({ y: e.py + e.h * TILE, f: () => drawEntity(e) }));
    const idleBob = (!player.moving && !REDUCED) ? Math.sin(time * 2.2) * 0.6 : 0;
    items.push({ y: player.y + 10, f: () => drawRig(heroRig, player.x, player.y, player.dir, player.moving ? player.frame : 0, idleBob) });
    if (drone.active || state.drone) items.push({ y: 1e9, f: drawDrone });
    items.sort((a, b) => a.y - b.y);
    for (const it of items) it.f();

    // prompt '!' above nearest target
    if (!dialogOpen) {
      const t = interactTarget();
      if (t) {
        const bob = REDUCED ? 0 : Math.sin(time * 5) * 2;
        const X = sx(t.px + t.w * TILE / 2), Y = sy(t.py) - (t.kind === 'cabinet' || t.kind === 'statue' ? 16 : 10) * SCALE + bob * SCALE / 2;
        // springy pop when it first appears
        const popScale = 1 + (promptPop > 0 ? (promptPop / 0.18) * 0.9 : 0);
        ctx.fillStyle = PAL.gold;
        ctx.font = `bold ${Math.round(9 * SCALE * popScale)}px "JetBrains Mono",monospace`;
        ctx.textAlign = 'center';
        ctx.fillText('!', X, Y);
        // teach the actual key/tap until the player interacts once (this session)
        if (!hintUsed) {
          ctx.font = `${5 * SCALE}px "JetBrains Mono",monospace`;
          ctx.fillStyle = 'rgba(0,0,0,0.5)';
          const label = isTouch ? 'Tap ●' : 'Press E';
          const lw = ctx.measureText(label).width;
          ctx.fillRect(X - lw / 2 - 3 * SCALE, Y + 4 * SCALE, lw + 6 * SCALE, 8 * SCALE);
          ctx.fillStyle = PAL.gold;
          ctx.fillText(label, X, Y + 10 * SCALE);
        }
      }
    }

    // door plaques — proximity fade everywhere, plus full-strength signposts in
    // the Foyer so a new arrival immediately sees where each wing is.
    ctx.textAlign = 'center';
    const inFoyer = currentRoom && currentRoom.id === 'foyer';
    for (const p of PLAQUES) {
      const d = Math.hypot(player.x - p.x * TILE, player.y - p.y * TILE);
      const prox = d < 3.5 * TILE ? Math.min(1, (3.5 * TILE - d) / TILE) : 0;
      const a = Math.max(prox, (inFoyer && p.foyer) ? 0.92 : 0);
      if (a <= 0.01) continue;
      ctx.globalAlpha = a;
      ctx.font = `${5 * SCALE}px "JetBrains Mono",monospace`;
      const label = (inFoyer && p.foyer && prox < 0.5 && p.arrow) ? p.arrow + ' ' + p.text : p.text;
      const X = sx(p.x * TILE), Y = sy(p.y * TILE) - a * 3;
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      const w = ctx.measureText(label).width;
      ctx.fillRect(X - w / 2 - 3 * SCALE, Y - 6 * SCALE, w + 6 * SCALE, 9 * SCALE);
      ctx.fillStyle = PAL.gold;
      ctx.fillText(label, X, Y);
      ctx.globalAlpha = 1;
    }

    // particles
    for (const p of particles) {
      ctx.globalAlpha = Math.max(0, 1 - p.t / p.life);
      ctx.fillStyle = p.color;
      if (p.heart) {
        const X = sx(p.x), Y = sy(p.y);
        ctx.fillRect(X - SCALE, Y, SCALE, SCALE); ctx.fillRect(X + SCALE * 0, Y, SCALE, SCALE);
        ctx.fillRect(X - SCALE, Y - SCALE, SCALE, SCALE); ctx.fillRect(X + SCALE, Y - SCALE, SCALE, SCALE);
        ctx.fillRect(X, Y + SCALE, SCALE, SCALE);
      } else {
        ctx.fillRect(sx(p.x), sy(p.y), p.size * SCALE, p.size * SCALE);
      }
    }
    ctx.globalAlpha = 1;

    // taco rain (screen space)
    for (const t of tacoRain) {
      ctx.save();
      ctx.translate(t.x * cw, t.y * ch);
      ctx.rotate(t.r);
      ctx.drawImage(rasterEmoji('🌮', 32), -16, -16, 32, 32);
      ctx.restore();
    }
  }
  let _glow = null;
  function glowSprite() {
    if (_glow) return _glow;
    _glow = mk(64, 64);
    const g = _glow.getContext('2d');
    const gr = g.createRadialGradient(32, 32, 2, 32, 32, 30);
    gr.addColorStop(0, 'rgba(255,170,60,0.32)');
    gr.addColorStop(1, 'rgba(255,170,60,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    return _glow;
  }
  function drawDrone() {
    if (!state.drone && !drone.active) return;
    const X = sx(drone.x), Y = sy(drone.y);
    drawShadow(drone.x, drone.y + 16, 10);
    ctx.save();
    ctx.translate(X, Y);
    if (drone.roll > 0) ctx.rotate(Math.PI * 2 - drone.roll);
    const bob = REDUCED ? 0 : Math.sin(time * 3) * 1.5 * SCALE;
    ctx.drawImage(rasterEmoji('🚁', 32), -8 * SCALE, -8 * SCALE + bob, 16 * SCALE, 16 * SCALE);
    ctx.restore();
  }

  // ---------------- Loop ----------------
  function frame(ts) {
    if (!playing) return;
    raf = requestAnimationFrame(frame);
    if (!last) last = ts;
    let dt = (ts - last) / 1000; last = ts;
    if (dt > 0.25) dt = 0.25;
    acc += dt;
    while (acc >= STEP) { update(STEP); acc -= STEP; }
    render();
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      cancelAnimationFrame(raf); last = 0;
      Object.keys(keys).forEach(k => keys[k] = false); joyReset();
    } else if (playing) { last = 0; acc = 0; raf = requestAnimationFrame(frame); }
  });

  // ---------------- Sizing / theme ----------------
  function resize() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = root.clientWidth, h = root.clientHeight;
    SCALE = w >= 700 ? 3 : 2;
    canvas.width = w * dpr; canvas.height = h * dpr;
    canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
    viewW = Math.ceil(w / SCALE); viewH = Math.ceil(h / SCALE);
    camX = Math.max(0, Math.min(MAPW * TILE - viewW, player.x - viewW / 2));
    camY = Math.max(0, Math.min(MAPH * TILE - viewH, player.y - viewH / 2));
    if (playing) render();
  }
  window.addEventListener('resize', resize);
  if (window.visualViewport) window.visualViewport.addEventListener('resize', resize);

  function rebuildArt() { readPalette(); bakeAtlas(); bakeRigs(); bakeWorld(); }
  new MutationObserver((muts) => {
    for (const m of muts) if (m.attributeName === 'data-theme') { rebuildArt(); if (playing) render(); }
  }).observe(document.documentElement, { attributes: true });

  // ---------------- Boot / start / exit ----------------
  const startScreen = document.getElementById('gameStart');
  const hud = document.getElementById('gameHud');
  const progress = document.getElementById('gameProgress');
  const muteBtn = document.getElementById('gameMuteBtn');

  // Touch devices get touch-appropriate control hints on the start screen.
  // The joystick isn't visible until play starts, so name its corner explicitly.
  if (isTouch) {
    const ctrls = document.getElementById('gameStartControls');
    if (ctrls) ctrls.innerHTML = '<span><b>Drag&nbsp;(left)</b>move</span><span><b>Tap&nbsp;●</b>interact</span><span><b>✕</b>exit</span>';
  }

  function openOverlay() {
    gameActive = true;
    root.classList.add('active');
    document.body.classList.add('game-active');
    startScreen.classList.remove('hidden');
    if (REDUCED) startScreen.classList.add('rm');
    hud.hidden = true; progress.hidden = true;
    resize();
    syncAchCount();
  }
  function startGame() {
    ensureAudio();
    startScreen.classList.add('hidden');
    hud.hidden = false; progress.hidden = false;
    refreshProgress(); syncAchCount();
    playing = true; last = 0; acc = 0;
    resize();
    canvas.focus({ preventScroll: true });
    raf = requestAnimationFrame(frame);
  }
  function exitGame() {
    gameActive = false;
    playing = false;
    cancelAnimationFrame(raf);
    Object.keys(keys).forEach(k => keys[k] = false); acc = 0; joyReset();
    if (dialogOpen) closeDialog();
    root.classList.remove('active');
    document.body.classList.remove('game-active');
    try { sessionStorage.setItem('ip-game-skip', '1'); } catch (e) {}
  }

  document.getElementById('gameStartBtn').addEventListener('click', startGame);
  document.getElementById('gameSkipBtn').addEventListener('click', () => { exitGame(); window.scrollTo(0, 0); });
  document.getElementById('gameExitBtn').addEventListener('click', exitGame);
  document.getElementById('gameAchBtn').addEventListener('click', () => {
    exitGame();
    const t = document.getElementById('achievements');
    if (t) t.scrollIntoView({ behavior: REDUCED ? 'auto' : 'smooth' });
  });
  function syncMute() { muteBtn.textContent = state.muted ? '🔇' : '🔊'; }
  muteBtn.addEventListener('click', () => { state.muted = !state.muted; saveState(); syncMute(); ensureAudio(); });
  syncMute();

  // Re-entry from the classic site
  const playBtn = document.getElementById('playGameBtn');
  if (playBtn) playBtn.addEventListener('click', () => {
    try { sessionStorage.removeItem('ip-game-skip'); } catch (e) {}
    openOverlay();
  });

  // Debug/QA handle (also handy in devtools)
  window.__ipGame = {
    step(n) { for (let i = 0; i < (n || 1); i++) update(STEP); render(); },
    key(k, down) { keys[k] = down !== false; },
    tp(tx, ty) { player.x = tx * TILE; player.y = ty * TILE; updateZone(); },
    interact: tryInteract,
    inspect(id) { const e = ENTITIES.find(x => x.id === id); if (e) interact(e); },
    get snapshot() {
      return { playing, gameActive, dialogOpen, x: player.x / TILE, y: player.y / TILE, dir: player.dir, room: currentRoom && currentRoom.id, coreVisited: coreVisited(), coreTotal: CORE_TOTAL, vaultOpen: state.vaultOpen, drone: state.drone };
    },
  };

  // ---------------- Init ----------------
  buildMap();
  rebuildArt();
  refreshProgress();

  let skipped = false;
  try { skipped = sessionStorage.getItem('ip-game-skip') === '1'; } catch (e) {}
  if (!location.hash && !skipped) openOverlay();
})();
